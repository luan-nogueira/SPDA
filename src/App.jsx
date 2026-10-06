import React, { useState, useEffect, useRef } from 'react';
import HomeView from './components/HomeView';
import ChecklistView from './components/ChecklistView';
import LoginView from './components/LoginView';
import ReportView from './components/ReportView';
import { useToast } from './components/Toast';
import { checklistData } from './data/checklist';
import { sourceLabel } from './utils/geo';
import { isPendingPhoto } from './utils/stats';
import { dataUrlToBlob } from './utils/image';
import { db, auth, storage } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [activePosteId, setActivePosteId] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingWrites, setPendingWrites] = useState(0);

  const toast = useToast();
  const syncingPhotosRef = useRef(false);

  // Monitoramento de conexão online / offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast?.success('Conexão restabelecida! Sincronizando dados...', 2500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast?.offline('Você está offline. Alterações serão salvas localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isFirstLoadRef = useRef(true);

  // Firestore Listener (Only runs when logged in)
  useEffect(() => {
    if (!user) {
      setPostes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const postesRef = collection(db, "contratos/SPDA/postes");
    
    const unsubscribe = onSnapshot(postesRef, 
      (snapshot) => {
        const postesData = [];
        snapshot.forEach((docSnap) => {
          postesData.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Ordena cronologicamente para fixar numeração contínua #1, #2, #3...
        postesData.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        
        const numberedPostes = postesData.map((p, idx) => ({
          ...p,
          num: idx + 1
        }));

        // Para exibição na lista, os mais recentes vêm primeiro
        numberedPostes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Notifica em tempo real a todos os outros usuários conectados
        if (!isFirstLoadRef.current) {
          snapshot.docChanges().forEach((change) => {
            const docData = change.doc.data();
            if (change.type === 'modified') {
              const totalQ = checklistData.reduce((acc, s) => acc + s.questions.length, 0);
              const answered = Object.values(docData.answers || {}).filter(a => a?.status).length;
              if (answered >= totalQ) {
                toast?.success(`⚡ ${docData.name} acaba de ser 100% finalizado!`, 4000);
              } else {
                toast?.info(`📝 ${docData.name} foi atualizado em tempo real.`, 2500);
              }
            } else if (change.type === 'added') {
              toast?.info(`➕ Novo poste adicionado: ${docData.name}`, 3000);
            }
          });
        }
        isFirstLoadRef.current = false;

        // Indica se há escritas com cache local ainda pendentes
        setPendingWrites(snapshot.metadata.hasPendingWrites ? 1 : 0);
        setPostes(numberedPostes);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao conectar ao Firestore:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Sincronizador de fotos em segundo plano quando a conexão volta
  useEffect(() => {
    if (!isOnline || syncingPhotosRef.current || postes.length === 0) return;

    const syncPendingPhotos = async () => {
      // Procura postes com fotos locais gravadas como data:
      for (const poste of postes) {
        const answers = poste.answers || {};
        let updated = false;
        const newAnswers = { ...answers };

        for (const [qId, ans] of Object.entries(answers)) {
          if (ans?.photo && isPendingPhoto(ans.photo)) {
            try {
              syncingPhotosRef.current = true;
              const blob = await dataUrlToBlob(ans.photo);
              const storageRef = ref(storage, `photos/${qId}_${Date.now()}_sync.jpg`);
              const uploadTask = await uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
              const downloadURL = await getDownloadURL(uploadTask.ref);

              newAnswers[qId] = { ...ans, photo: downloadURL };
              updated = true;
            } catch (err) {
              console.warn('Erro ao sincronizar foto pendente:', err);
            }
          }
        }

        if (updated) {
          try {
            await setDoc(doc(db, "contratos/SPDA/postes", poste.id), {
              ...poste,
              answers: newAnswers,
              updatedAt: new Date().toISOString()
            });
            toast?.success(`Fotos do ${poste.name} sincronizadas na nuvem!`);
          } catch (e) {
            console.warn('Erro ao atualizar doc após upload de foto:', e);
          }
        }
      }
      syncingPhotosRef.current = false;
    };

    syncPendingPhotos();
  }, [isOnline, postes, toast]);

  const handleCreateNew = async (name) => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const newPoste = {
      name,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      answers: {}
    };
    
    try {
      await setDoc(doc(db, "contratos/SPDA/postes", newId), newPoste);
      toast?.success(`Poste "${name}" adicionado!`);
      setActivePosteId(newId);
      setCurrentView('checklist');
    } catch (err) {
      toast?.error(`Erro ao criar poste: ${err.message}`);
    }
  };

  const handleEditPoste = (id) => {
    setActivePosteId(id);
    setCurrentView('checklist');
  };

  const handleDeletePoste = async (id) => {
    try {
      await deleteDoc(doc(db, "contratos/SPDA/postes", id));
      toast?.info('Poste excluído com sucesso.');
    } catch (err) {
      toast?.error(`Erro ao excluir poste: ${err.message}`);
    }
  };

  const sanitizeForFirestore = (val) => {
    if (val === undefined) return null;
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(sanitizeForFirestore);
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out;
  };

  const handleSavePoste = async (updatedPoste) => {
    const targetId = updatedPoste.id || activePosteId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
    const { id, ...data } = updatedPoste;

    // Sincroniza fotos pendentes para o Storage se houver alguma
    const cleanedAnswers = { ...(data.answers || {}) };
    for (const [qId, ans] of Object.entries(cleanedAnswers)) {
      if (ans?.photo && isPendingPhoto(ans.photo)) {
        try {
          const blob = await dataUrlToBlob(ans.photo);
          const storageRef = ref(storage, `photos/${qId}_${Date.now()}.jpg`);
          const uploadTask = await uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
          const downloadURL = await getDownloadURL(uploadTask.ref);
          cleanedAnswers[qId] = { ...ans, photo: downloadURL };
        } catch (err) {
          console.warn("Foto mantida em cache local:", err);
        }
      }
    }

    const docData = sanitizeForFirestore({
      ...data,
      answers: cleanedAnswers,
      updatedAt: new Date().toISOString()
    });

    try {
      const savePromise = setDoc(doc(db, "contratos/SPDA/postes", targetId), docData, { merge: true });
      
      // Timeout seguro de 2.5s para não prender a tela caso a rede esteja oscilando
      await Promise.race([
        savePromise,
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);

      // Atualiza imediatamente na lista de postes em memória
      setPostes(prev => {
        const idx = prev.findIndex(p => p.id === targetId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { id: targetId, ...copy[idx], ...docData };
          return copy;
        }
        return [{ id: targetId, ...docData }, ...prev];
      });

      toast?.success('Inspeção salva com sucesso!');
      setCurrentView('home');
      setActivePosteId(null);
    } catch (err) {
      console.error("Erro ao salvar inspeção:", err);
      toast?.error(`Erro ao salvar: ${err.message || 'Verifique a conexão'}`);
      throw err;
    }
  };

  const exportReport = () => {
    if (postes.length === 0) {
      toast?.warning("Nenhum poste registrado para exportar.");
      return;
    }

    const questionsMap = {};
    checklistData.forEach(section => {
      section.questions.forEach(q => {
        questionsMap[q.id] = q.text;
      });
    });

    let csvContent = "\uFEFF"; // BOM para suporte acentuação no Excel
    csvContent += "ID Poste,Nome do Poste,Data,Latitude,Longitude,Origem Localização,Google Maps,Cabo Câmera (m),Cabo SPDA (m),ID Questão,Questão,Status,Observação,Foto\n";

    postes.forEach(poste => {
      const answers = poste.answers || {};
      const lat = poste.location ? poste.location.lat : "";
      const lng = poste.location ? poste.location.lng : "";
      const mapsLink = poste.location ? `"https://www.google.com/maps/search/?api=1&query=${lat},${lng}"` : `""`;
      const locSource = `"${sourceLabel(poste.location)}"`;
      
      const distCamera = poste.distances?.camera || "";
      const distSpda = poste.distances?.spda || "";

      Object.keys(answers).forEach(qId => {
        const answer = answers[qId];
        if (answer && answer.status) {
          const qText = `"${(questionsMap[qId] || qId).replace(/"/g, '""')}"`;
          const status = `"${answer.status}"`;
          const obs = `"${(answer.observation || '').replace(/"/g, '""')}"`;
          const photo = answer.photo ? `"${answer.photo}"` : `""`;
          
          const row = `"${poste.id}","${poste.name}","${new Date(poste.createdAt).toLocaleDateString()}","${lat}","${lng}",${locSource},${mapsLink},"${distCamera}","${distSpda}","${qId}",${qText},${status},${obs},${photo}`;
          csvContent += row + "\n";
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_spda_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast?.success("Relatório CSV gerado e baixado!");
  };

  const handleLogout = async () => {
    await signOut(auth);
    toast?.info('Sessão encerrada.');
  };

  if (authLoading) {
    return (
      <div className="app-container home-view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: '#4facfe', fontSize: '1.2rem', fontWeight: 600 }}>Verificando credenciais...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (error) {
    return (
      <div className="app-container home-view" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '2rem', textAlign: 'center' }}>
        <span style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚠️</span>
        <h2 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Erro de Conexão</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={() => signOut(auth)} className="btn-primary" style={{ width: 'auto', padding: '0.8rem 2rem' }}>
          Sair da Conta
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-container home-view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: '#4facfe', fontSize: '1.2rem', fontWeight: 600 }}>Carregando dados da inspeção...</p>
      </div>
    );
  }

  return (
    <>
      {currentView === 'home' && (
        <HomeView 
          postes={postes}
          user={user}
          isOnline={isOnline}
          pendingWrites={pendingWrites}
          onCreateNew={handleCreateNew} 
          onEditPoste={handleEditPoste}
          onDeletePoste={handleDeletePoste}
          onExportReport={exportReport}
          onOpenReport={() => setShowReport(true)}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'checklist' && (
        <ChecklistView 
          poste={postes.find(p => p.id === activePosteId) || { id: activePosteId, name: 'Poste', answers: {} }} 
          onSave={handleSavePoste}
          onBack={() => setCurrentView('home')}
        />
      )}

      {showReport && (
        <ReportView 
          postes={postes}
          user={user}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}

export default App;

import React, { useState, useEffect, useRef } from 'react';
import ChecklistItem from './ChecklistItem';
import MapView from './MapView';
import { useToast } from './Toast';
import { checklistData as initialSections } from '../data/checklist';
import { locateDevice, refineLocation, parseCoordinates, mapsLink, sourceLabel } from '../utils/geo';
import { TOTAL_QUESTIONS, isPendingPhoto } from '../utils/stats';

export default function ChecklistView({ poste, onSave, onBack }) {
  const [answers, setAnswers] = useState(poste.answers || {});
  const [location, setLocation] = useState(poste.location || null);
  const [distances, setDistances] = useState(poste.distances || { camera: '', spda: '' });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locStatus, setLocStatus] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [manualText, setManualText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [scrolled, setScrolled] = useState(false);
  const stopRefineRef = useRef(null);
  const initialRef = useRef(JSON.stringify([poste.answers || {}, poste.location || null, poste.distances || { camera: '', spda: '' }]));
  const toast = useToast();

  useEffect(() => () => stopRefineRef.current?.(), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Quando uma foto pendente termina de sincronizar, troca o rascunho local pela URL definitiva
  useEffect(() => {
    setAnswers(prev => {
      let changed = false;
      const next = { ...prev };
      Object.entries(poste.answers || {}).forEach(([qId, remote]) => {
        const local = prev[qId];
        if (local && isPendingPhoto(local.photo) && remote?.photo && !isPendingPhoto(remote.photo)) {
          next[qId] = { ...local, photo: remote.photo };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [poste.answers]);

  const handleAnswer = (questionId, data) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: data
    }));
  };

  const answeredCount = Object.values(answers).filter(a => a?.status).length;
  const progress = TOTAL_QUESTIONS === 0 ? 0 : Math.round((answeredCount / TOTAL_QUESTIONS) * 100);
  const isDirty = JSON.stringify([answers, location, distances]) !== initialRef.current;

  const toggleSection = (index) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const handleBack = async () => {
    if (isDirty) {
      const ok = await toast.confirm({
        title: 'Sair sem salvar?',
        message: 'As alterações feitas neste poste serão perdidas.',
        confirmText: 'Sair mesmo assim',
        cancelText: 'Continuar editando',
        icon: '📝',
        danger: true,
      });
      if (!ok) return;
    }
    onBack();
  };

  const handleGetLocation = async () => {
    stopRefineRef.current?.();
    setIsLocating(true);
    setLocationError('');
    try {
      const loc = await locateDevice(setLocStatus);
      setLocation(loc);

      // Se veio do GPS mas com precisão fraca, continua refinando em segundo plano
      if (loc.source === 'gps' && loc.accuracy > 25) {
        setIsRefining(true);
        const stop = refineLocation((better) => {
          setLocation((cur) => (cur && cur.source === 'gps' && better.accuracy < (cur.accuracy || Infinity) ? better : cur));
        }, 20000);
        stopRefineRef.current = () => { stop(); setIsRefining(false); };
        setTimeout(() => setIsRefining(false), 20000);
      }
    } catch (e) {
      setLocationError(e.message);
      setShowManual(true);
    } finally {
      setIsLocating(false);
      setLocStatus('');
    }
  };

  const handleMarkerDrag = (lat, lng) => {
    stopRefineRef.current?.();
    setLocation((cur) => ({ ...cur, lat, lng, accuracy: null, source: 'manual', capturedAt: new Date().toISOString() }));
  };

  const handleManualApply = () => {
    const parsed = parseCoordinates(manualText);
    if (!parsed) {
      setLocationError('Formato inválido. Use "-23.5505, -46.6333" ou cole um link do Google Maps.');
      return;
    }
    stopRefineRef.current?.();
    setLocation(parsed);
    setLocationError('');
    setManualText('');
    setShowManual(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const handleFinish = () => {
    onSave({
      ...poste,
      answers,
      location,
      distances,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="app-container">
      <div className={`sticky-bar ${scrolled ? 'scrolled' : ''}`}>
        <div className="sticky-bar-row">
          <button id="btn-back" onClick={handleBack} className="icon-btn back-btn" aria-label="Voltar">‹</button>
          <div className="sticky-title">
            <strong>{poste.num ? `#${poste.num} · ` : ''}{poste.name}</strong>
            <small>{answeredCount}/{TOTAL_QUESTIONS} itens respondidos{isDirty ? ' · não salvo' : ''}</small>
          </div>
          <span className={`sticky-pct ${progress === 100 ? 'done' : ''}`}>{progress}%</span>
        </div>
        <div className="progress-bar-container">
          <div className={`progress-bar-fill ${progress === 100 ? 'done' : ''}`} style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <header className="header" style={{ paddingTop: '0.5rem' }}>
        <p>Preencha os itens da inspeção abaixo. Toque no título da seção para recolher.</p>
      </header>

      <main>
        {initialSections.map((section, index) => {
          const sectionAnswered = section.questions.filter(q => answers[q.id]?.status).length;
          const sectionBad = section.questions.filter(q => answers[q.id]?.status === 'nao-conforme').length;
          const isComplete = sectionAnswered === section.questions.length;
          const isCollapsed = collapsed.has(index);
          return (
          <section key={index} className={`glass-card collapsible ${isCollapsed ? 'is-collapsed' : ''} ${isComplete ? 'is-complete' : ''}`} style={{ animationDelay: `${index * 60}ms` }}>
            <button type="button" className="collapsible-head" onClick={() => toggleSection(index)} aria-expanded={!isCollapsed}>
              <h2 className="section-title">{section.title}</h2>
              <span className="collapsible-meta">
                {sectionBad > 0 && <span className="stat-badge danger">{sectionBad} NC</span>}
                <span className={`section-count ${isComplete ? 'done' : ''}`}>
                  {isComplete ? '✓' : `${sectionAnswered}/${section.questions.length}`}
                </span>
                <span className="collapsible-chevron">⌄</span>
              </span>
            </button>
            <div className="collapsible-body">
              <div className="collapsible-inner">
            {section.questions.map(q => {
              const answerData = answers[q.id] || {};
              return (
                <ChecklistItem 
                  key={q.id} 
                  id={q.id} 
                  question={q.text} 
                  onAnswer={handleAnswer} 
                  initialStatus={answerData.status || null}
                  initialObservation={answerData.observation || ''}
                  initialPhoto={answerData.photo || null}
                />
              )
            })}
              </div>
            </div>
          </section>
          );
        })}

        <section className="glass-card">
          <h2 className="section-title">📏 Distâncias e Cabeamento</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Informe as metragens estimadas de cabo neste poste.
          </p>
          
          <div className="distance-grid">
            <label className="distance-field">
              <span className="distance-label">📷 Cabo até a Câmera</span>
              <div className="input-suffix">
                <input
                  id="dist-camera"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className="poste-input"
                  placeholder="0"
                  value={distances.camera}
                  onChange={e => setDistances({ ...distances, camera: e.target.value })}
                />
                <span>m</span>
              </div>
            </label>
            <label className="distance-field">
              <span className="distance-label">⚡ Cabo até o SPDA</span>
              <div className="input-suffix">
                <input
                  id="dist-spda"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className="poste-input"
                  placeholder="0"
                  value={distances.spda}
                  onChange={e => setDistances({ ...distances, spda: e.target.value })}
                />
                <span>m</span>
              </div>
            </label>
          </div>
        </section>

        <section className="glass-card" style={{ marginBottom: '2rem', borderColor: location ? 'var(--success)' : 'var(--glass-border)' }}>
          <h2 className="section-title">📍 Localização do Poste</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Capture a coordenada GPS atual para registrar a posição exata do poste no terminal.
          </p>
          
          {location ? (
            <div className="loc-result">
              <div className="loc-result-head">
                <span className={`loc-badge ${location.source}`}>
                  {location.source === 'ip' ? '⚠️' : '✅'} {sourceLabel(location)}
                </span>
                {isRefining && <span className="loc-refining">Refinando precisão…</span>}
              </div>

              <MapView
                markers={[{ id: 'atual', lat: location.lat, lng: location.lng, color: location.source === 'ip' ? '#f59e0b' : '#10b981' }]}
                accuracy={location.accuracy}
                draggable
                onMarkerDrag={handleMarkerDrag}
                height={240}
              />

              <p className="loc-hint">
                {location.source === 'ip'
                  ? '📌 Localização aproximada. Arraste o pino até o poste exato no mapa de satélite.'
                  : '📌 Se precisar, arraste o pino para a posição exata do poste.'}
              </p>

              <div className="loc-coords">
                <code>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</code>
                <button type="button" className="chip-btn" onClick={handleCopy}>{copied ? '✓ Copiado' : '📋 Copiar'}</button>
              </div>

              <div className="loc-actions">
                <a className="chip-btn" href={mapsLink(location.lat, location.lng)} target="_blank" rel="noreferrer">🗺️ Google Maps</a>
                <button type="button" id="btn-update-location" className="chip-btn" onClick={handleGetLocation} disabled={isLocating}>
                  {isLocating ? '⏳ Buscando…' : '🔄 Atualizar'}
                </button>
                <button type="button" className="chip-btn" onClick={() => setShowManual(v => !v)}>✏️ Digitar</button>
              </div>
            </div>
          ) : (
            <>
              <button
                id="btn-get-location"
                onClick={handleGetLocation}
                className={`btn-primary btn-locate ${isLocating ? 'locating' : ''}`}
                disabled={isLocating}
              >
                <span className="radar"><span></span></span>
                {isLocating ? (locStatus || 'Buscando localização...') : 'Pegar Minha Localização Agora'}
              </button>
              {!showManual && (
                <button type="button" className="link-btn" onClick={() => setShowManual(true)}>
                  ou digite / cole as coordenadas
                </button>
              )}
            </>
          )}

          {showManual && (
            <div className="manual-coords">
              <input
                id="manual-coords-input"
                className="poste-input"
                placeholder="-23.550520, -46.633308 ou link do Maps"
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualApply()}
              />
              <button type="button" className="btn-add" onClick={handleManualApply} aria-label="Aplicar coordenadas">✓</button>
            </div>
          )}

          {locationError && <div className="loc-error">{locationError}</div>}
        </section>
      </main>

      <div style={{ height: '90px' }}></div>

      <div className="fab-container">
        <button id="btn-save" className={`btn-primary btn-save ${progress === 100 ? 'complete' : ''}`} onClick={handleFinish}>
          <span>💾 Salvar Inspeção</span>
          <span className="btn-save-pct">{progress}%</span>
        </button>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from './Toast';
import { compressImage, canvasToDataUrl, dataUrlToBlob } from '../utils/image';
import { isPendingPhoto } from '../utils/stats';

const UPLOAD_TIMEOUT = 25000;

export default function ChecklistItem({ id, question, onAnswer, initialStatus = null, initialObservation = '', initialPhoto = null }) {
  const [status, setStatus] = useState(initialStatus);
  const [observation, setObservation] = useState(initialObservation);
  const [photo, setPhoto] = useState(initialPhoto);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    setStatus(initialStatus);
    setObservation(initialObservation);
    setPhoto(initialPhoto);
  }, [initialStatus, initialObservation, initialPhoto]);

  const notifyChange = (newStatus, newObs, newPhoto) => {
    onAnswer(id, { status: newStatus, observation: newObs, photo: newPhoto });
  };

  const handleStatusChange = (newStatus) => {
    const next = status === newStatus ? null : newStatus; // toque de novo desmarca
    setStatus(next);
    notifyChange(next, observation, photo);
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const handleObservationChange = (e) => {
    const text = e.target.value;
    setObservation(text);
    notifyChange(status, text, photo);
  };

  const savePendingPhoto = (canvas) => {
    const dataUrl = canvasToDataUrl(canvas);
    setPhoto(dataUrl);
    notifyChange(status, observation, dataUrl);
    toast.offline('Sem internet: foto salva no aparelho e será enviada automaticamente.');
  };

  const uploadBlob = (blob) =>
    new Promise((resolve, reject) => {
      const storageRef = ref(storage, `photos/${id}_${Date.now()}.jpg`);
      const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
      const timer = setTimeout(() => { task.cancel(); reject(new Error('timeout')); }, UPLOAD_TIMEOUT);
      task.on(
        'state_changed',
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { clearTimeout(timer); reject(err); },
        async () => {
          clearTimeout(timer);
          try { resolve(await getDownloadURL(task.snapshot.ref)); } catch (e) { reject(e); }
        }
      );
    });

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    let compressed;
    try {
      compressed = await compressImage(file);
    } catch (err) {
      console.error('Falha ao processar imagem:', err);
      toast.error('Não foi possível ler esta imagem.');
      setIsUploading(false);
      return;
    }

    if (!navigator.onLine) {
      savePendingPhoto(compressed.canvas);
      setIsUploading(false);
      return;
    }

    try {
      const url = await uploadBlob(compressed.blob);
      setPhoto(url);
      notifyChange(status, observation, url);
      toast.success('Foto enviada!', 1800);
    } catch (err) {
      console.warn('Upload falhou, salvando localmente:', err);
      savePendingPhoto(compressed.canvas);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerCamera = () => {
    if (!isUploading) fileInputRef.current?.click();
  };

  const removePhoto = async () => {
    const ok = await toast.confirm({ title: 'Remover foto?', message: 'A foto será desvinculada deste item.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    notifyChange(status, observation, null);
  };

  const retryUploadPending = async () => {
    if (!photo || !isPendingPhoto(photo)) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const blob = await dataUrlToBlob(photo);
      const url = await uploadBlob(blob);
      setPhoto(url);
      notifyChange(status, observation, url);
      toast.success('Foto enviada com sucesso para a nuvem!', 2000);
    } catch (err) {
      console.warn('Tentativa manual falhou:', err);
      toast.error('Erro ao enviar foto: ' + (err.message || 'Falha de rede'));
    } finally {
      setIsUploading(false);
    }
  };

  const pending = isPendingPhoto(photo);

  return (
    <div className={`question-item ${status ? `answered-${status}` : ''}`}>
      <div className="question-text">{question}</div>

      <div className="options-group">
        <button
          className={`option-btn ${status === 'conforme' ? 'selected-conforme' : ''}`}
          onClick={() => handleStatusChange('conforme')}
        >
          <span className="icon">✔️</span>
          Conforme
        </button>
        <button
          className={`option-btn ${status === 'nao-conforme' ? 'selected-nao-conforme' : ''}`}
          onClick={() => handleStatusChange('nao-conforme')}
        >
          <span className="icon">❌</span>
          Não Conf.
        </button>
        <button
          className={`option-btn ${status === 'na' ? 'selected-na' : ''}`}
          onClick={() => handleStatusChange('na')}
        >
          <span className="icon">➖</span>
          N/A
        </button>
      </div>

      <div className="media-actions">
        {isUploading ? (
          <div className="photo-btn uploading">
            <span>{uploadProgress > 0 ? `Enviando foto… ${uploadProgress}%` : 'Preparando foto…'}</span>
            <div className="progress-bar-container" style={{ marginTop: 0, height: '4px' }}>
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        ) : !photo ? (
          <button className="photo-btn" onClick={triggerCamera}>
            <span className="icon">📷</span> Adicionar Foto
          </button>
        ) : (
          <div className="photo-preview-container">
            <img src={photo} alt={`Foto: ${question}`} className="photo-preview" onClick={() => setZoomed(true)} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '0.6rem', fontSize: '0.78rem', color: '#34d399', marginTop: '0.45rem', fontWeight: 600 }}>
              <span>✅ Foto salva e vinculada</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Sincronizada</span>
            </div>
            <div className="photo-actions">
              <button className="chip-btn" onClick={triggerCamera}>🔄 Trocar</button>
              <button className="chip-btn danger" onClick={removePhoto}>🗑️ Remover</button>
            </div>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handlePhotoCapture}
        />
      </div>

      {status === 'nao-conforme' && (
        <textarea
          className="observation-input"
          placeholder="Descreva a não conformidade..."
          value={observation}
          onChange={handleObservationChange}
          autoFocus
        />
      )}

      {zoomed && photo && (
        <div className="lightbox" onClick={() => setZoomed(false)}>
          <img src={photo} alt={`Foto ampliada: ${question}`} />
          <span className="lightbox-close">✕</span>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from './Toast';
import { compressImage, canvasToDataUrl } from '../utils/image';

const UPLOAD_TIMEOUT = 25000;

export default function PhotoField({ id, label, photo, onChange }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const toast = useToast();

  // O envio é assíncrono: garante que a foto seja entregue ao onChange mais recente
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const savePendingPhoto = (canvas) => {
    onChangeRef.current(canvasToDataUrl(canvas));
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
      onChangeRef.current(url);
      toast.success('Foto enviada!', 1800);
    } catch (err) {
      console.warn('Upload falhou, salvando localmente:', err);
      savePendingPhoto(compressed.canvas);
    } finally {
      setIsUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const triggerCamera = () => {
    if (!isUploading) cameraInputRef.current?.click();
  };

  const triggerGallery = () => {
    if (!isUploading) galleryInputRef.current?.click();
  };

  const removePhoto = async () => {
    const ok = await toast.confirm({ title: 'Remover foto?', message: 'A foto será desvinculada deste item.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    onChangeRef.current(null);
  };

  return (
    <div className="media-actions">
      {isUploading ? (
        <div className="photo-btn uploading">
          <span>{uploadProgress > 0 ? `Enviando foto… ${uploadProgress}%` : 'Preparando foto…'}</span>
          <div className="progress-bar-container" style={{ marginTop: 0, height: '4px' }}>
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      ) : !photo ? (
        <div className="photo-btn-group">
          <button type="button" className="photo-btn half" onClick={triggerCamera}>
            <span className="icon">📸</span> Tirar Foto
          </button>
          <button type="button" className="photo-btn half gallery" onClick={triggerGallery}>
            <span className="icon">📁</span> Anexar Foto
          </button>
        </div>
      ) : (
        <div className="photo-preview-container">
          <img src={photo} alt={`Foto: ${label}`} className="photo-preview" onClick={() => setZoomed(true)} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '0.6rem', fontSize: '0.78rem', color: '#34d399', marginTop: '0.45rem', fontWeight: 600 }}>
            <span>✅ Foto salva e vinculada</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Sincronizada</span>
          </div>
          <div className="photo-actions">
            <button type="button" className="chip-btn" onClick={triggerCamera}>📸 Tirar Outra</button>
            <button type="button" className="chip-btn" onClick={triggerGallery}>📁 Anexar Outra</button>
            <button type="button" className="chip-btn danger" onClick={removePhoto}>🗑️ Remover</button>
          </div>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        style={{ display: 'none' }}
        onChange={handlePhotoCapture}
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        style={{ display: 'none' }}
        onChange={handlePhotoCapture}
      />

      {zoomed && photo && (
        <div className="lightbox" onClick={() => setZoomed(false)}>
          <img src={photo} alt={`Foto ampliada: ${label}`} />
          <span className="lightbox-close">✕</span>
        </div>
      )}
    </div>
  );
}

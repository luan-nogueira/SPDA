import React, { useState, useEffect } from 'react';
import PhotoField from './PhotoField';

export default function ChecklistItem({ id, question, onAnswer, initialStatus = null, initialObservation = '', initialPhoto = null }) {
  const [status, setStatus] = useState(initialStatus);
  const [observation, setObservation] = useState(initialObservation);
  const [photo, setPhoto] = useState(initialPhoto);

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

  const handlePhotoChange = (newPhoto) => {
    setPhoto(newPhoto);
    notifyChange(status, observation, newPhoto);
  };

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

      <PhotoField id={id} label={question} photo={photo} onChange={handlePhotoChange} />

      {status === 'nao-conforme' && (
        <textarea
          className="observation-input"
          placeholder="Descreva a não conformidade..."
          value={observation}
          onChange={handleObservationChange}
          autoFocus
        />
      )}
    </div>
  );
}

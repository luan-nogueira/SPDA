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
  const [details, setDetails] = useState(poste.details || {
    posteMaterial: '', cameraCount: '', cameraType: '', cameraCondition: '', panelHeight: '',
    fiberType: '', fiberCount: '', fiberConnector: '', fiberCable: '',
    powerType: '', voltage: '', camPowerSource: '', missingComponents: '',
    spdaImprovements: '', criticality: '', priority: '', finalObservations: '',
    inventory: {}
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locStatus, setLocStatus] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [manualText, setManualText] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [scrolled, setScrolled] = useState(false);
  const stopRefineRef = useRef(null);
  const initialRef = useRef(JSON.stringify([poste.answers || {}, poste.location || null, poste.distances || { camera: '', spda: '' }, poste.details || {}]));
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
  const isDirty = JSON.stringify([answers, location, distances, details]) !== initialRef.current;

  const handleDetailChange = (field, value) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleInventoryChange = (item, field, value) => {
    setDetails(prev => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        [item]: {
          ...(prev.inventory[item] || {}),
          [field]: value
        }
      }
    }));
  };

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

  const handleFinish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        ...poste,
        answers,
        location,
        distances,
        details,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast?.error("Erro ao salvar: " + (err.message || "Tente novamente"));
      setIsSaving(false);
    }
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
            {index === 4 && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--glass-border)' }}>
                <label className="distance-field" style={{ marginBottom: '0.5rem' }}>
                  <span className="distance-label" style={{ color: 'var(--primary)' }}>Melhorias e Padronização (Sistema de SPDA)</span>
                  <textarea className="poste-input observation-input" placeholder="Sugestões para o SPDA..." value={details.spdaImprovements} onChange={e => handleDetailChange('spdaImprovements', e.target.value)}></textarea>
                </label>
              </div>
            )}
              </div>
            </div>
          </section>
          );
        })}

        <section className="glass-card">
          <h2 className="section-title">📋 Informações do Poste</h2>
          <label className="distance-field" style={{ marginBottom: '1rem' }}>
            <span className="distance-label">Tipo do Material do Poste</span>
            <select className="poste-input" value={details.posteMaterial} onChange={e => handleDetailChange('posteMaterial', e.target.value)}>
              <option value="">Selecione...</option>
              <option value="Duplo T">Duplo T</option>
              <option value="Metálico">Metálico</option>
              <option value="Concreto">Concreto</option>
              <option value="Outro">Outro</option>
            </select>
          </label>
        </section>

        <section className="glass-card">
          <h2 className="section-title">📷 Informações das Câmeras</h2>
          <label className="distance-field" style={{ marginBottom: '1rem' }}>
            <span className="distance-label">Qtd. de Câmeras no Poste</span>
            <input type="number" min="0" className="poste-input" placeholder="0" value={details.cameraCount} onChange={e => handleDetailChange('cameraCount', e.target.value)} />
          </label>

          <label className="distance-field" style={{ marginBottom: '1rem' }}>
            <span className="distance-label">Tipo e Nome das Câmeras</span>
            <input type="text" className="poste-input" placeholder="Ex: PTZ, Fixa..." value={details.cameraType} onChange={e => handleDetailChange('cameraType', e.target.value)} />
          </label>

          <label className="distance-field" style={{ marginBottom: '1rem' }}>
            <span className="distance-label">Estado Visual das Câmeras (Kit frontal, fixação, lente)</span>
            <textarea className="poste-input observation-input" placeholder="Descreva o estado visual..." value={details.cameraCondition} onChange={e => handleDetailChange('cameraCondition', e.target.value)}></textarea>
          </label>
        </section>

        <section className="glass-card">
          <h2 className="section-title">🎛️ Instalação do Painel</h2>
          <label className="distance-field" style={{ marginBottom: '1rem' }}>
            <span className="distance-label">Altura de Instalação do Painel (m)</span>
            <input type="text" className="poste-input" placeholder="Ex: 2.5m" value={details.panelHeight} onChange={e => handleDetailChange('panelHeight', e.target.value)} />
          </label>
        </section>

        <section className="glass-card">
          <h2 className="section-title">📦 Caixa de Equipamentos</h2>
          
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: '1rem' }}>Detalhes das Fibras</h3>
          <div className="options-group" style={{ marginBottom: '0.5rem' }}>
            <label><input type="radio" name="fiberType" value="Monomodo" checked={details.fiberType === 'Monomodo'} onChange={e => handleDetailChange('fiberType', e.target.value)}/> Monomodo</label>
            <label style={{ marginLeft: '1rem' }}><input type="radio" name="fiberType" value="Multimodo" checked={details.fiberType === 'Multimodo'} onChange={e => handleDetailChange('fiberType', e.target.value)}/> Multimodo</label>
          </div>
          <div className="distance-grid">
            <label className="distance-field"><span className="distance-label">Nº de Fibras</span><input type="number" className="poste-input" value={details.fiberCount} onChange={e => handleDetailChange('fiberCount', e.target.value)}/></label>
            <label className="distance-field"><span className="distance-label">Conector</span><input type="text" className="poste-input" value={details.fiberConnector} onChange={e => handleDetailChange('fiberConnector', e.target.value)}/></label>
          </div>
          <label className="distance-field" style={{ marginBottom: '1rem', marginTop: '1rem' }}><span className="distance-label">Cabo / Fabricante</span><input type="text" className="poste-input" value={details.fiberCable} onChange={e => handleDetailChange('fiberCable', e.target.value)}/></label>

          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', marginTop: '1rem' }}>Alimentação Elétrica</h3>
          <div className="options-group" style={{ marginBottom: '0.5rem' }}>
            <label><input type="radio" name="powerType" value="F+F+T" checked={details.powerType === 'F+F+T'} onChange={e => handleDetailChange('powerType', e.target.value)}/> F+F+T</label>
            <label style={{ marginLeft: '1rem' }}><input type="radio" name="powerType" value="F+N+T" checked={details.powerType === 'F+N+T'} onChange={e => handleDetailChange('powerType', e.target.value)}/> F+N+T</label>
          </div>
          <div className="options-group" style={{ marginBottom: '1rem' }}>
            <span style={{ marginRight: '1rem', fontSize: '0.9rem' }}>Tensão:</span>
            <label><input type="radio" name="voltage" value="110v" checked={details.voltage === '110v'} onChange={e => handleDetailChange('voltage', e.target.value)}/> 110v</label>
            <label style={{ marginLeft: '1rem' }}><input type="radio" name="voltage" value="220v" checked={details.voltage === '220v'} onChange={e => handleDetailChange('voltage', e.target.value)}/> 220v</label>
          </div>

          <label className="distance-field" style={{ marginBottom: '1.5rem' }}>
            <span className="distance-label">Alimentação de Câmera</span>
            <select className="poste-input" value={details.camPowerSource} onChange={e => handleDetailChange('camPowerSource', e.target.value)}>
              <option value="">Selecione...</option>
              <option value="Switch POE">Switch POE</option>
              <option value="Injetor POE">Injetor POE</option>
              <option value="Fonte Externa">Fonte Externa</option>
            </select>
          </label>

        </section>

        <section className="glass-card">
          <h2 className="section-title">📋 Inventário Detalhado</h2>
          <div className="inventory-list" style={{ marginBottom: '1rem' }}>
            {['Switch', 'Injetor POE', 'Fonte de alimentação', 'Disjuntor / DPR', 'DPS', 'Conversor de mídia', 'Rádio', 'DIO', 'Bornes / Barramento de terra', 'Nobreak / Bateria'].map(item => (
              <div key={item} className="inventory-card">
                <h4 className="inventory-card-title">{item}</h4>
                <div className="inventory-card-grid">
                  <label>
                    <span>Fabricante</span>
                    <input type="text" className="inv-input" value={details.inventory[item]?.fabricante || ''} onChange={e => handleInventoryChange(item, 'fabricante', e.target.value)}/>
                  </label>
                  <label>
                    <span>Modelo</span>
                    <input type="text" className="inv-input" value={details.inventory[item]?.modelo || ''} onChange={e => handleInventoryChange(item, 'modelo', e.target.value)}/>
                  </label>
                  <label>
                    <span>Qtd</span>
                    <input type="number" className="inv-input" value={details.inventory[item]?.qtd || ''} onChange={e => handleInventoryChange(item, 'qtd', e.target.value)}/>
                  </label>
                  <label>
                    <span>Estado</span>
                    <select className="inv-input" value={details.inventory[item]?.estado || ''} onChange={e => handleInventoryChange(item, 'estado', e.target.value)}>
                      <option value=""></option>
                      <option value="Bom">Bom</option>
                      <option value="Regular">Regular</option>
                      <option value="Ruim">Ruim</option>
                    </select>
                  </label>
                  <label className="full-width">
                    <span>Melhoria</span>
                    <input type="text" className="inv-input" value={details.inventory[item]?.melhoria || ''} onChange={e => handleInventoryChange(item, 'melhoria', e.target.value)}/>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <label className="distance-field" style={{ marginBottom: '1rem' }}>
            <span className="distance-label">Componentes Ausentes e Melhorias Propostas</span>
            <textarea className="poste-input observation-input" placeholder="Cite componentes faltantes..." value={details.missingComponents} onChange={e => handleDetailChange('missingComponents', e.target.value)}></textarea>
          </label>
        </section>

        <section className="glass-card">
          <h2 className="section-title">📝 Observações Finais</h2>
          <div className="distance-grid">
            <label className="distance-field">
              <span className="distance-label">Criticidade do Poste</span>
              <select className="poste-input" value={details.criticality} onChange={e => handleDetailChange('criticality', e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </label>
            <label className="distance-field">
              <span className="distance-label">Grau de Prioridade</span>
              <select className="poste-input" value={details.priority} onChange={e => handleDetailChange('priority', e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Urgente">Urgente</option>
                <option value="Alta">Alta</option>
                <option value="Normal">Normal</option>
                <option value="Baixa">Baixa</option>
              </select>
            </label>
          </div>
          <label className="distance-field" style={{ marginBottom: '1rem', marginTop: '1rem' }}>
            <span className="distance-label">Observações Finais da Inspeção</span>
            <textarea className="poste-input observation-input" placeholder="Dissertação sobre a inspeção..." value={details.finalObservations} onChange={e => handleDetailChange('finalObservations', e.target.value)}></textarea>
          </label>
        </section>

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
        <button
          id="btn-save"
          className={`btn-primary btn-save ${progress === 100 ? 'complete' : ''}`}
          onClick={handleFinish}
          disabled={isSaving}
          style={{ opacity: isSaving ? 0.75 : 1, cursor: isSaving ? 'wait' : 'pointer' }}
        >
          <span>{isSaving ? '⏳ Salvando Inspeção…' : '💾 Salvar Inspeção'}</span>
          <span className="btn-save-pct">{progress}%</span>
        </button>
      </div>
    </div>
  );
}

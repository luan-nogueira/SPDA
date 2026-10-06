import React, { useEffect, useRef, useState } from 'react';
import MapView, { escapeHtml } from './MapView';
import { useToast } from './Toast';
import { mapsLink, sourceLabel } from '../utils/geo';
import { posteStats, globalStats } from '../utils/stats';

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function StatCard({ icon, label, value, suffix = '', decimals = 0, tone = 'blue', sub }) {
  const animated = useCountUp(value);
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-value">
        {animated.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        <span>{suffix}</span>
      </div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export function ProgressRing({ pct, size = 46, stroke = 4, bad = 0 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = bad > 0 ? '#f87171' : pct === 100 ? '#34d399' : '#60a5fa';
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      <span style={{ color }}>{pct === 100 ? '✓' : `${pct}%`}</span>
    </div>
  );
}

export default function HomeView({ postes, user, isOnline, pendingWrites, onCreateNew, onEditPoste, onExportReport, onOpenReport, onDeletePoste, onLogout }) {
  const [newPosteName, setNewPosteName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedMapPoste, setSelectedMapPoste] = useState(null);
  const [showAllMap, setShowAllMap] = useState(false);
  const toast = useToast();

  const handleCreate = () => {
    if (newPosteName.trim()) {
      onCreateNew(newPosteName.trim());
      setNewPosteName('');
    } else {
      toast.warning('Digite um nome para o poste.');
    }
  };

  const handleDelete = async (poste) => {
    const ok = await toast.confirm({
      title: `Excluir "${poste.name}"?`,
      message: 'Todas as respostas, fotos vinculadas e a localização deste poste serão removidas permanentemente.',
      confirmText: 'Excluir',
      danger: true,
    });
    if (ok) onDeletePoste(poste.id);
  };

  const g = globalStats(postes);
  const filtered = search.trim()
    ? postes.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : postes;

  const located = postes.filter(p => p.location && Number.isFinite(p.location.lat) && Number.isFinite(p.location.lng));

  const mapMarkers = located.map(p => {
    const s = posteStats(p);
    return {
      id: p.id,
      lat: p.location.lat,
      lng: p.location.lng,
      label: String(p.num),
      color: s.bad > 0 ? '#ef4444' : '#10b981',
      popupHtml: `<div class="map-popup"><strong>#${p.num} · ${escapeHtml(p.name)}</strong>`
        + `<span>${s.pct}% concluído · ${s.bad > 0 ? `❌ ${s.bad} não conformidade(s)` : '✅ Sem NC'}</span>`
        + `<span>📷 ${escapeHtml(p.distances?.camera || '–')} m · ⚡ ${escapeHtml(p.distances?.spda || '–')} m</span>`
        + `<a href="${mapsLink(p.location.lat, p.location.lng)}" target="_blank" rel="noreferrer">Abrir no Google Maps ↗</a></div>`,
    };
  });

  const firstName = (user?.displayName || user?.email || '').split(/[@\s.]/)[0];

  return (
    <div className="app-container home-view">
      <header className="home-header">
        <div className="home-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h1>Inspeções SPDA</h1>
            <p>{firstName ? `Olá, ${firstName}` : 'Gestão de Checklists de Postes'}</p>
          </div>
        </div>
        <div className="home-header-actions">
          <span className={`net-pill ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Conectado' : 'Sem internet'}>
            <i></i>{isOnline ? (pendingWrites > 0 ? 'Sincronizando' : 'Online') : 'Offline'}
          </span>
          <button id="btn-logout" className="icon-btn" onClick={onLogout} title="Sair da conta" aria-label="Sair da conta">⎋</button>
        </div>
      </header>

      <main>
        {/* Painel */}
        <section className="stats-grid" aria-label="Resumo">
          <StatCard icon="🏗️" label="Postes" value={g.total} tone="blue" sub={`${g.complete} concluídos`} />
          <StatCard icon="📈" label="Média concluída" value={g.avgPct} suffix="%" tone="violet" sub={`${g.located} com GPS`} />
          <StatCard icon="⚠️" label="Não conformidades" value={g.bad} tone={g.bad > 0 ? 'red' : 'green'} sub={g.bad > 0 ? 'requerem atenção' : 'tudo certo'} />
          <StatCard icon="🧵" label="Cabo total" value={g.cableTotal} suffix=" m" decimals={g.cableTotal % 1 ? 1 : 0} tone="amber" sub={`📷 ${g.cableCamera.toLocaleString('pt-BR')} · ⚡ ${g.cableSpda.toLocaleString('pt-BR')}`} />
        </section>

        {(pendingWrites > 0 || !isOnline) && (
          <div className={`sync-banner ${isOnline ? '' : 'offline'}`}>
            <span>{isOnline ? '🔄' : '📴'}</span>
            <div>
              <strong>{isOnline ? 'Sincronizando com o servidor…' : 'Você está sem internet'}</strong>
              <small>
                {isOnline
                  ? `${pendingWrites} alteração(ões) sendo enviadas.`
                  : 'Pode continuar trabalhando: tudo fica salvo no aparelho e será enviado quando a conexão voltar.'}
              </small>
            </div>
          </div>
        )}

        <section className="glass-card add-poste-card">
          <h2 className="card-title">Novo Poste</h2>
          <div className="add-poste-form">
            <input
              id="new-poste-input"
              type="text"
              className="poste-input"
              placeholder="Ex: Poste 01, Rua A..."
              value={newPosteName}
              onChange={(e) => setNewPosteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button id="btn-add-poste" className="btn-add" onClick={handleCreate} aria-label="Adicionar poste">
              ＋
            </button>
          </div>
        </section>

        <section className="glass-card list-card">
          <div className="list-header">
            <h2 className="card-title">Meus Postes</h2>
            {postes.length > 0 && (
              <div className="export-group">
                <button id="btn-export-csv" className="btn-export" onClick={onExportReport}>📊 CSV</button>
                <button id="btn-export-pdf" className="btn-export pdf" onClick={onOpenReport}>📄 PDF</button>
              </div>
            )}
          </div>

          {postes.length > 3 && (
            <input
              id="search-postes"
              className="poste-input search-input"
              placeholder="🔎 Buscar poste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          {postes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <p>Nenhum poste registrado.<br/>Adicione o primeiro poste acima.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>Nenhum poste encontrado para “{search}”.</p></div>
          ) : (
            <div className="postes-list">
              {filtered.map((poste, i) => {
                const s = posteStats(poste);
                return (
                  <div
                    key={poste.id}
                    className="poste-item"
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    onClick={() => onEditPoste(poste.id)}
                  >
                    <ProgressRing pct={s.pct} bad={s.bad} />
                    <div className="poste-info">
                      <h3><span className="poste-num">#{poste.num}</span> {poste.name}</h3>
                      <div className="poste-stats">
                        <span className="stat-badge">{s.answered}/{s.total} itens</span>
                        {s.bad > 0 && <span className="stat-badge danger">❌ {s.bad} NC</span>}
                        {s.photos > 0 && <span className="stat-badge">📷 {s.photos}</span>}
                        {poste.location && <span className="stat-badge info">📍 GPS</span>}
                        <span className="stat-date">{new Date(poste.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="poste-actions">
                      <button
                        className="icon-btn delete-btn"
                        aria-label={`Excluir ${poste.name}`}
                        onClick={(e) => { e.stopPropagation(); handleDelete(poste); }}
                      >
                        🗑️
                      </button>
                      <div className="chevron">›</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card" id="mapa-postes">
          <div className="list-header">
            <div>
              <h2 className="card-title">🗺️ Mapa dos Postes</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Clique em um poste para abrir o mapa com a sua localização exata.
              </p>
            </div>
            {located.length > 0 && (
              <button
                type="button"
                className="chip-btn"
                onClick={() => setShowAllMap(v => !v)}
              >
                {showAllMap ? 'Ocultar Visão Geral' : '👁️ Ver Todos'}
              </button>
            )}
          </div>

          {showAllMap && located.length > 0 && (
            <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
              <MapView markers={mapMarkers} height={280} onMarkerClick={(id) => {
                const target = postes.find(p => p.id === id);
                if (target) setSelectedMapPoste(target);
              }} />
              <div className="map-legend">
                <span><i style={{ background: '#10b981' }}></i> Conforme</span>
                <span><i style={{ background: '#ef4444' }}></i> Não Conforme</span>
              </div>
            </div>
          )}

          {postes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📍</span>
              <p>Nenhum poste cadastrado ainda.<br/>Cadastre seu primeiro poste acima.</p>
            </div>
          ) : (
            <div className="map-postes-grid">
              {postes.map((p) => {
                const hasGps = p.location && Number.isFinite(p.location.lat) && Number.isFinite(p.location.lng);
                return (
                  <div
                    key={p.id}
                    className={`map-poste-card ${hasGps ? 'has-gps' : 'no-gps'}`}
                    onClick={() => setSelectedMapPoste(p)}
                  >
                    <div className="map-poste-card-left">
                      <span className={`map-status-dot ${hasGps ? 'active' : ''}`}></span>
                      <div className="map-poste-card-info">
                        <strong>#{p.num} · {p.name}</strong>
                        <small>
                          {hasGps
                            ? `${p.location.lat.toFixed(5)}, ${p.location.lng.toFixed(5)} · ${sourceLabel(p.location)}`
                            : 'Sem localização GPS gravada'}
                        </small>
                      </div>
                    </div>
                    <span className="chip-btn map-open-chip">
                      {hasGps ? 'Ver Mapa 📍' : 'Capturar ➕'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal dedicado de localização do poste selecionado */}
      {selectedMapPoste && (
        <div className="dialog-backdrop" onClick={() => setSelectedMapPoste(null)}>
          <div className="map-poste-modal" onClick={(e) => e.stopPropagation()}>
            <div className="map-poste-modal-header">
              <div className="map-poste-modal-title">
                <span className="poste-pill">#{selectedMapPoste.num}</span>
                <div>
                  <h3>{selectedMapPoste.name}</h3>
                  <p>
                    {selectedMapPoste.location
                      ? `Localização: ${sourceLabel(selectedMapPoste.location)}`
                      : 'Sem localização GPS registrada'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedMapPoste(null)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="map-poste-modal-body">
              {selectedMapPoste.location && Number.isFinite(selectedMapPoste.location.lat) ? (
                <>
                  <MapView
                    markers={[{
                      id: selectedMapPoste.id,
                      lat: selectedMapPoste.location.lat,
                      lng: selectedMapPoste.location.lng,
                      label: String(selectedMapPoste.num),
                      color: '#10b981'
                    }]}
                    accuracy={selectedMapPoste.location.accuracy}
                    height={320}
                  />

                  <div className="map-modal-details">
                    <div className="loc-coords">
                      <code>{selectedMapPoste.location.lat.toFixed(6)}, {selectedMapPoste.location.lng.toFixed(6)}</code>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={async () => {
                          await navigator.clipboard.writeText(`${selectedMapPoste.location.lat.toFixed(6)}, ${selectedMapPoste.location.lng.toFixed(6)}`);
                          toast.success('Coordenadas copiadas!');
                        }}
                      >
                        📋 Copiar
                      </button>
                    </div>

                    <div className="map-modal-actions">
                      <a
                        className="btn-primary"
                        href={mapsLink(selectedMapPoste.location.lat, selectedMapPoste.location.lng)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: 'none', padding: '0.85rem' }}
                      >
                        🗺️ Abrir no Google Maps ↗
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <span className="empty-icon">📍</span>
                  <p>Este poste ainda não possui coordenadas GPS cadastradas.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: '1rem', width: 'auto', padding: '0.8rem 1.6rem' }}
                    onClick={() => {
                      const id = selectedMapPoste.id;
                      setSelectedMapPoste(null);
                      onEditPoste(id);
                    }}
                  >
                    Ir ao Checklist e Capturar GPS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

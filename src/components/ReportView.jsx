import React, { useState } from 'react';
import { checklistData } from '../data/checklist';
import { globalStats, posteStats, STATUS_LABEL } from '../utils/stats';
import { mapsLink, sourceLabel } from '../utils/geo';

export default function ReportView({ postes, user, onClose }) {
  const [onlyNonCompliant, setOnlyNonCompliant] = useState(false);
  const g = globalStats(postes);

  // Mapeamento rápido de ID da questão -> texto da questão
  const questionMap = {};
  checklistData.forEach(section => {
    section.questions.forEach(q => {
      questionMap[q.id] = { text: q.text, sectionTitle: section.title };
    });
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="report-backdrop">
      <div className="report-toolbar no-print">
        <div className="report-toolbar-left">
          <button onClick={onClose} className="chip-btn" id="btn-close-report">
            ← Voltar ao Sistema
          </button>
          <span className="report-toolbar-title">Prévia de Impressão / PDF</span>
        </div>
        <div className="report-toolbar-right">
          <label className="filter-checkbox-label">
            <input
              type="checkbox"
              checked={onlyNonCompliant}
              onChange={(e) => setOnlyNonCompliant(e.target.checked)}
            />
            <span>Apenas Não Conformidades</span>
          </label>
          <button onClick={handlePrint} className="btn-primary btn-print" id="btn-print-pdf">
            <span>🖨️ Imprimir / Salvar em PDF</span>
          </button>
        </div>
      </div>

      <div className="report-page printable-content">
        {/* Cabeçalho do Relatório */}
        <header className="report-header">
          <div className="report-header-top">
            <div className="report-logo">
              <span className="report-logo-icon">⚡</span>
              <div>
                <h1>RELATÓRIO DE INSPEÇÃO TÉCNICA</h1>
                <p className="report-subtitle">Sistema de Proteção contra Descargas Atmosféricas (SPDA) & Cabeamento</p>
              </div>
            </div>
            <div className="report-meta-box">
              <div><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
              <div><strong>Inspetor / Técnico:</strong> {user?.displayName || user?.email || 'Técnico Responsável'}</div>
              <div><strong>Projeto / Terminal:</strong> Ferroport - Contratos SPDA</div>
            </div>
          </div>
        </header>

        {/* Resumo Executivo */}
        <section className="report-summary-section">
          <h2 className="report-section-heading">1. RESUMO EXECUTIVO DA VISTORIA</h2>
          <div className="report-stats-grid">
            <div className="report-stat-box">
              <span className="stat-label">Total de Postes</span>
              <span className="stat-value">{g.total}</span>
              <span className="stat-sub">{g.complete} 100% concluídos</span>
            </div>
            <div className="report-stat-box">
              <span className="stat-label">Conclusão Média</span>
              <span className="stat-value">{g.avgPct}%</span>
              <span className="stat-sub">{g.located} georreferenciados</span>
            </div>
            <div className={`report-stat-box ${g.bad > 0 ? 'alert' : 'success'}`}>
              <span className="stat-label">Não Conformidades</span>
              <span className="stat-value">{g.bad}</span>
              <span className="stat-sub">{g.bad === 0 ? 'Conforme com as normas' : 'Requerem ação corretiva'}</span>
            </div>
            <div className="report-stat-box">
              <span className="stat-label">Cabo Câmeras</span>
              <span className="stat-value">{g.cableCamera} m</span>
              <span className="stat-sub">Metragem estimada</span>
            </div>
            <div className="report-stat-box">
              <span className="stat-label">Cabo SPDA</span>
              <span className="stat-value">{g.cableSpda} m</span>
              <span className="stat-sub">Metragem estimada</span>
            </div>
            <div className="report-stat-box highlight">
              <span className="stat-label">Cabeamento Total</span>
              <span className="stat-value">{g.cableTotal} m</span>
              <span className="stat-sub">Total acumulado</span>
            </div>
          </div>
        </section>

        {/* Tabela Sintética de Todos os Postes */}
        <section className="report-table-section">
          <h2 className="report-section-heading">2. QUADRO GERAL DE POSTES & COORDENADAS</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Identificação do Poste</th>
                <th>Status Inspeção</th>
                <th>Não Conf.</th>
                <th>Cabo Câmera</th>
                <th>Cabo SPDA</th>
                <th>Localização GPS</th>
              </tr>
            </thead>
            <tbody>
              {postes.map((p, index) => {
                const s = posteStats(p);
                return (
                  <tr key={p.id}>
                    <td><strong>#{p.num || index + 1}</strong></td>
                    <td><strong>{p.name}</strong></td>
                    <td>
                      <span className={`table-badge ${s.pct === 100 ? 'badge-success' : 'badge-neutral'}`}>
                        {s.pct}% ({s.answered}/{s.total})
                      </span>
                    </td>
                    <td>
                      {s.bad > 0 ? (
                        <span className="table-badge badge-danger">❌ {s.bad} NC</span>
                      ) : (
                        <span className="table-badge badge-success">✓ OK</span>
                      )}
                    </td>
                    <td>{p.distances?.camera ? `${p.distances.camera} m` : '–'}</td>
                    <td>{p.distances?.spda ? `${p.distances.spda} m` : '–'}</td>
                    <td>
                      {p.location ? (
                        <div className="table-gps-cell">
                          <span>{p.location.lat.toFixed(5)}, {p.location.lng.toFixed(5)}</span>
                          <a
                            href={mapsLink(p.location.lat, p.location.lng)}
                            target="_blank"
                            rel="noreferrer"
                            className="gps-link no-print"
                          >
                            Abrir Maps ↗
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: '#999' }}>Não coletado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Detalhamento por Poste */}
        <section className="report-details-section">
          <h2 className="report-section-heading">3. DETALHAMENTO DAS INSPEÇÕES & EVIDÊNCIAS FOTOGRÁFICAS</h2>

          {postes.map((p, index) => {
            const s = posteStats(p);
            const answers = p.answers || {};
            const answerEntries = Object.entries(answers);

            // Filtragem se selecionado apenas NC
            const filteredEntries = onlyNonCompliant
              ? answerEntries.filter(([, a]) => a?.status === 'nao-conforme')
              : answerEntries.filter(([, a]) => a?.status);

            const hasPhotos = answerEntries.some(([, a]) => a?.photo);

            if (onlyNonCompliant && s.bad === 0) {
              return null; // Oculta postes sem não conformidade quando filtro ativo
            }

            return (
              <div key={p.id} className="report-poste-card">
                <div className="report-poste-header">
                  <div className="report-poste-title">
                    <span className="poste-pill">Poste #{p.num || index + 1}</span>
                    <h3>{p.name}</h3>
                  </div>
                  <div className="report-poste-badges">
                    <span className={`table-badge ${s.pct === 100 ? 'badge-success' : 'badge-neutral'}`}>
                      Progresso: {s.pct}%
                    </span>
                    {s.bad > 0 ? (
                      <span className="table-badge badge-danger">{s.bad} Não Conformidade(s)</span>
                    ) : (
                      <span className="table-badge badge-success">Sem Não Conformidades</span>
                    )}
                  </div>
                </div>

                <div className="report-poste-info-bar">
                  <span><strong>Cabo Câmera:</strong> {p.distances?.camera ? `${p.distances.camera} m` : 'Não informado'}</span>
                  <span><strong>Cabo SPDA:</strong> {p.distances?.spda ? `${p.distances.spda} m` : 'Não informado'}</span>
                  <span>
                    <strong>Coordenadas:</strong>{' '}
                    {p.location
                      ? `${p.location.lat.toFixed(6)}, ${p.location.lng.toFixed(6)} (${sourceLabel(p.location)})`
                      : 'Sem GPS'}
                  </span>
                </div>

                {p.details && (
                  <div className="report-poste-details">
                    <h4>Informações e Inventário</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      {p.details.posteMaterial && <div><strong>Material do Poste:</strong> {p.details.posteMaterial}</div>}
                      {p.details.cameraCount && <div><strong>Qtd. Câmeras:</strong> {p.details.cameraCount}</div>}
                      {p.details.cameraType && <div><strong>Tipo de Câmeras:</strong> {p.details.cameraType}</div>}
                      {p.details.panelHeight && <div><strong>Altura do Painel:</strong> {p.details.panelHeight}</div>}
                      {p.details.criticality && <div><strong>Criticidade:</strong> {p.details.criticality}</div>}
                      {p.details.priority && <div><strong>Prioridade:</strong> {p.details.priority}</div>}
                      {p.details.camPowerSource && <div><strong>Alimentação Câmera:</strong> {p.details.camPowerSource}</div>}
                      {p.details.powerType && <div><strong>Elétrica:</strong> {p.details.powerType} ({p.details.voltage})</div>}
                    </div>
                    {p.details.cameraCondition && <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Estado das Câmeras:</strong> {p.details.cameraCondition}</div>}
                    
                    {p.details.inventory && Object.keys(p.details.inventory).length > 0 && (
                      <table className="report-items-table" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                        <thead>
                          <tr>
                            <th>Equipamento</th>
                            <th>Fab. / Mod.</th>
                            <th>Qtd</th>
                            <th>Estado</th>
                            <th>Melhoria</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(p.details.inventory).map(([item, data]) => {
                            if (!data.qtd && !data.estado) return null;
                            return (
                              <tr key={item}>
                                <td>{item}</td>
                                <td>{data.fabricante} / {data.modelo}</td>
                                <td>{data.qtd}</td>
                                <td>{data.estado}</td>
                                <td>{data.melhoria}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    
                    {p.details.spdaImprovements && <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Melhorias SPDA:</strong> {p.details.spdaImprovements}</div>}
                    {p.details.missingComponents && <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Componentes Ausentes:</strong> {p.details.missingComponents}</div>}
                    {p.details.finalObservations && <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Observações Finais:</strong> {p.details.finalObservations}</div>}
                  </div>
                )}

                {filteredEntries.length === 0 ? (
                  <p className="no-data-hint">Nenhum item respondido para este poste.</p>
                ) : (
                  <table className="report-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '45%' }}>Item da Inspeção</th>
                        <th style={{ width: '15%' }}>Avaliação</th>
                        <th style={{ width: '40%' }}>Observações e Parecer Técnico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map(([qId, item]) => {
                        const qInfo = questionMap[qId] || { text: qId };
                        return (
                          <tr key={qId} className={item.status === 'nao-conforme' ? 'row-danger' : ''}>
                            <td>
                              <strong>{qInfo.text}</strong>
                              {qInfo.sectionTitle && <small className="item-section-tag">{qInfo.sectionTitle}</small>}
                            </td>
                            <td>
                              <span className={`item-status-tag ${item.status}`}>
                                {STATUS_LABEL[item.status] || item.status}
                              </span>
                            </td>
                            <td>
                              {item.observation ? (
                                <p className="obs-text">{item.observation}</p>
                              ) : (
                                <span className="text-muted">–</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Evidências Fotográficas */}
                {hasPhotos && (
                  <div className="report-photos-section">
                    <h4>📸 Registros Fotográficos</h4>
                    <div className="report-photos-grid">
                      {answerEntries
                        .filter(([, item]) => item?.photo)
                        .map(([qId, item]) => {
                          const qInfo = questionMap[qId] || { text: qId };
                          return (
                            <div key={qId} className="report-photo-card">
                              <img src={item.photo} alt={qInfo.text} />
                              <div className="photo-legend">
                                <span className={`photo-status-indicator ${item.status}`}></span>
                                <strong>{qInfo.text}</strong>
                                {item.observation && <p>{item.observation}</p>}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Assinaturas / Aprovação */}
        <section className="report-signatures-section">
          <div className="signatures-grid">
            <div className="signature-box">
              <div className="signature-line"></div>
              <strong>{user?.displayName || user?.email || 'Técnico Responsável'}</strong>
              <span>Inspetor Técnico / Vistoriador SPDA</span>
              <small>Data: ____/____/________</small>
            </div>
            <div className="signature-box">
              <div className="signature-line"></div>
              <strong>Responsável Técnico / Engenharia</strong>
              <span>Gestão de Manutenção & Infraestrutura</span>
              <small>Data: ____/____/________</small>
            </div>
          </div>
        </section>

        <footer className="report-footer">
          <p>Relatório gerado automaticamente pelo Sistema de Formulário de Inspeção Visual · Ferroport</p>
          <p>Página de relatório técnico para fins de controle e conformidade com normas regulamentadoras vigentes.</p>
        </footer>
      </div>
    </div>
  );
}

/**
 * Inspector Panel for projection quality visualization controls
 */
import React, { useState } from 'react';
import { usePhylo } from '../context/PhyloContext';
import styles from './InspectorPanel.module.css';

interface Tab {
  id: 'aggregated' | 'false-neighbors' | 'missing-neighbors' | 'groups' | 'compare';
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'aggregated', label: 'Erro Agregado', icon: '📊' },
  { id: 'false-neighbors', label: 'Falsos Vizinhos', icon: '🔍' },
  { id: 'missing-neighbors', label: 'Vizinhos Ausentes', icon: '👻' },
  { id: 'groups', label: 'Análise de Grupo', icon: '👥' },
  { id: 'compare', label: 'Comparar Projeções', icon: '⚖️' }
];

const InspectorPanel: React.FC = () => {
  const {
    qualityMetrics,
    viewSettings,
    setViewSettings,
    isLoading,
    error,
    selectPoint,
    clearCache
  } = usePhylo();

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const handleTabChange = (tabId: Tab['id']) => {
    setViewSettings({ activeView: tabId });
  };

  const handleAlphaChange = (value: number) => {
    setViewSettings({ alpha: value });
  };

  const handlePhiChange = (value: number) => {
    setViewSettings({ phi: value });
  };

  const handleColorMapChange = (colorMap: any) => {
    setViewSettings({ colorMap });
  };

  const toggleDelaunay = () => {
    setViewSettings({ showDelaunay: !viewSettings.showDelaunay });
  };

  const togglePanel = () => {
    setIsPanelCollapsed(!isPanelCollapsed);
  };

  if (isPanelCollapsed) {
    return (
      <div className={styles.collapsedPanel}>
        <button onClick={togglePanel} className={styles.expandButton}>
          ▶ Inspector
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>Inspector de Qualidade</h2>
        <button onClick={togglePanel} className={styles.collapseButton}>
          ◀
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {isLoading && (
        <div className={styles.loading}>
          <span>⏳ Processando...</span>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${viewSettings.activeView === tab.id ? styles.activeTab : ''}`}
            onClick={() => handleTabChange(tab.id)}
            title={tab.label}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {qualityMetrics && (
          <div className={styles.stats}>
            <h3>Estatísticas</h3>
            <div className={styles.statItem}>
              <span>Erro Médio:</span>
              <span>{qualityMetrics.stats.meanError.toFixed(4)}</span>
            </div>
            <div className={styles.statItem}>
              <span>Desvio Padrão:</span>
              <span>{qualityMetrics.stats.stdError.toFixed(4)}</span>
            </div>
            <div className={styles.statItem}>
              <span>Compressão:</span>
              <span>{(qualityMetrics.stats.compressionRatio * 100).toFixed(1)}%</span>
            </div>
            <div className={styles.statItem}>
              <span>Expansão:</span>
              <span>{(qualityMetrics.stats.expansionRatio * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* Contextual Controls */}
        {viewSettings.activeView === 'aggregated' && (
          <div className={styles.controls}>
            <h3>Controles de Visualização</h3>

            <div className={styles.control}>
              <label htmlFor="alpha">
                Suavização (α): {viewSettings.alpha.toFixed(2)}
              </label>
              <input
                id="alpha"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={viewSettings.alpha}
                onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
              />
              <small>Controla a suavização espacial</small>
            </div>

            <div className={styles.control}>
              <label htmlFor="phi">
                Filtro Percentil (φ): {viewSettings.phi}%
              </label>
              <input
                id="phi"
                type="range"
                min="0"
                max="20"
                step="1"
                value={viewSettings.phi}
                onChange={(e) => handlePhiChange(parseInt(e.target.value))}
              />
              <small>Remove {viewSettings.phi}% dos valores extremos</small>
            </div>
          </div>
        )}

        {(viewSettings.activeView === 'false-neighbors' ||
          viewSettings.activeView === 'missing-neighbors') && (
          <div className={styles.controls}>
            <h3>Seleção de Ponto</h3>

            {viewSettings.selectedPoint !== null ? (
              <div className={styles.selectedPoint}>
                <p>Ponto selecionado: <strong>{viewSettings.selectedPoint}</strong></p>
                <button
                  onClick={() => selectPoint(null)}
                  className={styles.clearButton}
                >
                  Limpar Seleção
                </button>
              </div>
            ) : (
              <p className={styles.hint}>
                Clique em um ponto no gráfico para analisar seus vizinhos
              </p>
            )}

            {viewSettings.activeView === 'false-neighbors' && (
              <div className={styles.control}>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.showDelaunay}
                    onChange={toggleDelaunay}
                  />
                  Mostrar Triangulação de Delaunay
                </label>
              </div>
            )}
          </div>
        )}

        {/* Color Map Selection */}
        <div className={styles.controls}>
          <h3>Mapa de Cores</h3>
          <select
            value={viewSettings.colorMap}
            onChange={(e) => handleColorMapChange(e.target.value)}
            className={styles.select}
          >
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
            <option value="inferno">Inferno</option>
            <option value="coolwarm">Cool/Warm</option>
          </select>
        </div>

        {/* Cache Management */}
        <div className={styles.cacheSection}>
          <button
            onClick={clearCache}
            className={styles.clearCacheButton}
            title="Limpar cache e recalcular métricas"
          >
            🗑️ Limpar Cache
          </button>
        </div>
      </div>
    </div>
  );
};

export default InspectorPanel;
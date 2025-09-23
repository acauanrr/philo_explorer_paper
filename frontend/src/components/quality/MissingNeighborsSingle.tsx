/**
 * MissingNeighborsSingle component
 * Visualizes missing neighbors for a selected point with interactive controls
 */
import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { usePhylo } from '../../context/PhyloContext';
import EdgesLayer from './EdgesLayer';
import AggregatedErrorView from './AggregatedErrorView';
import { Point2D } from './shepard';
import styles from './MissingNeighborsSingle.module.css';

interface MissingNeighborsSingleProps {
  width?: number;
  height?: number;
  className?: string;
}

const MissingNeighborsSingle: React.FC<MissingNeighborsSingleProps> = ({
  width = 800,
  height = 600,
  className
}) => {
  const {
    projectionData,
    qualityMetrics,
    viewSettings,
    phiSingle,
    onlyTopK,
    missingNeighborsOfI,
    isLoading,
    error,
    setSelectedPoint,
    setPhiSingle,
    setOnlyTopK,
    fetchMissingNeighborsSingle
  } = usePhylo();

  const [localPhi, setLocalPhi] = useState(phiSingle * 100); // Convert to percentage
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Calculate data bounds
  const dataBounds = useMemo(() => {
    if (!projectionData?.lowDimPoints || projectionData.lowDimPoints.length === 0) {
      return {
        xDomain: [0, 1] as [number, number],
        yDomain: [0, 1] as [number, number]
      };
    }

    const points = projectionData.lowDimPoints;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);

    const padding = 0.1;
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);

    return {
      xDomain: [
        Math.min(...xs) - xRange * padding,
        Math.max(...xs) + xRange * padding
      ] as [number, number],
      yDomain: [
        Math.min(...ys) - yRange * padding,
        Math.max(...ys) + yRange * padding
      ] as [number, number]
    };
  }, [projectionData?.lowDimPoints]);

  /**
   * Handle phi slider change with debouncing
   */
  const handlePhiChange = useCallback((value: number) => {
    setLocalPhi(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      const phiDecimal = value / 100;
      setPhiSingle(phiDecimal);

      // Re-fetch if point is selected
      if (viewSettings.selectedPoint !== null) {
        fetchMissingNeighborsSingle(viewSettings.selectedPoint, phiDecimal);
      }
    }, 200); // 200ms debounce

  }, [setPhiSingle, fetchMissingNeighborsSingle, viewSettings.selectedPoint]);

  /**
   * Handle top-K toggle
   */
  const handleTopKToggle = useCallback(() => {
    setOnlyTopK(!onlyTopK);

    // Re-fetch to apply new filter
    if (viewSettings.selectedPoint !== null) {
      fetchMissingNeighborsSingle(viewSettings.selectedPoint, phiSingle);
    }
  }, [onlyTopK, setOnlyTopK, fetchMissingNeighborsSingle, viewSettings.selectedPoint, phiSingle]);

  /**
   * Handle point selection from AggregatedErrorView
   */
  const handlePointClick = useCallback((index: number) => {
    setSelectedPoint(index);
    fetchMissingNeighborsSingle(index, phiSingle);
  }, [setSelectedPoint, fetchMissingNeighborsSingle, phiSingle]);

  /**
   * Clear selection
   */
  const handleClearSelection = useCallback(() => {
    setSelectedPoint(null);
  }, [setSelectedPoint]);

  // Effect: Auto-fetch when view becomes active
  useEffect(() => {
    if (viewSettings.activeView === 'missing-neighbors' &&
        viewSettings.selectedPoint !== null &&
        !missingNeighborsOfI) {
      fetchMissingNeighborsSingle(viewSettings.selectedPoint, phiSingle);
    }
  }, [viewSettings.activeView, viewSettings.selectedPoint, phiSingle, missingNeighborsOfI, fetchMissingNeighborsSingle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const hasData = projectionData?.lowDimPoints && qualityMetrics?.aggregatedErrors;

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Controls Panel */}
      <div className={styles.controlsPanel}>
        <h3>Missing Neighbors Analysis</h3>

        {/* Point Selection Status */}
        <div className={styles.selectionStatus}>
          {viewSettings.selectedPoint !== null ? (
            <>
              <span className={styles.statusLabel}>Selected Point:</span>
              <span className={styles.pointId}>{viewSettings.selectedPoint}</span>
              <button
                className={styles.clearButton}
                onClick={handleClearSelection}
                title="Clear selection"
              >
                ✕
              </button>
            </>
          ) : (
            <span className={styles.hint}>Click on a point to analyze its missing neighbors</span>
          )}
        </div>

        {/* Phi Slider */}
        <div className={styles.control}>
          <label htmlFor="phi-slider">
            Percentile Filter (φ): <strong>{localPhi.toFixed(0)}%</strong>
          </label>
          <input
            id="phi-slider"
            type="range"
            min="1"
            max="20"
            step="1"
            value={localPhi}
            onChange={(e) => handlePhiChange(Number(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.sliderHint}>
            Shows top {localPhi}% of missing neighbors by error magnitude
          </span>
        </div>

        {/* Top-K Toggle */}
        <div className={styles.control}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={onlyTopK}
              onChange={handleTopKToggle}
            />
            <span>Show only top-k neighbors</span>
          </label>
        </div>

        {/* Statistics */}
        {missingNeighborsOfI && (
          <div className={styles.stats}>
            <h4>Statistics</h4>
            <div className={styles.statItem}>
              <span>Neighbors Found:</span>
              <strong>{missingNeighborsOfI.stats.count}</strong>
            </div>
            <div className={styles.statItem}>
              <span>Max Error:</span>
              <strong>{missingNeighborsOfI.stats.max.toFixed(4)}</strong>
            </div>
            <div className={styles.statItem}>
              <span>Min Error:</span>
              <strong>{missingNeighborsOfI.stats.min.toFixed(4)}</strong>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Analyzing neighbors...</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className={styles.error}>
            <span>⚠️ {error}</span>
          </div>
        )}
      </div>

      {/* Visualization Area */}
      <div className={styles.visualizationArea} style={{ width, height }}>
        {hasData ? (
          <>
            {/* Base scatter plot with heatmap */}
            <AggregatedErrorView
              width={width}
              height={height}
              onPointClick={handlePointClick}
            />

            {/* Edges overlay */}
            {projectionData.lowDimPoints && missingNeighborsOfI && (
              <EdgesLayer
                width={width}
                height={height}
                lowDimPoints={projectionData.lowDimPoints as Point2D[]}
                selectedPoint={viewSettings.selectedPoint}
                neighbors={missingNeighborsOfI.neighbors}
                xDomain={dataBounds.xDomain}
                yDomain={dataBounds.yDomain}
                edgeColor={(weight) => {
                  // Red gradient based on error magnitude
                  const intensity = Math.floor(100 + weight * 155);
                  return `rgb(${intensity}, ${50}, ${50})`;
                }}
                edgeWidth={(weight) => 1 + weight * 2}
                edgeAlpha={(weight) => 0.3 + weight * 0.5}
                renderMode="batch"
                maxEdges={onlyTopK ? 100 : 500}
              />
            )}
          </>
        ) : (
          <div className={styles.noData}>
            <span>No projection data available</span>
            <p>Load projection data to begin analysis</p>
          </div>
        )}
      </div>

      {/* Performance Indicator */}
      {missingNeighborsOfI && missingNeighborsOfI.stats.count > 100 && (
        <div className={styles.performanceWarning}>
          <span>⚡ Rendering {missingNeighborsOfI.stats.count} edges</span>
          {missingNeighborsOfI.stats.count > 1000 && (
            <span className={styles.suggestion}>
              Consider enabling "Show only top-k" for better performance
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MissingNeighborsSingle;
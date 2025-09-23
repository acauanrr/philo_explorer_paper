/**
 * AggregatedErrorView component
 * High-performance heatmap visualization using Shepard interpolation
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  buildIndex,
  smoothInterpolateGrid,
  createCoordinateTransforms,
  Point2D
} from './shepard';
import { useDevicePixelRatio, setupHighDPICanvas } from './useDevicePixelRatio';
import { usePhylo } from '../../context/PhyloContext';
import styles from './AggregatedErrorView.module.css';

// Performance monitoring
const PERFORMANCE_LOG = false;

interface AggregatedErrorViewProps {
  width?: number;
  height?: number;
  className?: string;
  onPointHover?: (index: number | null, point: Point2D | null) => void;
  onPointClick?: (index: number, point: Point2D) => void;
}

const AggregatedErrorView: React.FC<AggregatedErrorViewProps> = ({
  width = 800,
  height = 600,
  className,
  onPointHover,
  onPointClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastRenderTime = useRef<number>(0);

  const pixelRatio = useDevicePixelRatio();
  const { projectionData, qualityMetrics, viewSettings, isLoading } = usePhylo();

  const [isRendering, setIsRendering] = useState(false);
  const [renderStats, setRenderStats] = useState({
    points: 0,
    renderTime: 0,
    fps: 0
  });

  // Debounced render parameters
  const renderParams = useMemo(() => ({
    power: viewSettings.alpha * 4 + 0.5, // Map alpha [0,1] to power [0.5, 4.5]
    k: Math.min(24, Math.max(8, Math.floor(viewSettings.phi / 20 * 16 + 8))), // 8-24 neighbors
    gridStepPx: Math.max(2, Math.min(8, Math.floor(8 - viewSettings.alpha * 4))), // 2-8px
    alpha: 0.7 + viewSettings.alpha * 0.3, // 0.7-1.0 opacity
    colormap: viewSettings.colorMap
  }), [viewSettings.alpha, viewSettings.phi, viewSettings.colorMap]);

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
   * Main render function
   */
  const renderHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;
    if (!projectionData?.lowDimPoints || !qualityMetrics?.aggregatedErrors) return;

    const startTime = performance.now();
    setIsRendering(true);

    // Setup high-DPI canvas
    setupHighDPICanvas(canvas, ctx, width, height, pixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Build spatial index
    const points = projectionData.lowDimPoints as Point2D[];
    const values = qualityMetrics.aggregatedErrors;

    if (points.length === 0) {
      setIsRendering(false);
      return;
    }

    const index = buildIndex(points);

    // Create coordinate transforms
    const { dataToScreen, screenToData } = createCoordinateTransforms(
      dataBounds.xDomain,
      dataBounds.yDomain,
      width,
      height
    );

    // Calculate value range for clamping
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Render interpolated heatmap
    try {
      smoothInterpolateGrid({
        canvasCtx: ctx,
        width: width * pixelRatio,
        height: height * pixelRatio,
        dataToScreen,
        screenToData: (p: Point2D) => {
          // Account for pixel ratio in screen to data conversion
          return screenToData([p[0] / pixelRatio, p[1] / pixelRatio]);
        },
        index,
        points,
        values,
        k: renderParams.k,
        power: renderParams.power,
        gridStepPx: renderParams.gridStepPx * pixelRatio,
        clampMin: minValue,
        clampMax: maxValue,
        alpha: renderParams.alpha,
        colormap: renderParams.colormap
      });

      // Render scatter points on overlay canvas
      renderScatterPoints(points, values, minValue, maxValue, dataToScreen);

    } catch (error) {
      console.error('Error rendering heatmap:', error);
    }

    // Update stats
    const renderTime = performance.now() - startTime;
    const fps = lastRenderTime.current > 0 ? 1000 / (startTime - lastRenderTime.current) : 0;
    lastRenderTime.current = startTime;

    setRenderStats({
      points: points.length,
      renderTime,
      fps
    });

    if (PERFORMANCE_LOG) {
      console.log(`Rendered ${points.length} points in ${renderTime.toFixed(1)}ms (${fps.toFixed(1)} FPS)`);
    }

    setIsRendering(false);
  }, [
    projectionData?.lowDimPoints,
    qualityMetrics?.aggregatedErrors,
    width,
    height,
    pixelRatio,
    renderParams,
    dataBounds
  ]);

  /**
   * Render scatter points on overlay
   */
  const renderScatterPoints = useCallback((
    points: Point2D[],
    values: number[],
    minValue: number,
    maxValue: number,
    dataToScreen: (p: Point2D) => Point2D
  ) => {
    const canvas = overlayCanvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    setupHighDPICanvas(canvas, ctx, width, height, pixelRatio);
    ctx.clearRect(0, 0, width, height);

    // Draw points
    points.forEach((point, i) => {
      const [x, y] = dataToScreen(point);

      // Point size based on error magnitude
      const normalizedError = (values[i] - minValue) / (maxValue - minValue);
      const size = 2 + normalizedError * 3;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);

      // Color based on selected state
      if (viewSettings.selectedPoint === i) {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(50, 50, 50, ${0.3 + normalizedError * 0.4})`;
        ctx.fill();
      }
    });
  }, [width, height, pixelRatio, viewSettings.selectedPoint]);

  /**
   * Handle mouse interaction
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!projectionData?.lowDimPoints || !onPointHover) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { screenToData } = createCoordinateTransforms(
      dataBounds.xDomain,
      dataBounds.yDomain,
      width,
      height
    );

    const dataPoint = screenToData([x, y]);

    // Find nearest point
    const points = projectionData.lowDimPoints as Point2D[];
    let minDist = Infinity;
    let nearestIdx = -1;

    points.forEach((point, i) => {
      const dist = Math.hypot(point[0] - dataPoint[0], point[1] - dataPoint[1]);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    });

    // Threshold for hover detection (in data space)
    const threshold = 0.05 * Math.max(
      dataBounds.xDomain[1] - dataBounds.xDomain[0],
      dataBounds.yDomain[1] - dataBounds.yDomain[0]
    );

    if (minDist < threshold && nearestIdx >= 0) {
      onPointHover(nearestIdx, points[nearestIdx]);
    } else {
      onPointHover(null, null);
    }
  }, [projectionData?.lowDimPoints, onPointHover, dataBounds, width, height]);

  const handleMouseLeave = useCallback(() => {
    onPointHover?.(null, null);
  }, [onPointHover]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!projectionData?.lowDimPoints || !onPointClick) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { screenToData } = createCoordinateTransforms(
      dataBounds.xDomain,
      dataBounds.yDomain,
      width,
      height
    );

    const dataPoint = screenToData([x, y]);

    // Find nearest point
    const points = projectionData.lowDimPoints as Point2D[];
    let minDist = Infinity;
    let nearestIdx = -1;

    points.forEach((point, i) => {
      const dist = Math.hypot(point[0] - dataPoint[0], point[1] - dataPoint[1]);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    });

    const threshold = 0.05 * Math.max(
      dataBounds.xDomain[1] - dataBounds.xDomain[0],
      dataBounds.yDomain[1] - dataBounds.yDomain[0]
    );

    if (minDist < threshold && nearestIdx >= 0) {
      onPointClick(nearestIdx, points[nearestIdx]);
    }
  }, [projectionData?.lowDimPoints, onPointClick, dataBounds, width, height]);

  // Effect: Re-render on data or settings change
  useEffect(() => {
    // Cancel any pending animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Schedule render
    animationRef.current = requestAnimationFrame(() => {
      renderHeatmap();
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [renderHeatmap]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} style={{ width, height }}>
        <div className={styles.loading}>
          <span>Loading projection quality...</span>
        </div>
      </div>
    );
  }

  // No data state
  if (!projectionData?.lowDimPoints || !qualityMetrics?.aggregatedErrors) {
    return (
      <div className={`${styles.container} ${className}`} style={{ width, height }}>
        <div className={styles.noData}>
          <span>No projection data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className={styles.heatmapCanvas}
        style={{ width, height }}
      />
      <canvas
        ref={overlayCanvasRef}
        className={styles.overlayCanvas}
        style={{ width, height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* Performance stats overlay */}
      {PERFORMANCE_LOG && (
        <div className={styles.stats}>
          <span>Points: {renderStats.points}</span>
          <span>Render: {renderStats.renderTime.toFixed(1)}ms</span>
          <span>FPS: {renderStats.fps.toFixed(1)}</span>
        </div>
      )}

      {/* Rendering indicator */}
      {isRendering && (
        <div className={styles.renderingIndicator}>
          <div className={styles.spinner} />
        </div>
      )}
    </div>
  );
};

export default AggregatedErrorView;
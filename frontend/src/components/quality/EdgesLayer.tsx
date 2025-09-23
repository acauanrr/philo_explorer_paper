/**
 * EdgesLayer component for rendering connections between points
 * Optimized for high-performance edge rendering with thousands of connections
 */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useDevicePixelRatio, setupHighDPICanvas } from './useDevicePixelRatio';
import { createCoordinateTransforms, Point2D } from './shepard';
import { getColormap } from './colorMaps';

interface Edge {
  source: number;
  target: number;
  weight: number; // Error value, normalized
}

interface EdgesLayerProps {
  width: number;
  height: number;
  lowDimPoints: Point2D[];
  selectedPoint: number | null;
  neighbors: Array<{ target: number; error: number }> | null;
  maxEdges?: number; // Maximum edges to render for performance
  edgeColor?: string | ((weight: number) => string);
  edgeWidth?: number | ((weight: number) => number);
  edgeAlpha?: number | ((weight: number) => number);
  xDomain: [number, number];
  yDomain: [number, number];
  className?: string;
  renderMode?: 'immediate' | 'batch' | 'animated';
}

const EdgesLayer: React.FC<EdgesLayerProps> = ({
  width,
  height,
  lowDimPoints,
  selectedPoint,
  neighbors,
  maxEdges = 5000,
  edgeColor = 'red',
  edgeWidth = 1,
  edgeAlpha = (w) => 0.3 + w * 0.7,
  xDomain,
  yDomain,
  className,
  renderMode = 'batch'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const pixelRatio = useDevicePixelRatio();

  // Performance tracking
  const renderStatsRef = useRef({
    edgesRendered: 0,
    renderTime: 0,
    lastFrameTime: 0
  });

  // Create coordinate transforms
  const { dataToScreen } = useMemo(
    () => createCoordinateTransforms(xDomain, yDomain, width, height),
    [xDomain, yDomain, width, height]
  );

  // Prepare edges data
  const edges = useMemo<Edge[]>(() => {
    if (!neighbors || selectedPoint === null || !lowDimPoints[selectedPoint]) {
      return [];
    }

    // Normalize errors for visualization
    const errors = neighbors.map(n => n.error);
    const maxError = Math.max(...errors, 0.001);
    const minError = Math.min(...errors, 0);

    return neighbors
      .slice(0, maxEdges)
      .map(neighbor => ({
        source: selectedPoint,
        target: neighbor.target,
        weight: (neighbor.error - minError) / (maxError - minError)
      }));
  }, [neighbors, selectedPoint, lowDimPoints, maxEdges]);

  /**
   * Render edges with different strategies based on count
   */
  const renderEdges = useCallback((ctx: CanvasRenderingContext2D) => {
    if (edges.length === 0 || !lowDimPoints[selectedPoint!]) return;

    const startTime = performance.now();
    const sourcePoint = lowDimPoints[selectedPoint!];
    const [sx, sy] = dataToScreen(sourcePoint);

    // Configure rendering based on edge count
    const useComplexBlending = edges.length < 100;
    const batchSize = edges.length < 1000 ? edges.length : 100;

    if (useComplexBlending) {
      ctx.globalCompositeOperation = 'screen'; // Additive blending for few edges
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // Render edges in batches for better performance
    let edgesRendered = 0;

    const renderBatch = (startIdx: number, endIdx: number) => {
      for (let i = startIdx; i < endIdx && i < edges.length; i++) {
        const edge = edges[i];
        const targetPoint = lowDimPoints[edge.target];

        if (!targetPoint) continue;

        const [tx, ty] = dataToScreen(targetPoint);

        // Calculate alpha based on weight
        const alpha = typeof edgeAlpha === 'function'
          ? edgeAlpha(edge.weight)
          : edgeAlpha;

        // Calculate line width based on weight
        const lineWidth = typeof edgeWidth === 'function'
          ? edgeWidth(edge.weight)
          : edgeWidth;

        // Set edge style
        ctx.globalAlpha = alpha;
        ctx.lineWidth = lineWidth;

        if (typeof edgeColor === 'function') {
          ctx.strokeStyle = edgeColor(edge.weight);
        } else if (typeof edgeColor === 'string') {
          // Use gradient for single color
          const gradient = ctx.createLinearGradient(sx, sy, tx, ty);
          gradient.addColorStop(0, edgeColor);
          gradient.addColorStop(1, `${edgeColor}88`); // Fade at target
          ctx.strokeStyle = gradient;
        }

        // Draw edge
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        edgesRendered++;
      }
    };

    if (renderMode === 'animated') {
      // Animated rendering for smooth appearance
      let currentBatch = 0;

      const animateEdges = () => {
        const startIdx = currentBatch * batchSize;
        const endIdx = Math.min(startIdx + batchSize, edges.length);

        renderBatch(startIdx, endIdx);
        currentBatch++;

        if (endIdx < edges.length) {
          animationRef.current = requestAnimationFrame(animateEdges);
        } else {
          // Rendering complete
          const renderTime = performance.now() - startTime;
          renderStatsRef.current = {
            edgesRendered,
            renderTime,
            lastFrameTime: performance.now()
          };
          console.log(`Rendered ${edgesRendered} edges in ${renderTime.toFixed(1)}ms`);
        }
      };

      animateEdges();
    } else {
      // Immediate or batch rendering
      if (renderMode === 'batch') {
        // Render in chunks with RAF
        for (let i = 0; i < edges.length; i += batchSize) {
          renderBatch(i, Math.min(i + batchSize, edges.length));
        }
      } else {
        // Immediate rendering (all at once)
        renderBatch(0, edges.length);
      }

      const renderTime = performance.now() - startTime;
      renderStatsRef.current = {
        edgesRendered,
        renderTime,
        lastFrameTime: performance.now()
      };
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

  }, [edges, lowDimPoints, selectedPoint, dataToScreen, edgeColor, edgeWidth, edgeAlpha, renderMode]);

  /**
   * Render highlighted points (targets)
   */
  const renderHighlightedPoints = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!neighbors || !lowDimPoints) return;

    const colormap = getColormap('plasma');

    // Sort neighbors by error for consistent rendering
    const sortedNeighbors = [...neighbors].sort((a, b) => a.error - b.error);
    const maxError = Math.max(...sortedNeighbors.map(n => n.error), 0.001);

    sortedNeighbors.forEach(neighbor => {
      const point = lowDimPoints[neighbor.target];
      if (!point) return;

      const [x, y] = dataToScreen(point);
      const normalizedError = neighbor.error / maxError;

      // Get color from colormap
      const [r, g, b] = colormap(normalizedError);

      // Draw point with size based on error
      const radius = 3 + normalizedError * 4;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      // Add border for visibility
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Highlight source point
    if (selectedPoint !== null && lowDimPoints[selectedPoint]) {
      const sourcePoint = lowDimPoints[selectedPoint];
      const [sx, sy] = dataToScreen(sourcePoint);

      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

  }, [neighbors, lowDimPoints, selectedPoint, dataToScreen]);

  /**
   * Main render function
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Setup high-DPI canvas
    setupHighDPICanvas(canvas, ctx, width, height, pixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (edges.length === 0) return;

    // Save context state
    ctx.save();

    // Render edges
    renderEdges(ctx);

    // Render highlighted points
    renderHighlightedPoints(ctx);

    // Restore context state
    ctx.restore();

  }, [width, height, pixelRatio, edges, renderEdges, renderHighlightedPoints]);

  // Effect: Re-render when data changes
  useEffect(() => {
    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // Effect: Clear when no selection
  useEffect(() => {
    if (selectedPoint === null) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [selectedPoint]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 3
      }}
    />
  );
};

export default EdgesLayer;
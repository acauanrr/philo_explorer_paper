/**
 * Hook for handling high-DPI displays (Retina, etc.)
 */
import { useEffect, useState } from 'react';

/**
 * Custom hook to get and track device pixel ratio
 * Updates when display changes (e.g., moving window between monitors)
 */
export function useDevicePixelRatio(): number {
  const [pixelRatio, setPixelRatio] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.devicePixelRatio || 1;
    }
    return 1;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePixelRatio = () => {
      setPixelRatio(window.devicePixelRatio || 1);
    };

    // Listen for changes in pixel ratio (e.g., zoom, display change)
    const mediaQuery = window.matchMedia(`(resolution: ${pixelRatio}dppx)`);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePixelRatio);
    } else {
      // Legacy browsers
      mediaQuery.addListener(updatePixelRatio);
    }

    // Also listen for resize events which might indicate display change
    window.addEventListener('resize', updatePixelRatio);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updatePixelRatio);
      } else {
        mediaQuery.removeListener(updatePixelRatio);
      }
      window.removeEventListener('resize', updatePixelRatio);
    };
  }, [pixelRatio]);

  return pixelRatio;
}

/**
 * Setup canvas for high-DPI rendering
 * @param canvas - Canvas element
 * @param ctx - Canvas 2D context
 * @param width - Logical width
 * @param height - Logical height
 * @param pixelRatio - Device pixel ratio
 */
export function setupHighDPICanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelRatio: number = window.devicePixelRatio || 1
): void {
  // Set the actual dimensions
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;

  // Set the CSS dimensions
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale the context to match device pixel ratio
  ctx.scale(pixelRatio, pixelRatio);
}

/**
 * Get logical coordinates from mouse/touch event on high-DPI canvas
 * @param event - Mouse or touch event
 * @param canvas - Canvas element
 * @param pixelRatio - Device pixel ratio
 */
export function getLogicalCoordinates(
  event: MouseEvent | TouchEvent,
  canvas: HTMLCanvasElement,
  pixelRatio: number = window.devicePixelRatio || 1
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();

  let clientX: number, clientY: number;

  if ('touches' in event) {
    // Touch event
    clientX = event.touches[0]?.clientX || 0;
    clientY = event.touches[0]?.clientY || 0;
  } else {
    // Mouse event
    clientX = event.clientX;
    clientY = event.clientY;
  }

  // Calculate logical coordinates (accounting for CSS scaling)
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  return { x, y };
}

/**
 * Hook to track canvas size changes
 */
export function useCanvasSize(
  containerRef: React.RefObject<HTMLElement>
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setSize({ width, height });
      }
    };

    // Initial size
    updateSize();

    // Use ResizeObserver if available
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateSize);
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    } else {
      // Fallback to resize event
      window.addEventListener('resize', updateSize);
      return () => {
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [containerRef]);

  return size;
}

/**
 * Utility to create offscreen canvas for double buffering
 * @param width - Canvas width
 * @param height - Canvas height
 * @param pixelRatio - Device pixel ratio
 */
export function createOffscreenCanvas(
  width: number,
  height: number,
  pixelRatio: number = window.devicePixelRatio || 1
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2D context');
  }

  setupHighDPICanvas(canvas, ctx, width, height, pixelRatio);

  return { canvas, ctx };
}

export default {
  useDevicePixelRatio,
  setupHighDPICanvas,
  getLogicalCoordinates,
  useCanvasSize,
  createOffscreenCanvas
};
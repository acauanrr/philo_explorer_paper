/**
 * Shepard interpolation core implementation with KNN indexing
 * High-performance spatial interpolation for heatmap rendering
 */

import KDBush from 'kdbush';
import { getColormap, mapValueToUnit, clamp } from './colorMaps';

export type Point2D = [number, number];

/**
 * Build KD-tree index for fast nearest neighbor queries
 * @param points - Array of 2D points
 * @returns KDBush index instance
 */
export function buildIndex(points: Point2D[]): KDBush<Point2D> {
  const index = new KDBush(points, (p) => p[0], (p) => p[1]);
  return index;
}

/**
 * Find k nearest neighbors using KDBush
 * @param index - KDBush index
 * @param point - Query point [x, y]
 * @param k - Number of neighbors
 * @returns Array of neighbor indices
 */
export function findKNearest(
  index: KDBush<Point2D>,
  point: Point2D,
  k: number
): number[] {
  // Use range query with expanding radius
  const [px, py] = point;

  // Start with a small radius and expand
  let radius = 0.1;
  let neighbors: number[] = [];

  while (neighbors.length < k && radius < 10) {
    neighbors = index.within(px, py, radius);
    radius *= 2;
  }

  // Sort by distance and take k nearest
  const points = index.points;
  neighbors.sort((a, b) => {
    const d1 = Math.hypot(points[a][0] - px, points[a][1] - py);
    const d2 = Math.hypot(points[b][0] - px, points[b][1] - py);
    return d1 - d2;
  });

  return neighbors.slice(0, k);
}

/**
 * Shepard interpolation at a single point
 * @param point - Query point
 * @param dataPoints - Data points
 * @param values - Values at data points
 * @param neighbors - Indices of nearest neighbors
 * @param power - Power parameter (default 2)
 * @returns Interpolated value
 */
export function shepardInterpolate(
  point: Point2D,
  dataPoints: Point2D[],
  values: number[],
  neighbors: number[],
  power: number = 2
): number {
  const epsilon = 1e-12;
  let weightSum = 0;
  let valueSum = 0;

  for (const idx of neighbors) {
    const dataPoint = dataPoints[idx];
    const distance = Math.hypot(dataPoint[0] - point[0], dataPoint[1] - point[1]);

    // Shepard weight: 1 / (d^p + epsilon)
    const weight = 1 / (Math.pow(distance + epsilon, power));

    weightSum += weight;
    valueSum += weight * values[idx];
  }

  return weightSum > 0 ? valueSum / weightSum : 0;
}

/**
 * Parameters for grid interpolation
 */
export interface InterpolateGridParams {
  canvasCtx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dataToScreen: (point: Point2D) => Point2D;
  screenToData: (point: Point2D) => Point2D;
  index: KDBush<Point2D>;
  points: Point2D[];
  values: number[];
  k: number;
  power: number;
  gridStepPx: number;
  clampMin: number;
  clampMax: number;
  alpha: number;
  colormap: string;
}

/**
 * Interpolate and render grid using Shepard interpolation
 * Uses bucket filling for performance optimization
 */
export function interpolateGrid(params: InterpolateGridParams): void {
  const {
    canvasCtx,
    width,
    height,
    screenToData,
    index,
    points,
    values,
    k,
    power,
    gridStepPx,
    clampMin,
    clampMax,
    alpha,
    colormap
  } = params;

  // Create image data for direct pixel manipulation
  const imageData = canvasCtx.createImageData(width, height);
  const data = imageData.data;

  // Get colormap function
  const colormapFn = getColormap(colormap);

  // Performance tracking
  const startTime = performance.now();
  let pixelsProcessed = 0;

  // Process grid with stepping
  for (let y = 0; y < height; y += gridStepPx) {
    for (let x = 0; x < width; x += gridStepPx) {
      // Convert screen coordinates to data space
      const dataPoint = screenToData([x + gridStepPx / 2, y + gridStepPx / 2]);

      // Find k nearest neighbors
      const neighbors = findKNearest(index, dataPoint, k);

      // Interpolate value
      let value = shepardInterpolate(dataPoint, points, values, neighbors, power);

      // Clamp value
      value = clamp(value, clampMin, clampMax);

      // Map to [0, 1] for colormap
      const t = mapValueToUnit(value, clampMin, clampMax);

      // Get color from colormap
      const [r, g, b] = colormapFn(t);

      // Fill bucket (gridStepPx x gridStepPx block)
      const blockWidth = Math.min(gridStepPx, width - x);
      const blockHeight = Math.min(gridStepPx, height - y);

      for (let dy = 0; dy < blockHeight; dy++) {
        for (let dx = 0; dx < blockWidth; dx++) {
          const px = x + dx;
          const py = y + dy;

          if (px < width && py < height) {
            const idx = (py * width + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = Math.round(alpha * 255);
            pixelsProcessed++;
          }
        }
      }
    }

    // Yield to browser periodically for responsiveness
    if (y % (gridStepPx * 10) === 0 && performance.now() - startTime > 16) {
      // Break if taking too long in a single frame
      requestAnimationFrame(() => {
        // Continue in next frame (would need state management for this)
      });
    }
  }

  // Apply the image data to canvas
  canvasCtx.putImageData(imageData, 0, 0);

  // Log performance
  const elapsed = performance.now() - startTime;
  console.log(`Shepard interpolation: ${pixelsProcessed} pixels in ${elapsed.toFixed(1)}ms`);
}

/**
 * Optimized grid interpolation with adaptive quality
 * Adjusts grid step based on point density
 */
export function adaptiveInterpolateGrid(params: InterpolateGridParams): void {
  const { points, width, height } = params;

  // Calculate point density
  const area = width * height;
  const density = points.length / area;

  // Adjust grid step based on density
  let adaptiveStep = params.gridStepPx;
  if (density < 0.001) {
    adaptiveStep = Math.max(6, params.gridStepPx); // Sparse: larger steps
  } else if (density > 0.01) {
    adaptiveStep = Math.max(2, Math.floor(params.gridStepPx / 2)); // Dense: smaller steps
  }

  // Use adjusted parameters
  interpolateGrid({
    ...params,
    gridStepPx: adaptiveStep
  });
}

/**
 * Create a smooth gradient using bilinear interpolation
 * between Shepard-interpolated grid points
 */
export function smoothInterpolateGrid(params: InterpolateGridParams): void {
  const {
    canvasCtx,
    width,
    height,
    screenToData,
    index,
    points,
    values,
    k,
    power,
    gridStepPx,
    clampMin,
    clampMax,
    alpha,
    colormap
  } = params;

  // Create coarse grid of interpolated values
  const gridWidth = Math.ceil(width / gridStepPx);
  const gridHeight = Math.ceil(height / gridStepPx);
  const gridValues: number[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(0));

  // Compute Shepard interpolation at grid points
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const x = gx * gridStepPx;
      const y = gy * gridStepPx;
      const dataPoint = screenToData([x, y]);
      const neighbors = findKNearest(index, dataPoint, k);
      gridValues[gy][gx] = shepardInterpolate(dataPoint, points, values, neighbors, power);
    }
  }

  // Create image data
  const imageData = canvasCtx.createImageData(width, height);
  const data = imageData.data;
  const colormapFn = getColormap(colormap);

  // Bilinear interpolation for smooth rendering
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Find grid cell
      const gx = x / gridStepPx;
      const gy = y / gridStepPx;
      const gx0 = Math.floor(gx);
      const gy0 = Math.floor(gy);
      const gx1 = Math.min(gx0 + 1, gridWidth - 1);
      const gy1 = Math.min(gy0 + 1, gridHeight - 1);

      // Bilinear weights
      const wx = gx - gx0;
      const wy = gy - gy0;

      // Get corner values
      const v00 = gridValues[gy0][gx0];
      const v10 = gridValues[gy0][gx1];
      const v01 = gridValues[gy1][gx0];
      const v11 = gridValues[gy1][gx1];

      // Bilinear interpolation
      const v0 = v00 * (1 - wx) + v10 * wx;
      const v1 = v01 * (1 - wx) + v11 * wx;
      let value = v0 * (1 - wy) + v1 * wy;

      // Clamp and map to color
      value = clamp(value, clampMin, clampMax);
      const t = mapValueToUnit(value, clampMin, clampMax);
      const [r, g, b] = colormapFn(t);

      // Set pixel
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  canvasCtx.putImageData(imageData, 0, 0);
}

/**
 * Utility to transform coordinates between data and screen space
 */
export function createCoordinateTransforms(
  xDomain: [number, number],
  yDomain: [number, number],
  width: number,
  height: number
) {
  const xScale = (x: number) => ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * width;
  const yScale = (y: number) => height - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * height;

  const xInverse = (x: number) => (x / width) * (xDomain[1] - xDomain[0]) + xDomain[0];
  const yInverse = (y: number) => ((height - y) / height) * (yDomain[1] - yDomain[0]) + yDomain[0];

  return {
    dataToScreen: (point: Point2D): Point2D => [xScale(point[0]), yScale(point[1])],
    screenToData: (point: Point2D): Point2D => [xInverse(point[0]), yInverse(point[1])]
  };
}

// Install KDBush types if needed
declare module 'kdbush' {
  export default class KDBush<T> {
    constructor(
      points: T[],
      getX: (p: T) => number,
      getY: (p: T) => number,
      nodeSize?: number,
      arrayType?: typeof Float32Array | typeof Float64Array
    );

    points: T[];
    range(minX: number, minY: number, maxX: number, maxY: number): number[];
    within(x: number, y: number, radius: number): number[];
  }
}
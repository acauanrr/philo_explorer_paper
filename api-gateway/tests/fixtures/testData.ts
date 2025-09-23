/**
 * Test fixtures for E2E cache testing
 */

/**
 * Simple 2D projection data for testing
 * 5 points in 2D space forming a pattern
 */
export const simple2DProjection = {
  high_dim_points: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0.5, 0.5]
  ],
  low_dim_points: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1.1, 1.1], // Slight distortion
    [0.5, 0.5]
  ]
};

/**
 * Medium-sized test data (50 points)
 */
export const medium3DProjection = {
  high_dim_points: Array.from({ length: 50 }, (_, i) => [
    Math.sin(i * 0.1),
    Math.cos(i * 0.1),
    i * 0.1
  ]),
  low_dim_points: Array.from({ length: 50 }, (_, i) => [
    Math.sin(i * 0.1) * (1 + Math.random() * 0.1),
    Math.cos(i * 0.1) * (1 + Math.random() * 0.1)
  ])
};

/**
 * Test data with known cache key for validation
 * This data should always produce the same cache key
 */
export const deterministicProjection = {
  high_dim_points: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ],
  low_dim_points: [
    [1, 2],
    [3, 4],
    [5, 6]
  ],
  robust_scaling: false
};

/**
 * Different projection with same dimensions
 * Used to test that different data produces different cache keys
 */
export const alternativeProjection = {
  high_dim_points: [
    [2, 3, 4],
    [5, 6, 7],
    [8, 9, 10]
  ],
  low_dim_points: [
    [2, 3],
    [4, 5],
    [6, 7]
  ],
  robust_scaling: false
};

/**
 * Test groups for group analysis endpoint
 */
export const testGroups = {
  groups: [0, 0, 1, 1, 2] // 3 groups for 5-point dataset
};

/**
 * Multiple projections for comparison endpoint
 */
export const multipleProjections = {
  high_dim_points: simple2DProjection.high_dim_points,
  projections: {
    'method_a': simple2DProjection.low_dim_points,
    'method_b': [
      [0.1, 0.1],
      [0.9, 0.1],
      [0.1, 0.9],
      [0.9, 0.9],
      [0.5, 0.5]
    ],
    'method_c': [
      [-0.1, -0.1],
      [1.1, -0.1],
      [-0.1, 1.1],
      [1.1, 1.1],
      [0.5, 0.5]
    ]
  }
};

/**
 * Invalid test data for error cases
 */
export const invalidData = {
  mismatchedLengths: {
    high_dim_points: [[1, 2], [3, 4]],
    low_dim_points: [[1, 2], [3, 4], [5, 6]] // Different length
  },
  missingFields: {
    high_dim_points: [[1, 2]]
    // Missing low_dim_points
  },
  invalidPointIndex: {
    cacheKey: 'test-key',
    pointIndex: 999 // Out of bounds
  }
};

/**
 * Expected response structure for validation
 */
export interface ExpectedErrorsResponse {
  cacheKey: string;
  aggregated_errors: number[];
  stats: {
    mean_error: number;
    std_error: number;
    min_error: number;
    max_error: number;
    compression_ratio: number;
    expansion_ratio: number;
  };
  cached: boolean;
}

/**
 * Helper to generate large dataset for performance testing
 */
export function generateLargeDataset(n: number = 1000, d_high: number = 10, d_low: number = 2) {
  const high_dim_points = Array.from({ length: n }, () =>
    Array.from({ length: d_high }, () => Math.random())
  );

  const low_dim_points = Array.from({ length: n }, () =>
    Array.from({ length: d_low }, () => Math.random())
  );

  return { high_dim_points, low_dim_points };
}

/**
 * Helper to create deterministic data with known properties
 */
export function createDeterministicData(seed: number = 42) {
  // Simple pseudo-random generator with seed
  let x = seed;
  const random = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };

  const n = 10;
  const high_dim_points = Array.from({ length: n }, () =>
    Array.from({ length: 3 }, () => random())
  );

  const low_dim_points = Array.from({ length: n }, () =>
    Array.from({ length: 2 }, () => random())
  );

  return { high_dim_points, low_dim_points };
}
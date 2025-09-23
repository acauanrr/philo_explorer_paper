/**
 * Phylo Explorer Context for managing projection quality state
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types
export interface ProjectionData {
  highDimPoints: number[][];
  lowDimPoints: number[][];
  groups?: number[];
  labels?: string[];
}

export interface QualityMetrics {
  cacheKey: string;
  aggregatedErrors: number[];
  stats: {
    meanError: number;
    stdError: number;
    minError: number;
    maxError: number;
    compressionRatio: number;
    expansionRatio: number;
  };
}

export interface ViewSettings {
  activeView: 'aggregated' | 'false-neighbors' | 'missing-neighbors' | 'groups' | 'compare';
  alpha: number; // Smoothing parameter for aggregated view
  phi: number; // Percentile filter (0-20%)
  selectedPoint: number | null;
  showDelaunay: boolean;
  colorMap: 'viridis' | 'plasma' | 'inferno' | 'coolwarm';
}

export interface MissingNeighborsData {
  source: number;
  neighbors: Array<{ target: number; error: number }>;
  stats: {
    max: number;
    min: number;
    count: number;
  };
  phi: number;
}

export interface PhyloContextType {
  // Data
  projectionData: ProjectionData | null;
  qualityMetrics: QualityMetrics | null;
  isLoading: boolean;
  error: string | null;

  // View settings
  viewSettings: ViewSettings;

  // Missing neighbors specific
  phiSingle: number;
  onlyTopK: boolean;
  missingNeighborsOfI: MissingNeighborsData | null;

  // Actions
  loadProjectionData: (data: ProjectionData) => Promise<void>;
  computeQualityMetrics: (robustScaling?: boolean) => Promise<void>;
  setViewSettings: (settings: Partial<ViewSettings>) => void;
  clearData: () => void;

  // Point selection
  selectPoint: (index: number | null) => void;
  setSelectedPoint: (index: number | null) => void;
  getPointErrors: (pointIndex: number) => Promise<any>;

  // Missing neighbors actions
  setPhiSingle: (value: number) => void;
  setOnlyTopK: (value: boolean) => void;
  fetchMissingNeighborsSingle: (pointIndex: number, phi: number) => Promise<void>;

  // Cache management
  cacheKey: string | null;
  clearCache: () => Promise<void>;
}

// Default view settings
const defaultViewSettings: ViewSettings = {
  activeView: 'aggregated',
  alpha: 0.5,
  phi: 10,
  selectedPoint: null,
  showDelaunay: false,
  colorMap: 'viridis'
};

// Create context
const PhyloContext = createContext<PhyloContextType | undefined>(undefined);

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * PhyloProvider component
 */
export const PhyloProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projectionData, setProjectionData] = useState<ProjectionData | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewSettings, setViewSettingsState] = useState<ViewSettings>(defaultViewSettings);

  // Missing neighbors specific state
  const [phiSingle, setPhiSingle] = useState(0.05); // Default 5%
  const [onlyTopK, setOnlyTopK] = useState(true);
  const [missingNeighborsOfI, setMissingNeighborsOfI] = useState<MissingNeighborsData | null>(null);

  /**
   * Load projection data
   */
  const loadProjectionData = useCallback(async (data: ProjectionData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate data
      if (!data.highDimPoints || !data.lowDimPoints) {
        throw new Error('Invalid projection data: missing points');
      }

      if (data.highDimPoints.length !== data.lowDimPoints.length) {
        throw new Error('High and low dimensional points must have same count');
      }

      setProjectionData(data);

      // Auto-compute quality metrics
      await computeQualityMetrics();

    } catch (err: any) {
      setError(err.message || 'Failed to load projection data');
      console.error('Error loading projection data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Compute quality metrics
   */
  const computeQualityMetrics = useCallback(async (robustScaling = false) => {
    if (!projectionData) {
      setError('No projection data loaded');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/phylo/quality/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          high_dim_points: projectionData.highDimPoints,
          low_dim_points: projectionData.lowDimPoints,
          robust_scaling: robustScaling
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setQualityMetrics({
        cacheKey: data.cacheKey,
        aggregatedErrors: data.aggregated_errors,
        stats: {
          meanError: data.stats.mean_error,
          stdError: data.stats.std_error,
          minError: data.stats.min_error,
          maxError: data.stats.max_error,
          compressionRatio: data.stats.compression_ratio,
          expansionRatio: data.stats.expansion_ratio
        }
      });

      setCacheKey(data.cacheKey);

      console.log(`Quality metrics computed (${data.cached ? 'cached' : 'fresh'})`);

    } catch (err: any) {
      setError(err.message || 'Failed to compute quality metrics');
      console.error('Error computing quality metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectionData]);

  /**
   * Update view settings
   */
  const setViewSettings = useCallback((settings: Partial<ViewSettings>) => {
    setViewSettingsState(prev => ({
      ...prev,
      ...settings
    }));
  }, []);

  /**
   * Select a point
   */
  const selectPoint = useCallback((index: number | null) => {
    setViewSettings({ selectedPoint: index });

    // Auto-fetch missing neighbors if in missing-neighbors view
    if (index !== null && viewSettings.activeView === 'missing-neighbors') {
      fetchMissingNeighborsSingle(index, phiSingle);
    } else if (index === null) {
      setMissingNeighborsOfI(null);
    }
  }, [setViewSettings, viewSettings.activeView, phiSingle]);

  /**
   * Set selected point directly
   */
  const setSelectedPoint = useCallback((index: number | null) => {
    selectPoint(index);
  }, [selectPoint]);

  /**
   * Get point-specific errors
   */
  const getPointErrors = useCallback(async (pointIndex: number) => {
    if (!cacheKey) {
      throw new Error('No cache key available');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/phylo/quality/missing-neighbors-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheKey,
          pointIndex,
          mode: viewSettings.activeView === 'false-neighbors' ? 'false' : 'missing'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();

    } catch (err: any) {
      console.error('Error getting point errors:', err);
      throw err;
    }
  }, [cacheKey, viewSettings.activeView]);

  /**
   * Clear all data
   */
  const clearData = useCallback(() => {
    setProjectionData(null);
    setQualityMetrics(null);
    setCacheKey(null);
    setError(null);
    setViewSettingsState(defaultViewSettings);
  }, []);

  /**
   * Fetch missing neighbors for a single point
   */
  const fetchMissingNeighborsSingle = useCallback(async (pointIndex: number, phi: number) => {
    if (!cacheKey) {
      setError('No cache key available. Compute quality metrics first.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/phylo/quality/missing-neighbors-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheKey,
          pointIndex,
          mode: 'missing'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Filter and sort neighbors by error (descending)
      const neighbors = data.neighbors
        .filter((n: any) => n.error > 0)
        .sort((a: any, b: any) => b.error - a.error);

      // Apply phi filtering (top percentage)
      const topK = Math.ceil(neighbors.length * phi);
      const filteredNeighbors = onlyTopK ? neighbors.slice(0, topK) : neighbors;

      setMissingNeighborsOfI({
        source: pointIndex,
        neighbors: filteredNeighbors,
        stats: {
          max: neighbors.length > 0 ? Math.max(...neighbors.map((n: any) => n.error)) : 0,
          min: neighbors.length > 0 ? Math.min(...neighbors.map((n: any) => n.error)) : 0,
          count: filteredNeighbors.length
        },
        phi
      });

    } catch (err: any) {
      setError(err.message || 'Failed to fetch missing neighbors');
      console.error('Error fetching missing neighbors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, onlyTopK]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(async () => {
    if (!cacheKey) return;

    try {
      await fetch(`${API_BASE_URL}/api/phylo/quality/cache/${cacheKey}`, {
        method: 'DELETE'
      });

      setCacheKey(null);
      setQualityMetrics(null);
      console.log('Cache cleared');
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  }, [cacheKey]);

  const value: PhyloContextType = {
    projectionData,
    qualityMetrics,
    isLoading,
    error,
    viewSettings,
    phiSingle,
    onlyTopK,
    missingNeighborsOfI,
    loadProjectionData,
    computeQualityMetrics,
    setViewSettings,
    clearData,
    selectPoint,
    setSelectedPoint,
    getPointErrors,
    setPhiSingle,
    setOnlyTopK,
    fetchMissingNeighborsSingle,
    cacheKey,
    clearCache
  };

  return (
    <PhyloContext.Provider value={value}>
      {children}
    </PhyloContext.Provider>
  );
};

/**
 * Hook to use PhyloContext
 */
export const usePhylo = () => {
  const context = useContext(PhyloContext);
  if (context === undefined) {
    throw new Error('usePhylo must be used within a PhyloProvider');
  }
  return context;
};

export default PhyloContext;
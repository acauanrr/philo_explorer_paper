"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

const PhyloContext = createContext();

export const usePhylo = () => {
  const context = useContext(PhyloContext);
  if (!context) {
    throw new Error('usePhylo must be used within a PhyloProvider');
  }
  return context;
};

export const usePhyloContext = () => {
  const context = useContext(PhyloContext);
  if (!context) {
    throw new Error('usePhyloContext must be used within a PhyloProvider');
  }
  return context;
};

export const PhyloProvider = ({ children }) => {
  // Dataset states
  const [currentDataset, setCurrentDataset] = useState(null);
  const [comparisonDataset, setComparisonDataset] = useState(null);

  // Tree data states
  const [treeData, setTreeData] = useState(null);
  const [distanceMatrix, setDistanceMatrix] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Quality metrics states
  const [qualityMetrics, setQualityMetrics] = useState({
    stress: 0,
    trustworthiness: 0,
    continuity: 0,
    missingNeighbors: []
  });

  // Projection data for Phase 3 components
  const [projectionData, setProjectionData] = useState(null);
  const [cacheKey, setCacheKey] = useState(null);

  // Phase 3 states
  const [phiGlobal, setPhiGlobal] = useState(0.05);
  const [edgesGlobal, setEdgesGlobal] = useState(null);
  const [comparisons, setComparisons] = useState(null);
  const [bundling, setBundling] = useState({
    enabled: false,
    cycles: 6,
    subdivisions: 6,
    iterations: 50,
    stiffness: 0.5,
    stepSize: 0.5,
    useWorker: true
  });
  const [view, setView] = useState({ translate: [0, 0], scale: 1.0 });
  const [style, setStyle] = useState({
    lineAlphaMin: 0.05,
    lineAlphaMax: 0.9,
    lineWidthMin: 0.5,
    lineWidthMax: 3.0,
    colorMode: 'viridis'
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load projection data function
  const loadProjectionData = useCallback(async (data) => {
    try {
      setIsLoading(true);
      setProjectionData(data);
      // Generate a cache key based on the data
      if (data && data.highDimPoints) {
        const key = `cache_${Date.now()}_${data.highDimPoints.length}`;
        setCacheKey(key);
      }
      setError(null);
    } catch (err) {
      console.error('Error loading projection data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Phase 3 actions
  const phase3Actions = {
    setPhiGlobal,
    setBundling,
    setView,
    setStyle,
    fetchMissingNeighborsGraph: async (cacheKey, phi) => {
      // Mock implementation - would normally fetch from backend
      console.log('Fetching missing neighbors graph', { cacheKey, phi });
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate mock edges data
      const mockEdges = {
        edges: [],
        stats: {
          min: 0,
          max: 1,
          avg: 0.5
        }
      };
      setEdgesGlobal(mockEdges);
    },
    fetchProjectionCompare: async (cacheKey, projectionMethod) => {
      // Mock implementation
      console.log('Fetching projection comparison', { cacheKey, projectionMethod });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate mock comparison data
      const mockComparison = {
        projectionB: [],
        edges: [],
        displacementErrors: [],
        stats: {
          avgDisplacement: 0.5,
          maxDisplacement: 1.0,
          minDisplacement: 0,
          correlation: 0.85
        }
      };
      setComparisons(mockComparison);
    }
  };

  // Reset function
  const resetPhyloContext = useCallback(() => {
    setCurrentDataset(null);
    setComparisonDataset(null);
    setTreeData(null);
    setDistanceMatrix(null);
    setSelectedNode(null);
    setQualityMetrics({
      stress: 0,
      trustworthiness: 0,
      continuity: 0,
      missingNeighbors: []
    });
    setProjectionData(null);
    setCacheKey(null);
    setPhiGlobal(0.05);
    setEdgesGlobal(null);
    setComparisons(null);
    setError(null);
  }, []);

  const value = {
    // Dataset management
    currentDataset,
    setCurrentDataset,
    comparisonDataset,
    setComparisonDataset,

    // Tree data
    treeData,
    setTreeData,
    distanceMatrix,
    setDistanceMatrix,
    selectedNode,
    setSelectedNode,

    // Quality metrics
    qualityMetrics,
    setQualityMetrics,

    // Projection data
    projectionData,
    setProjectionData,
    loadProjectionData,
    cacheKey,
    setCacheKey,

    // Phase 3 states
    phiGlobal,
    edgesGlobal,
    comparisons,
    bundling,
    view,
    style,
    phase3Actions,

    // Loading states
    isLoading,
    setIsLoading,
    error,
    setError,

    // Utility functions
    resetPhyloContext
  };

  return (
    <PhyloContext.Provider value={value}>
      {children}
    </PhyloContext.Provider>
  );
};
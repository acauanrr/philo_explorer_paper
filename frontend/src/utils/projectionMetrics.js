import * as d3 from "d3";
import {
  calculateDistanceMatrix,
  fetchNeighborJoiningTree,
  computeTreeLeafDistanceMatrix
} from "./treeUtils";

const normalizeLabel = (value) => (value ?? "").toString().trim();

export const reorderMatrixToLabels = (matrix, sourceLabels = [], targetLabels = []) => {
  if (!Array.isArray(matrix) || !Array.isArray(sourceLabels) || !Array.isArray(targetLabels)) {
    return matrix;
  }

  const indexMap = new Map();
  sourceLabels.forEach((label, idx) => {
    indexMap.set(normalizeLabel(label), idx);
  });

  const missing = targetLabels.some((label) => !indexMap.has(normalizeLabel(label)));
  if (missing) {
    return matrix;
  }

  return targetLabels.map((rowLabel) => {
    const rowIndex = indexMap.get(normalizeLabel(rowLabel));
    return targetLabels.map((colLabel) => {
      const colIndex = indexMap.get(normalizeLabel(colLabel));
      return matrix[rowIndex]?.[colIndex] ?? 0;
    });
  });
};

export const computeKnnRanks = (distanceMatrix, k = 10) => {
  const n = distanceMatrix?.length || 0;
  if (!n) return [];

  const result = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const row = distanceMatrix[i] || [];
    const indices = Array.from({ length: n }, (_, j) => j).filter((j) => j !== i);
    indices.sort((a, b) => (row[a] ?? Infinity) - (row[b] ?? Infinity));
    const list = indices.slice(0, Math.min(k, indices.length));
    const rankMap = new Map();
    list.forEach((idx, r) => rankMap.set(idx, r + 1));
    result[i] = { list, rankMap };
  }
  return result;
};

export const computeJaccardDistanceK = (knnLow, knnHigh, k) => {
  const n = knnLow.length;
  const values = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const setL = new Set(knnLow[i].list);
    const setH = new Set(knnHigh[i].list);
    let inter = 0;
    setL.forEach((idx) => { if (setH.has(idx)) inter += 1; });
    const union = setL.size + setH.size - inter;
    const jd = union > 0 ? 1 - inter / union : 0;
    values[i] = jd;
  }
  return values;
};

export const computeSequenceDifferenceK = (knnLow, knnHigh, k) => {
  const n = knnLow.length;
  const values = new Array(n).fill(0);
  const kPlus = k + 1;
  for (let i = 0; i < n; i += 1) {
    const lowRanks = knnLow[i].rankMap;
    const highRanks = knnHigh[i].rankMap;
    const union = new Set([...lowRanks.keys(), ...highRanks.keys()]);

    let sum = 0;
    let m = 0;
    union.forEach((j) => {
      const r2 = lowRanks.get(j) ?? kPlus;
      const rn = highRanks.get(j) ?? kPlus;
      const w = (kPlus - Math.min(r2, rn)) / kPlus;
      const delta = Math.abs(r2 - rn);
      sum += w * delta;
      m += 1;
    });

    const sd = m > 0 ? sum / (m * kPlus) : 0;
    values[i] = Math.min(1, Math.max(0, sd));
  }
  return values;
};

export const computeCentralityPreservation = (knn, k) => {
  const n = knn.length;
  const cp = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let owner = 0; owner < n; owner += 1) {
      if (owner === i) continue;
      const r = knn[owner].rankMap.get(i);
      if (r !== undefined) {
        cp[i] += 1 / r;
      }
    }
  }
  const maxPossible = (n - 1) * 1;
  return cp.map((v) => (maxPossible > 0 ? v / maxPossible : 0));
};

export const computeNeighborhoodPreservationValues = (lowDistances, highDistances, k) => {
  if (!Array.isArray(lowDistances) || !Array.isArray(highDistances)) {
    return { jdk: [], sdk: [], cpkLow: [], cpkHigh: [] };
  }

  const knnLow = computeKnnRanks(lowDistances, k);
  const knnHigh = computeKnnRanks(highDistances, k);

  return {
    jdk: computeJaccardDistanceK(knnLow, knnHigh, k),
    sdk: computeSequenceDifferenceK(knnLow, knnHigh, k),
    cpkLow: computeCentralityPreservation(knnLow, k),
    cpkHigh: computeCentralityPreservation(knnHigh, k)
  };
};

export const prepareProjectionQualityBundle = async (dataset) => {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return null;
  }

  const distanceData = await calculateDistanceMatrix(dataset);
  if (!distanceData) {
    return null;
  }

  const tree = await fetchNeighborJoiningTree(distanceData, dataset);
  if (!tree?.root) {
    return null;
  }

  const low = computeTreeLeafDistanceMatrix(tree.root, tree.labels ?? distanceData.labels);
  const high = reorderMatrixToLabels(distanceData.matrix, distanceData.labels, low.labels);

  return {
    labels: low.labels,
    lowDistances: low.matrix,
    highDistances: high,
    root: tree.root,
    articles: tree.articles ?? dataset ?? [],
    distanceData,
    tree
  };
};

const computeMean = (values) => {
  if (!values || values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const computeStandardDeviation = (values, mean) => {
  if (!values || values.length === 0) return 0;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const buildHistogram = (values, bins = 10) => {
  if (!values || values.length === 0) return [];
  const maxValue = Math.max(...values);
  const histogram = d3.histogram()
    .domain([0, maxValue || 1])
    .thresholds(bins);

  return histogram(values);
};

const classifyErrorLevel = (value) => {
  const absValue = Math.abs(value || 0);
  if (absValue >= 0.3) return "high";
  if (absValue >= 0.15) return "medium";
  return "low";
};

const assignInternalNodeErrors = (node) => {
  if (!node) {
    return { total: 0, count: 0 };
  }

  if (!node.children || node.children.length === 0) {
    node.errorLevel = classifyErrorLevel(node.projectionError);
    return {
      total: node.projectionError ?? 0,
      count: 1
    };
  }

  let total = 0;
  let count = 0;

  node.children.forEach((child) => {
    const childAggregate = assignInternalNodeErrors(child);
    total += childAggregate.total;
    count += childAggregate.count;
  });

  const mean = count > 0 ? total / count : 0;
  node.projectionError = mean;
  node.errorLevel = classifyErrorLevel(mean);

  return { total, count };
};

export const computeProjectionErrorMetrics = (distanceData, treeResult) => {
  if (!distanceData || !treeResult?.root) {
    return null;
  }

  const labelsReference = treeResult.labels ?? distanceData.labels ?? [];
  const treeDistanceData = computeTreeLeafDistanceMatrix(treeResult.root, labelsReference);
  const treeDistances = treeDistanceData.matrix;
  const labels = treeDistanceData.labels;
  const leaves = treeDistanceData.leaves;

  if (!Array.isArray(treeDistances) || treeDistances.length === 0) {
    return null;
  }

  const highDistances = reorderMatrixToLabels(
    distanceData.matrix,
    distanceData.labels ?? labels,
    labels
  );

  if (!Array.isArray(highDistances) || highDistances.length !== treeDistances.length) {
    return null;
  }

  const n = treeDistances.length;
  const errorMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const aggregatedSums = new Array(n).fill(0);
  const absoluteValues = [];
  const pairwiseAbsErrors = [];
  let compressionCount = 0;
  let expansionCount = 0;

  for (let i = 0; i < n; i += 1) {
    errorMatrix[i][i] = 0;
    for (let j = i + 1; j < n; j += 1) {
      const high = highDistances[i]?.[j] ?? 0;
      const low = treeDistances[i]?.[j] ?? 0;
      const denom = Math.max(high, low);
      const error = denom > 1e-9 ? (low - high) / denom : 0;
      const absError = Math.abs(error);

      errorMatrix[i][j] = error;
      errorMatrix[j][i] = error;

      aggregatedSums[i] += absError;
      aggregatedSums[j] += absError;

      absoluteValues.push(absError);
      pairwiseAbsErrors.push({
        key: `${labels[i]}|${labels[j]}`,
        abs: absError,
        signed: error
      });

      if (error < -1e-12) {
        compressionCount += 1;
      } else if (error > 1e-12) {
        expansionCount += 1;
      }
    }
  }

  const aggregatedMeans = aggregatedSums.map((sum) => (n > 1 ? sum / (n - 1) : 0));

  leaves.forEach((leafInfo, idx) => {
    const meanValue = aggregatedMeans[idx];
    leafInfo.node.projectionError = meanValue;
    leafInfo.node.errorSum = aggregatedSums[idx];
    leafInfo.node.errorLevel = classifyErrorLevel(meanValue);
  });

  assignInternalNodeErrors(treeResult.root);

  const histogram = buildHistogram(absoluteValues);
  const meanAbs = computeMean(absoluteValues);
  const stdAbs = computeStandardDeviation(absoluteValues, meanAbs);
  const maxAbs = absoluteValues.length ? Math.max(...absoluteValues) : 0;
  const minAbs = absoluteValues.length ? Math.min(...absoluteValues) : 0;
  const pairCount = absoluteValues.length;

  const leafMetrics = leaves.map((leafInfo, idx) => ({
    label: labels[idx],
    meanError: aggregatedMeans[idx],
    sumError: aggregatedSums[idx],
    node: leafInfo.node
  }));

  return {
    labels,
    leafMetrics,
    highDistances,
    lowDistances: treeDistances,
    errorMatrix,
    aggregatedMeans,
    aggregatedSums,
    histogram,
    stats: {
      meanError: meanAbs,
      stdError: stdAbs,
      maxError: maxAbs,
      minError: minAbs,
      compressionRatio: pairCount ? compressionCount / pairCount : 0,
      expansionRatio: pairCount ? expansionCount / pairCount : 0,
      pairCount
    },
    pairwiseAbsErrors,
    root: treeResult.root
  };
};

export const computeComparisonMetrics = (metricsT1, metricsT2) => {
  if (!metricsT1 || !metricsT2) {
    return null;
  }

  const stats1 = metricsT1.stats;
  const stats2 = metricsT2.stats;

  if (!stats1 || !stats2) {
    return null;
  }

  const mean1 = Number.isFinite(stats1.meanError) ? stats1.meanError : 0;
  const mean2 = Number.isFinite(stats2.meanError) ? stats2.meanError : 0;

  const meanDifference = mean2 - mean1;
  const improvementRatio = mean1 > 0
    ? ((mean1 - mean2) / mean1) * 100
    : 0;

  const pairMap = new Map();
  (metricsT1.pairwiseAbsErrors ?? []).forEach((entry) => {
    pairMap.set(entry.key, entry.abs);
  });

  const alignedA = [];
  const alignedB = [];

  (metricsT2.pairwiseAbsErrors ?? []).forEach((entry) => {
    if (pairMap.has(entry.key)) {
      alignedA.push(pairMap.get(entry.key));
      alignedB.push(entry.abs);
    }
  });

  let correlation = 0;
  if (alignedA.length > 1) {
    const meanA = computeMean(alignedA);
    const meanB = computeMean(alignedB);
    const numerator = alignedA.reduce((acc, value, idx) => acc + ((value - meanA) * (alignedB[idx] - meanB)), 0);
    const denomA = Math.sqrt(alignedA.reduce((acc, value) => acc + ((value - meanA) ** 2), 0));
    const denomB = Math.sqrt(alignedB.reduce((acc, value) => acc + ((value - meanB) ** 2), 0));
    const denominator = denomA * denomB;
    correlation = denominator > 0 ? numerator / denominator : 0;
  }

  return {
    errorDifference: meanDifference,
    improvementRatio,
    correlationCoeff: correlation || 0,
    overlapPairs: alignedA.length
  };
};

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Spinner,
  useColorModeValue,
  useToast,
  FormControl,
  FormLabel,
  Switch,
  Select,
  Divider,
  Alert,
  AlertIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from "@chakra-ui/react";
import { usePhylo } from "../../context/PhyloContext";
import {
  calculateDistanceMatrix,
  fetchNeighborJoiningTree,
  computeTreeLeafDistanceMatrix
} from "../../utils/treeUtils";
import {
  renderRadialTree,
  defaultTreeTheme
} from "../../utils/treeRenderer";

const normalizeLabel = (label) => (label ?? "").toString().trim();

const reorderMatrixToLabels = (matrix, sourceLabels = [], targetLabels = []) => {
  if (!Array.isArray(matrix) || !Array.isArray(sourceLabels) || !Array.isArray(targetLabels)) {
    return matrix;
  }

  const indexMap = new Map();
  sourceLabels.forEach((label, idx) => {
    indexMap.set(normalizeLabel(label), idx);
  });

  const missingLabel = targetLabels.some((label) => !indexMap.has(normalizeLabel(label)));
  if (missingLabel) {
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

const flattenUpperTriangle = (matrix) => {
  const values = [];
  if (!Array.isArray(matrix)) return values;
  const n = matrix.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      values.push(matrix[i][j]);
    }
  }
  return values;
};

const computeCorrelation = (a, b) => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  const meanA = a.reduce((acc, v) => acc + v, 0) / a.length;
  const meanB = b.reduce((acc, v) => acc + v, 0) / b.length;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denominator = Math.sqrt(denomA * denomB);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
};

const buildTreeMetrics = async ({ dataset, existing }) => {
  if (existing?.lowDistances && existing?.root) {
    return existing;
  }

  const distanceData = await calculateDistanceMatrix(dataset);
  const treeResult = await fetchNeighborJoiningTree(distanceData, dataset);
  const treeDistances = computeTreeLeafDistanceMatrix(
    treeResult.root,
    treeResult.labels ?? distanceData.labels
  );

  const labels = treeDistances.labels;
  const lowDistances = treeDistances.matrix;
  const highDistances = reorderMatrixToLabels(
    distanceData.matrix,
    distanceData.labels ?? labels,
    labels
  );

  return {
    labels,
    labelSet: new Set(labels.map(normalizeLabel)),
    root: treeResult.root,
    lowDistances,
    highDistances,
    leafCount: labels.length
  };
};

const subsetMatrix = (matrix, indices) => {
  return indices.map((rowIdx) => indices.map((colIdx) => matrix[rowIdx][colIdx] ?? 0));
};

const computeLeafChanges = (low1, low2, labels, idxMap1, idxMap2) => {
  const changes = [];
  let globalSum = 0;
  let globalCount = 0;

  labels.forEach((label) => {
    const idx1 = idxMap1.get(label);
    const idx2 = idxMap2.get(label);
    if (idx1 === undefined || idx2 === undefined) {
      return;
    }

    let sum = 0;
    let count = 0;
    let maxDelta = 0;

    labels.forEach((otherLabel) => {
      if (otherLabel === label) return;
      const j1 = idxMap1.get(otherLabel);
      const j2 = idxMap2.get(otherLabel);
      if (j1 === undefined || j2 === undefined) return;

      const d1 = low1[idx1][j1];
      const d2 = low2[idx2][j2];
      if (d1 === undefined || d2 === undefined) return;

      const denom = Math.max(d1, d2);
      if (!Number.isFinite(denom) || denom <= 1e-12) return;

      const delta = Math.abs(d1 - d2) / denom;
      if (!Number.isFinite(delta)) return;

      sum += delta;
      count += 1;
      if (delta > maxDelta) {
        maxDelta = delta;
      }
    });

    const meanDelta = count > 0 ? sum / count : 0;
    if (Number.isFinite(meanDelta)) {
      changes.push({
        label,
        meanDelta,
        maxDelta: Number.isFinite(maxDelta) ? maxDelta : 0
      });
      globalSum += sum;
      globalCount += count;
    }
  });

  return {
    changes,
    averageDelta: globalCount > 0 ? globalSum / globalCount : 0
  };
};

const CompareProjectionsTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const {
    currentDataset,
    comparisonDataset,
    projectionQuality,
    setProjectionQuality
  } = usePhylo();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState("side-by-side");
  const [highlightDifferences, setHighlightDifferences] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [treeMetrics, setTreeMetrics] = useState({ t1: null, t2: null });
  const [comparisonSummary, setComparisonSummary] = useState(null);
  const [leafChanges, setLeafChanges] = useState([]);

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!leafChanges.length) {
      setSelectedNode(null);
    }
  }, [leafChanges.length]);

  const ensureMetrics = useCallback(async (key, dataset) => {
    const existing = projectionQuality?.[key];
    const result = await buildTreeMetrics({
      dataset,
      existing
    });

    if (result && result !== existing) {
      setProjectionQuality((prev) => {
        const previous = prev ?? {};
        const next = { ...(previous[key] ?? {}), ...result };
        return { ...previous, [key]: next };
      });
    }

    return result;
  }, [projectionQuality, setProjectionQuality]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentDataset || currentDataset.length === 0) {
        setTreeMetrics({ t1: null, t2: null });
        setComparisonSummary(null);
        setLeafChanges([]);
        return;
      }

      setIsLoading(true);
      try {
        const rawMetricsT1 = await ensureMetrics("t1", currentDataset);

        let rawMetricsT2 = null;
        if (comparisonDataset && comparisonDataset.length > 0) {
          rawMetricsT2 = await ensureMetrics("t2", comparisonDataset);
        }

        if (cancelled) return;

        const augmentMetrics = (metrics) => {
          if (!metrics) return null;
          const labels = metrics.labels ?? [];
          return {
            ...metrics,
            labelSet: metrics.labelSet ?? new Set(labels.map(normalizeLabel)),
            leafCount: metrics.leafCount ?? labels.length
          };
        };

        const metricsT1 = augmentMetrics(rawMetricsT1);
        const metricsT2 = augmentMetrics(rawMetricsT2);

        setTreeMetrics({ t1: metricsT1, t2: metricsT2 });

        if (metricsT1 && metricsT2) {
          const set1 = new Set(metricsT1.labels.map(normalizeLabel));
          const set2 = new Set(metricsT2.labels.map(normalizeLabel));

          const addedNodes = metricsT2.labels.filter((label) => !set1.has(normalizeLabel(label)));
          const removedNodes = metricsT1.labels.filter((label) => !set2.has(normalizeLabel(label)));
          const commonLabels = metricsT1.labels
            .map(normalizeLabel)
            .filter((label) => set2.has(label));

          const unionSize = new Set([
            ...metricsT1.labels.map(normalizeLabel),
            ...metricsT2.labels.map(normalizeLabel)
          ]).size;

          const indices1 = new Map();
          metricsT1.labels.forEach((label, idx) => {
            indices1.set(normalizeLabel(label), idx);
          });

          const indices2 = new Map();
          metricsT2.labels.forEach((label, idx) => {
            indices2.set(normalizeLabel(label), idx);
          });

          let structuralSimilarity = 0;
          let topologyChange = 0;
          let leafDiffs = [];

          if (commonLabels.length >= 2) {
            const commonIndices1 = commonLabels.map((label) => indices1.get(label));
            const commonIndices2 = commonLabels.map((label) => indices2.get(label));

            const subsetLow1 = subsetMatrix(metricsT1.lowDistances, commonIndices1);
            const subsetLow2 = subsetMatrix(metricsT2.lowDistances, commonIndices2);

            const flat1 = flattenUpperTriangle(subsetLow1);
            const flat2 = flattenUpperTriangle(subsetLow2);

            const correlation = computeCorrelation(flat1, flat2);
            structuralSimilarity = Math.max(0, Math.min(1, (correlation + 1) / 2));

            const { changes, averageDelta } = computeLeafChanges(
              metricsT1.lowDistances,
              metricsT2.lowDistances,
              commonLabels,
              indices1,
              indices2
            );

            leafDiffs = changes;
            topologyChange = Number.isFinite(averageDelta) ? Math.max(0, averageDelta) : 0;
          }

          const uniqueDiffsMap = new Map();
          leafDiffs.forEach((entry) => {
            const norm = normalizeLabel(entry.label);
            const existing = uniqueDiffsMap.get(norm);
            if (!existing) {
              uniqueDiffsMap.set(norm, entry);
            } else {
              uniqueDiffsMap.set(norm, {
                label: entry.label,
                meanDelta: Math.max(existing.meanDelta, entry.meanDelta),
                maxDelta: Math.max(existing.maxDelta, entry.maxDelta)
              });
            }
          });

          const uniqueLeafDiffs = Array.from(uniqueDiffsMap.values());
          const safeTopologyChange = Math.min(1, Math.max(0, topologyChange));

          setComparisonSummary({
            structuralSimilarity,
            topologyChange: safeTopologyChange,
            commonNodes: commonLabels.length,
            addedNodes,
            removedNodes,
            unionSize,
            commonLabels
          });

          setLeafChanges(uniqueLeafDiffs);
        } else {
          setComparisonSummary(null);
          setLeafChanges([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          toast({
            title: "Failed to compare projections",
            description: error.message,
            status: "error",
            duration: 4000
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    currentDataset,
    comparisonDataset,
    ensureMetrics,
    toast
  ]);

  const leafDiffMap = useMemo(() => {
    const map = new Map();
    leafChanges.forEach((entry) => {
      map.set(normalizeLabel(entry.label), entry);
    });
    return map;
  }, [leafChanges]);

  const handleSelectNode = useCallback((label) => {
    if (!label) {
      setSelectedNode(null);
      return;
    }
    const normalized = normalizeLabel(label);
    const entry = leafDiffMap.get(normalized);
    setSelectedNode({
      label,
      normalized,
      meanDelta: entry?.meanDelta ?? 0,
      maxDelta: entry?.maxDelta ?? 0
    });
  }, [leafDiffMap]);

  useEffect(() => {
    const metricsT1 = treeMetrics.t1;
    const metricsT2 = treeMetrics.t2;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!metricsT1 || !metricsT1.root) {
      return;
    }

    const width = Math.max(dimensions.width || 0, 400);
    const height = Math.max(dimensions.height || 0, 360);

    svg.attr("width", width).attr("height", height);

    const deltaValues = leafChanges
      .map((entry) => entry.meanDelta)
      .filter((value) => Number.isFinite(value));
    const maxDelta = deltaValues.length ? Math.max(...deltaValues) : 0;

    const colorScale = d3.scaleSequential(d3.interpolateWarm)
      .domain([0, maxDelta || 1]);

    const widthScale = d3.scaleLinear()
      .domain([0, maxDelta || 1])
      .range([1, 6]);

    const selectedNormalized = selectedNode?.normalized ?? null;
    const commonLabels = comparisonSummary?.commonLabels ?? [];
    const commonSet = new Set(commonLabels.map(normalizeLabel));

    const theme = {
      ...defaultTreeTheme,
      branch: {
        ...defaultTreeTheme.branch,
        stroke: "rgba(148, 163, 184, 0.45)",
        width: 1.1
      },
      leaf: {
        ...defaultTreeTheme.leaf,
        fill: highlightDifferences ? "#fde68a" : defaultTreeTheme.leaf.fill
      },
      label: {
        ...defaultTreeTheme.label,
        color: textColor
      }
    };

    const colorForLeaf = (node) => {
      const label = normalizeLabel(node.data?.name ?? node.data?.id);
      if (!highlightDifferences) {
        if (commonSet.size && !commonSet.has(label)) {
          return "#cbd5f5";
        }
        return theme.leaf.fill;
      }
      const entry = leafDiffMap.get(label);
      if (entry) {
        return colorScale(entry.meanDelta);
      }
      if (commonSet.size && !commonSet.has(label)) {
        return "#cbd5f5";
      }
      return theme.leaf.fill;
    };

    const highlightNode = (node) => {
      if (!selectedNormalized) return false;
      const label = normalizeLabel(node.data?.name ?? node.data?.id);
      return label === selectedNormalized;
    };

    const nodeStyler = (node) => {
      const label = normalizeLabel(node.data?.name ?? node.data?.id);
      const diffEntry = leafDiffMap.get(label);
      const style = {};
      const isLeaf = !node.children || node.children.length === 0;

      if (isLeaf && highlightDifferences && diffEntry) {
        style.radius = 4 + Math.min(10, diffEntry.meanDelta * 20);
      }

      if (selectedNormalized) {
        if (label === selectedNormalized) {
          style.stroke = "#f97316";
          style.strokeWidth = 2.6;
          style.opacity = 1;
        } else {
          style.opacity = 0.35;
        }
      } else if (highlightDifferences && !diffEntry && commonSet.size && !commonSet.has(label)) {
        style.opacity = 0.4;
      }

      return style;
    };

    const linkStyler = (link) => {
      const label = normalizeLabel(link.target.data?.name ?? link.target.data?.id);
      const diffEntry = leafDiffMap.get(label);
      const style = {};

      if (highlightDifferences && diffEntry) {
        style.stroke = colorScale(diffEntry.meanDelta);
      }

      if (selectedNormalized) {
        if (label === selectedNormalized) {
          style.stroke = "#f97316";
          style.strokeWidth = 2.2;
          style.strokeOpacity = 0.95;
        } else {
          style.strokeOpacity = 0.4;
        }
      }

      return style;
    };

    const appendLeafTitles = (result) => {
      const nodeGroup = result.treeGroup.select(".tree-nodes");
      if (nodeGroup.empty()) return;

      nodeGroup
        .selectAll("g")
        .filter((d) => d && (!d.children || d.children.length === 0))
        .append("title")
        .text((d) => {
          const label = d?.data?.displayName ?? d?.data?.name ?? "";
          const entry = leafDiffMap.get(normalizeLabel(label));
          if (!entry) return label;
          return `${label}\nΔ mean: ${(entry.meanDelta * 100).toFixed(2)}%\nΔ max: ${(entry.maxDelta * 100).toFixed(2)}%`;
        });
    };

    if (viewMode === "side-by-side" && metricsT2?.root) {
      const panelWidth = width / 2;

      const leftSvg = svg.append("svg")
        .attr("class", "compare-tree-panel compare-tree-panel--left")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", panelWidth)
        .attr("height", height);

      const rightSvg = svg.append("svg")
        .attr("class", "compare-tree-panel compare-tree-panel--right")
        .attr("x", panelWidth)
        .attr("y", 0)
        .attr("width", panelWidth)
        .attr("height", height);

      const leftResult = renderRadialTree({
        svg: leftSvg,
        rootData: metricsT1.root,
        width: panelWidth,
        height,
        theme,
        showLabels,
        leafColorAccessor: colorForLeaf,
        internalColorAccessor: colorForLeaf,
        highlight: { nodes: highlightNode },
        linkStyler,
        nodeStyler,
        onLeafClick: (node) => handleSelectNode(node.data?.name || node.data?.id || ""),
        useBranchLengths: true
      });

      const rightResult = renderRadialTree({
        svg: rightSvg,
        rootData: metricsT2.root,
        width: panelWidth,
        height,
        theme,
        showLabels,
        leafColorAccessor: colorForLeaf,
        internalColorAccessor: colorForLeaf,
        highlight: { nodes: highlightNode },
        linkStyler,
        nodeStyler,
        onLeafClick: (node) => handleSelectNode(node.data?.name || node.data?.id || ""),
        useBranchLengths: true
      });

      appendLeafTitles(leftResult);
      appendLeafTitles(rightResult);

      leftSvg.on("click", (event) => {
        if (event.target === leftSvg.node()) {
          setSelectedNode(null);
        }
      });

      rightSvg.on("click", (event) => {
        if (event.target === rightSvg.node()) {
          setSelectedNode(null);
        }
      });

      if (highlightDifferences && commonLabels.length > 0) {
        const connectorGroup = svg.append("g")
          .attr("class", "tree-connector-layer")
          .attr("fill", "none")
          .attr("pointer-events", "none")
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round");

        const connectorLine = d3.line().curve(d3.curveCatmullRom.alpha(0.6));

        commonLabels.forEach((label) => {
          const normalized = normalizeLabel(label);
          const leftPos = leftResult.positionsByLabel.get(normalized);
          const rightPos = rightResult.positionsByLabel.get(normalized);
          const diffEntry = leafDiffMap.get(normalized);

          if (!leftPos || !rightPos || !diffEntry) return;

          const leftPoint = { x: leftPos.x, y: leftPos.y };
          const rightPoint = { x: panelWidth + rightPos.x, y: rightPos.y };
          const midX = width / 2;

          const opacity = selectedNormalized
            ? (normalized === selectedNormalized ? 0.95 : 0.08)
            : Math.max(0.25, diffEntry.meanDelta > 0 ? 0.8 : 0.35);

          const connector = connectorGroup.append("path")
            .attr("stroke", colorScale(diffEntry.meanDelta))
            .attr("stroke-width", widthScale(diffEntry.meanDelta))
            .attr("stroke-opacity", opacity)
            .attr("d", connectorLine([
              [leftPoint.x, leftPoint.y],
              [midX, leftPoint.y - 40],
              [midX, rightPoint.y + 40],
              [rightPoint.x, rightPoint.y]
            ]));

          connector.append("title")
            .text(`${label}\nΔ mean: ${(diffEntry.meanDelta * 100).toFixed(2)}%`);
        });
      }
    } else {
      const overlayRoot = highlightDifferences ? metricsT2?.root ?? null : null;

      const result = renderRadialTree({
        svg,
        rootData: metricsT1.root,
        overlayRoot,
        width,
        height,
        theme,
        showLabels,
        leafColorAccessor: colorForLeaf,
        internalColorAccessor: colorForLeaf,
        highlight: { nodes: highlightNode },
        linkStyler,
        nodeStyler,
        onLeafClick: (node) => handleSelectNode(node.data?.name || node.data?.id || ""),
        useBranchLengths: true
      });

      appendLeafTitles(result);

      svg.on("click", (event) => {
        if (event.target === svg.node()) {
          setSelectedNode(null);
        }
      });
    }
  }, [
    treeMetrics,
    comparisonSummary,
    leafChanges,
    leafDiffMap,
    highlightDifferences,
    showLabels,
    dimensions,
    textColor,
    viewMode,
    handleSelectNode,
    selectedNode
  ]);

  const selectedDetails = useMemo(() => {
    if (!selectedNode) return null;
    const entry = leafDiffMap.get(selectedNode.normalized ?? normalizeLabel(selectedNode.label));
    return entry ? {
      label: selectedNode.label,
      meanDelta: entry.meanDelta,
      maxDelta: entry.maxDelta
    } : null;
  }, [leafDiffMap, selectedNode]);

  if (!currentDataset) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="warning">
          <AlertIcon />
          Please load a dataset from the Data Input tab before comparing projections.
        </Alert>
      </Box>
    );
  }

  return (
    <Box h="full" display="flex">
      <Box w="380px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Compare Projections</Text>
          <Text fontSize="sm" color="gray.600">
            Evaluate structural differences between T1 and T2 Neighbor Joining trees using shared nodes.
          </Text>

          <Divider />

          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Datasets</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs">T1 Nodes:</Text>
                  <Badge colorScheme="blue">{treeMetrics.t1?.leafCount ?? 0}</Badge>
                </HStack>
                {comparisonDataset && (
                  <HStack justify="space-between">
                    <Text fontSize="xs">T2 Nodes:</Text>
                    <Badge colorScheme="purple">{treeMetrics.t2?.leafCount ?? 0}</Badge>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>

          {comparisonDataset ? (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">View Options</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  <FormControl>
                    <FormLabel fontSize="sm">Layout</FormLabel>
                    <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="sm">
                      <option value="side-by-side">Side by Side</option>
                      <option value="overlay">Overlay</option>
                    </Select>
                  </FormControl>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="highlight-diff" mb="0" fontSize="sm">
                      Highlight Differences
                    </FormLabel>
                    <Switch
                      id="highlight-diff"
                      isChecked={highlightDifferences}
                      onChange={(e) => setHighlightDifferences(e.target.checked)}
                    />
                  </FormControl>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel htmlFor="show-labels" mb="0" fontSize="sm">
                      Show Labels
                    </FormLabel>
                    <Switch
                      id="show-labels"
                      isChecked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                    />
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>
          ) : (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              Load a comparison dataset to enable projection comparison.
            </Alert>
          )}

          {comparisonSummary && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Comparison Metrics</Text>
              </CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  <Stat size="sm">
                    <StatLabel>Structural Similarity</StatLabel>
                    <StatNumber color={comparisonSummary.structuralSimilarity >= 0.7 ? "green.500" : "orange.500"}>
                      {(comparisonSummary.structuralSimilarity * 100).toFixed(1)}%
                    </StatNumber>
                    <Progress
                      value={comparisonSummary.structuralSimilarity * 100}
                      size="xs"
                      colorScheme={comparisonSummary.structuralSimilarity >= 0.7 ? "green" : "orange"}
                    />
                    <StatHelpText>Correlation between tree distance structures</StatHelpText>
                  </Stat>

                  <Stat size="sm">
                    <StatLabel>Topology Change</StatLabel>
                    <StatNumber color={comparisonSummary.topologyChange <= 0.2 ? "green.500" : "red.500"}>
                      {(comparisonSummary.topologyChange * 100).toFixed(1)}%
                    </StatNumber>
                    <Progress
                      value={Math.min(100, comparisonSummary.topologyChange * 100)}
                      size="xs"
                      colorScheme={comparisonSummary.topologyChange <= 0.2 ? "green" : "red"}
                    />
                    <StatHelpText>Average normalized distance deviation</StatHelpText>
                  </Stat>

                  <HStack justify="space-between">
                    <Text fontSize="xs">Common Nodes:</Text>
                    <Badge colorScheme="blue">{comparisonSummary.commonNodes}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Added Nodes:</Text>
                    <Badge colorScheme="purple">{comparisonSummary.addedNodes.length}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Removed Nodes:</Text>
                    <Badge colorScheme="orange">{comparisonSummary.removedNodes.length}</Badge>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          )}

          {leafChanges.length > 0 && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Top Changed Nodes</Text>
              </CardHeader>
              <CardBody>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th fontSize="xs">Node</Th>
                      <Th fontSize="xs">Δ Mean</Th>
                      <Th fontSize="xs">Δ Max</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {leafChanges
                      .slice()
                      .sort((a, b) => b.meanDelta - a.meanDelta)
                      .slice(0, 8)
                      .map((entry, index) => {
                        const label = entry.label ? String(entry.label) : "-";
                        return (
                          <Tr key={`${label}-${index}`}>
                            <Td fontSize="xs">{label.substring(0, 24)}</Td>
                            <Td fontSize="xs">{(entry.meanDelta * 100).toFixed(2)}%</Td>
                            <Td fontSize="xs">{(entry.maxDelta * 100).toFixed(2)}%</Td>
                          </Tr>
                        );
                      })}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          )}

          {selectedDetails && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">{selectedDetails.label}</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Mean Δ</Text>
                    <Badge colorScheme="orange">{(selectedDetails.meanDelta * 100).toFixed(2)}%</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Max Δ</Text>
                    <Badge colorScheme="red">{(selectedDetails.maxDelta * 100).toFixed(2)}%</Badge>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Box>

      <Box ref={containerRef} flex={1} bg={bgColor} position="relative">
        {isLoading ? (
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)">
            <VStack spacing={4}>
              <Spinner size="lg" color="blue.500" />
              <Text fontSize="sm" color="gray.600">Loading projection comparison...</Text>
            </VStack>
          </Box>
        ) : (
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        )}
      </Box>
    </Box>
  );
};

export default CompareProjectionsTreeView;

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Select,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Switch,
  Button,
} from "@chakra-ui/react";
import { usePhylo } from "../../context/PhyloContext";
import {
  calculateDistanceMatrix,
  fetchNeighborJoiningTree
} from "../../utils/treeUtils";
import {
  computeProjectionErrorMetrics
} from "../../utils/projectionMetrics";
import { renderRadialTree, defaultTreeTheme } from "../../utils/treeRenderer";

const MAX_RENDER_PAIRS = 500;

const normalizeLabel = (label) => (label ?? "").toString().trim();

const formatNumber = (value, digits = 4) =>
  Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits);

const computeMean = (values) =>
  values && values.length ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;

const MissingNeighborsTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const {
    currentDataset,
    comparisonDataset,
    projectionQuality,
    setProjectionQuality
  } = usePhylo();

  const [viewMode, setViewMode] = useState("t1");
  const [phiPercent, setPhiPercent] = useState(3);
  const [showLabels, setShowLabels] = useState(false);
  const [showBranchLength, setShowBranchLength] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  const hasT2Metrics = Boolean(projectionQuality?.t2);

  useEffect(() => {
    if (viewMode === "t2" && !hasT2Metrics) {
      setViewMode("t1");
    }
  }, [hasT2Metrics, viewMode]);

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
    if (selectedNode && projectionQuality) {
      const currentMetrics = viewMode === "t2" ? projectionQuality.t2 : projectionQuality.t1;
      if (!currentMetrics) {
        setSelectedNode(null);
      }
    }
  }, [projectionQuality, viewMode, selectedNode]);

  useEffect(() => {
    setSelectedNode(null);
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;

    const ensureMetricsForKey = async (key, dataset) => {
      if (!Array.isArray(dataset) || dataset.length === 0) {
        return;
      }
      if (projectionQuality?.[key]?.errorMatrix) {
        return;
      }

      try {
        const distanceData = await calculateDistanceMatrix(dataset);
        const treeResult = await fetchNeighborJoiningTree(distanceData, dataset);
        if (!treeResult?.root || cancelled) {
          return;
        }
        const metrics = computeProjectionErrorMetrics(distanceData, treeResult);
        if (!metrics || cancelled) {
          return;
        }
        setProjectionQuality((prev) => {
          const previous = prev ?? {};
          const existing = previous[key] ?? {};
          return {
            ...previous,
            [key]: { ...existing, ...metrics }
          };
        });
      } catch (error) {
        console.error(`Failed to compute projection metrics for ${key}`, error);
      }
    };

    const promises = [];
    if (currentDataset && !projectionQuality?.t1?.errorMatrix) {
      promises.push(ensureMetricsForKey("t1", currentDataset));
    }
    if (comparisonDataset && !projectionQuality?.t2?.errorMatrix) {
      promises.push(ensureMetricsForKey("t2", comparisonDataset));
    }

    if (promises.length) {
      Promise.all(promises).catch((error) => {
        console.error("Projection metrics computation failed", error);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [currentDataset, comparisonDataset, projectionQuality, setProjectionQuality]);

  const datasetMetrics = viewMode === "t2" ? projectionQuality?.t2 : projectionQuality?.t1;

  const positivePairs = useMemo(() => {
    if (!datasetMetrics?.errorMatrix || !datasetMetrics?.labels) return [];
    const matrix = datasetMetrics.errorMatrix;
    const labels = datasetMetrics.labels;
    const pairs = [];
    const n = matrix.length;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const weight = matrix[i][j];
        if (weight > 0) {
          pairs.push({
            sourceIndex: i,
            targetIndex: j,
            sourceLabel: labels[i],
            targetLabel: labels[j],
            weight
          });
        }
      }
    }
    pairs.sort((a, b) => b.weight - a.weight);
    return pairs;
  }, [datasetMetrics]);

  const filteredPairs = useMemo(() => {
    if (!positivePairs.length) return [];
    const limitByPercent = Math.max(1, Math.round(positivePairs.length * (phiPercent / 100)));
    const limit = Math.min(limitByPercent, MAX_RENDER_PAIRS);
    return positivePairs.slice(0, limit);
  }, [positivePairs, phiPercent]);

  const nodeCounts = useMemo(() => {
    const counts = new Map();
    filteredPairs.forEach((pair) => {
      const source = normalizeLabel(pair.sourceLabel);
      const target = normalizeLabel(pair.targetLabel);
      counts.set(source, (counts.get(source) || 0) + 1);
      counts.set(target, (counts.get(target) || 0) + 1);
    });
    return counts;
  }, [filteredPairs]);

  const summary = useMemo(() => {
    const weights = filteredPairs.map((pair) => pair.weight);
    const meanWeight = computeMean(weights);
    const maxWeight = weights.length ? Math.max(...weights) : 0;
    const minWeight = weights.length ? Math.min(...weights) : 0;

    const affectedNodes = Array.from(nodeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => {
        const leafMetric = datasetMetrics?.leafMetrics?.find(
          (leaf) => normalizeLabel(leaf.label) === label
        );
        return {
          label,
          count,
          meanError: leafMetric?.meanError ?? null
        };
      });

    return {
      totalPairs: positivePairs.length,
      selectedPairs: filteredPairs.length,
      meanWeight,
      maxWeight,
      minWeight,
      affectedNodes
    };
  }, [filteredPairs, nodeCounts, positivePairs.length, datasetMetrics]);

  const selectedLabel = selectedNode ? normalizeLabel(selectedNode.name || selectedNode.id) : null;

  const selectedNodeDetails = useMemo(() => {
    if (!selectedLabel) return null;
    const neighbors = filteredPairs
      .filter((pair) => {
        const source = normalizeLabel(pair.sourceLabel);
        const target = normalizeLabel(pair.targetLabel);
        return source === selectedLabel || target === selectedLabel;
      })
      .map((pair) => {
        const isSource = normalizeLabel(pair.sourceLabel) === selectedLabel;
        const neighborLabel = isSource ? pair.targetLabel : pair.sourceLabel;
        return {
          label: neighborLabel,
          weight: pair.weight
        };
      })
      .sort((a, b) => b.weight - a.weight);

    return {
      label: selectedLabel,
      count: neighbors.length,
      neighbors
    };
  }, [filteredPairs, selectedLabel]);

  useEffect(() => {
    const rootData = datasetMetrics?.root;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!rootData) {
      return;
    }

    const width = Math.max(360, dimensions.width || 0);
    const height = Math.max(360, dimensions.height || 0);
    svg.attr("width", width).attr("height", height);

    const weightValues = filteredPairs.map((pair) => pair.weight);
    const maxWeight = weightValues.length ? Math.max(...weightValues) : 0;
    const minWeight = weightValues.length ? Math.min(...weightValues) : 0;

    const colorScale = d3.scaleSequential(d3.interpolateInferno)
      .domain([minWeight || 0, maxWeight || 1]);

    const widthScale = d3.scaleLinear()
      .domain([minWeight || 0, maxWeight || 1])
      .range([1.25, 6]);

    const maxCount = nodeCounts.size ? Math.max(...nodeCounts.values()) : 0;
    const countColorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxCount || 1]);

    const selectedNormalized = selectedLabel ? normalizeLabel(selectedLabel) : null;

    const theme = {
      ...defaultTreeTheme,
      branch: {
        ...defaultTreeTheme.branch,
        stroke: "rgba(148, 163, 184, 0.35)",
        width: 1.1
      },
      leaf: {
        ...defaultTreeTheme.leaf,
        fill: "#e2e8f0"
      },
      internal: {
        ...defaultTreeTheme.internal,
        baseFill: "#f8fafc"
      },
      label: {
        ...defaultTreeTheme.label,
        color: textColor
      }
    };

    const renderResult = renderRadialTree({
      svg,
      rootData,
      width,
      height,
      theme,
      showLabels,
      leafColorAccessor: (node) => {
        if (node.children && node.children.length) {
          return theme.internal.baseFill;
        }
        const label = normalizeLabel(node.data?.name ?? node.data?.id);
        const count = nodeCounts.get(label) || 0;
        return count > 0 ? countColorScale(count) : theme.leaf.fill;
      },
      internalColorAccessor: (node) => {
        const leafLabels = node.leaves?.() ?? [];
        if (!leafLabels.length) {
          return theme.internal.baseFill;
        }
        const avgCount = leafLabels.reduce((acc, leaf) => {
          const label = normalizeLabel(leaf.data?.name ?? leaf.data?.id);
          return acc + (nodeCounts.get(label) || 0);
        }, 0) / leafLabels.length;
        return countColorScale(avgCount);
      },
      highlight: {
        nodes: (node) => {
          if (!selectedNormalized) return false;
          const label = normalizeLabel(node.data?.name ?? node.data?.id);
          return label === selectedNormalized;
        }
      },
      nodeStyler: (node) => {
        const isLeaf = !node.children || node.children.length === 0;
        const style = {};

        if (isLeaf) {
          const label = normalizeLabel(node.data?.name ?? node.data?.id);
          const count = nodeCounts.get(label) || 0;
          style.radius = count > 0 ? 4 + Math.min(3, count) : 3;

          if (selectedNormalized) {
            if (label === selectedNormalized) {
              style.stroke = "#f97316";
              style.strokeWidth = 2.4;
              style.opacity = 1;
            } else {
              style.opacity = 0.25;
            }
          }
        } else if (selectedNormalized) {
          style.opacity = 0.35;
        }

        return style;
      },
      useBranchLengths: showBranchLength,
      onLeafClick: (node) => setSelectedNode(node.data)
    });

    const hierarchyRoot = renderResult.root;
    const treeGroup = renderResult.treeGroup;

    const leafByLabel = new Map();
    hierarchyRoot.leaves().forEach((leaf) => {
      leafByLabel.set(normalizeLabel(leaf.data?.name ?? leaf.data?.id), leaf);
    });

    const projectPoint = (node) => {
      const angle = (node.x - 90) * (Math.PI / 180);
      const radius = showBranchLength && node.radius !== undefined ? node.radius : node.y;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    };

    const lineGenerator = d3.line().curve(d3.curveBundle.beta(0.85));

    if (filteredPairs.length > 0) {
      const bundleGroup = treeGroup.insert("g", ".tree-nodes")
        .attr("class", "missing-neighbor-bundles");

      const paths = bundleGroup.selectAll("path")
        .data(filteredPairs)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", (pair) => colorScale(pair.weight))
        .attr("stroke-width", (pair) => widthScale(pair.weight))
        .attr("stroke-opacity", (pair) => {
          if (!selectedNormalized) return 0.78;
          const source = normalizeLabel(pair.sourceLabel);
          const target = normalizeLabel(pair.targetLabel);
          return (source === selectedNormalized || target === selectedNormalized) ? 0.95 : 0.08;
        })
        .attr("d", (pair) => {
          const sourceLeaf = leafByLabel.get(normalizeLabel(pair.sourceLabel));
          const targetLeaf = leafByLabel.get(normalizeLabel(pair.targetLabel));
          if (!sourceLeaf || !targetLeaf) return null;
          const pathNodes = sourceLeaf.path(targetLeaf);
          const points = pathNodes.map(projectPoint);
          return lineGenerator(points);
        });

      paths.append("title")
        .text((pair) => `${pair.sourceLabel} ↔ ${pair.targetLabel} · ${formatNumber(pair.weight, 3)}`);
    }

    const nodeGroup = treeGroup.select(".tree-nodes");
    if (!nodeGroup.empty()) {
      nodeGroup
        .selectAll("g")
        .filter((d) => d && (!d.children || d.children.length === 0))
        .append("title")
        .text((d) => {
          const label = normalizeLabel(d?.data?.name ?? d?.data?.id);
          const count = nodeCounts.get(label) || 0;
          return `${d?.data?.name ?? ""}\nMissing neighbors: ${count}`;
        });
    }

    const treeRootGroup = svg.select(".radial-tree-root");
    const zoom = d3.zoom()
      .scaleExtent([0.6, 4])
      .on("zoom", (event) => {
        treeRootGroup.attr("transform", `translate(${width / 2}, ${height / 2}) ${event.transform}`);
      });

    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("click", (event) => {
      if (event.target === svg.node()) {
        setSelectedNode(null);
      }
    });
  }, [
    datasetMetrics,
    filteredPairs,
    nodeCounts,
    selectedLabel,
    dimensions,
    showBranchLength,
    showLabels,
    textColor
  ]);

  if (!projectionQuality?.t1) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          Run the quality analysis from the Aggregated Errors tab to enable the missing neighbors visualization.
        </Alert>
      </Box>
    );
  }

  if (!datasetMetrics) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Spinner size="lg" color="blue.500" />
          <Text fontSize="sm" color="gray.600">
            Processing dataset metrics. This view will update automatically once results are available.
          </Text>
        </VStack>
      </Box>
    );
  }

  const phiLabel = `${formatNumber(phiPercent, 1)}%`;

  return (
    <Box h="full" display="flex">
      <Box w="360px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Missing Neighbors Analysis</Text>
          <Text fontSize="sm" color="gray.600">
            Highlights high-distance discrepancies (missing neighbors) detected between the original space and the Neighbor Joining tree.
          </Text>

          <Divider />

          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Datasets</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs">T1 Dataset:</Text>
                  <Badge colorScheme="blue">{currentDataset?.length ?? 0} nodes</Badge>
                </HStack>
                {comparisonDataset && (
                  <HStack justify="space-between">
                    <Text fontSize="xs">T2 Dataset:</Text>
                    <Badge colorScheme="purple">{comparisonDataset.length} nodes</Badge>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>

          {comparisonDataset && hasT2Metrics && (
            <Card>
              <CardBody>
                <FormControl>
                  <FormLabel fontSize="sm">View Dataset</FormLabel>
                  <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="sm">
                    <option value="t1">T1 Missing Neighbors</option>
                    <option value="t2">T2 Missing Neighbors</option>
                  </Select>
                </FormControl>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <FormControl>
                  <FormLabel fontSize="sm">Worst-Pair Coverage ({phiLabel})</FormLabel>
                  <Slider
                    value={phiPercent}
                    min={0.5}
                    max={20}
                    step={0.5}
                    onChange={setPhiPercent}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb boxSize={4} />
                  </Slider>
                  <Stat mt={2} size="sm">
                    <StatHelpText>
                      Displaying up to {Math.min(filteredPairs.length, MAX_RENDER_PAIRS)} of {summary.totalPairs} positive error pairs.
                    </StatHelpText>
                  </Stat>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="branch-length" mb={0} fontSize="sm">
                    Use Branch Length
                  </FormLabel>
                  <Switch
                    id="branch-length"
                    isChecked={showBranchLength}
                    onChange={(e) => setShowBranchLength(e.target.checked)}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-labels" mb={0} fontSize="sm">
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

          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Missing Neighbor Metrics</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Stat size="sm">
                  <StatLabel>Pairs Displayed</StatLabel>
                  <StatNumber>{summary.selectedPairs}</StatNumber>
                  <StatHelpText>Total positive pairs: {summary.totalPairs}</StatHelpText>
                </Stat>
                <HStack justify="space-between">
                  <Text fontSize="xs">Average Missing Error:</Text>
                  <Badge>{formatNumber(summary.meanWeight, 4)}</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="xs">Maximum Error:</Text>
                  <Badge colorScheme="red">{formatNumber(summary.maxWeight, 4)}</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="xs">Minimum Error:</Text>
                  <Badge colorScheme="green">{formatNumber(summary.minWeight, 4)}</Badge>
                </HStack>
                <Progress
                  value={summary.totalPairs ? (summary.selectedPairs / summary.totalPairs) * 100 : 0}
                  size="xs"
                  colorScheme="orange"
                />
              </VStack>
            </CardBody>
          </Card>

          {summary.affectedNodes.length > 0 && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Top Affected Nodes</Text>
              </CardHeader>
              <CardBody>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th fontSize="xs">Node</Th>
                      <Th fontSize="xs">Count</Th>
                      <Th fontSize="xs">Avg Error</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {summary.affectedNodes.slice(0, 8).map((node, idx) => (
                      <Tr key={`${node.label}-${idx}`}>
                        <Td fontSize="xs">{node.label.substring(0, 22)}</Td>
                        <Td fontSize="xs">{node.count}</Td>
                        <Td fontSize="xs">{node.meanError !== null ? formatNumber(node.meanError, 4) : "-"}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          )}

          {selectedNodeDetails && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">{selectedNodeDetails.label}</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="xs" color="gray.600">
                    {selectedNodeDetails.count} missing neighbor{selectedNodeDetails.count === 1 ? "" : "s"} in the current selection.
                  </Text>
                  {selectedNodeDetails.neighbors.slice(0, 8).map((neighbor, index) => (
                    <HStack key={`${neighbor.label}-${index}`} justify="space-between">
                      <Text fontSize="xs" noOfLines={1}>{neighbor.label}</Text>
                      <Badge colorScheme="orange">{formatNumber(neighbor.weight, 4)}</Badge>
                    </HStack>
                  ))}
                  {selectedNodeDetails.neighbors.length > 8 && (
                    <Text fontSize="xs" color="gray.500">+{selectedNodeDetails.neighbors.length - 8} more</Text>
                  )}
                  <Button
                    size="sm"
                    colorScheme="gray"
                    variant="outline"
                    onClick={() => setSelectedNode(null)}
                    width="full"
                    mt={2}
                  >
                    Clear Selection
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Box>

      <Box ref={containerRef} flex={1} bg={bgColor} position="relative">
        {datasetMetrics ? (
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)">
            <VStack spacing={4}>
              <Spinner size="lg" color="blue.500" />
              <Text fontSize="sm" color="gray.600">Preparing visualization...</Text>
            </VStack>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MissingNeighborsTreeView;

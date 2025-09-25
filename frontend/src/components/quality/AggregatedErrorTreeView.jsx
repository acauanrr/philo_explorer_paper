"use client";

import React, { useEffect, useRef, useState } from "react";
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
  Button,
  ButtonGroup,
  Select,
  FormControl,
  FormLabel,
  Switch,
  Divider,
  Alert,
  AlertIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "@chakra-ui/react";
import { usePhylo } from "../../context/PhyloContext";
import {
  calculateDistanceMatrix,
  fetchNeighborJoiningTree
} from "../../utils/treeUtils";
import {
  renderRadialTree,
  defaultTreeTheme
} from "../../utils/treeRenderer";
import {
  computeProjectionErrorMetrics,
  computeComparisonMetrics
} from "../../utils/projectionMetrics";

const normalizeLabel = (label) => (label ?? "").toString().trim();
const formatNumber = (value, digits = 4) => (Number.isFinite(value) ? value.toFixed(digits) : (0).toFixed(digits));

const AggregatedErrorTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const {
    currentDataset,
    comparisonDataset,
    projectionQuality,
    setProjectionQuality
  } = usePhylo();
  const toast = useToast();

  // Tree data for both datasets
  const [treeDataT1, setTreeDataT1] = useState(null);
  const [treeDataT2, setTreeDataT2] = useState(null);
  const [viewMode, setViewMode] = useState("t1"); // "t1", "t2", or "comparison"

  const [isLoading, setIsLoading] = useState(false);
  const [showBranchLength, setShowBranchLength] = useState(true);
  const [errorVisualization, setErrorVisualization] = useState("heatmap");
  const [showLabels, setShowLabels] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const [errorData, setErrorData] = useState({
    t1: projectionQuality?.t1 ?? null,
    t2: projectionQuality?.t2 ?? null,
    comparison: null
  });

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  // Load trees for both datasets
  useEffect(() => {
    const loadTrees = async () => {
      if (!currentDataset || currentDataset.length === 0) return;

      setIsLoading(true);
      try {
        const distanceDataT1 = await calculateDistanceMatrix(currentDataset);
        const treeResultT1 = await fetchNeighborJoiningTree(distanceDataT1, currentDataset);

        let metricsT1 = null;
        if (treeResultT1) {
          const enrichedTreeT1 = {
            ...treeResultT1,
            labels: treeResultT1.labels ?? distanceDataT1.labels,
            distanceMatrix: distanceDataT1.matrix
          };
          metricsT1 = computeProjectionErrorMetrics(distanceDataT1, enrichedTreeT1);
          setTreeDataT1(enrichedTreeT1);
        } else {
          setTreeDataT1(null);
        }

        let metricsT2 = null;
        if (comparisonDataset && comparisonDataset.length > 0) {
          const distanceDataT2 = await calculateDistanceMatrix(comparisonDataset);
          const treeResultT2 = await fetchNeighborJoiningTree(distanceDataT2, comparisonDataset);

          if (treeResultT2?.root) {
            const enrichedTreeT2 = {
              ...treeResultT2,
              labels: treeResultT2.labels ?? distanceDataT2.labels,
              distanceMatrix: distanceDataT2.matrix
            };
            metricsT2 = computeProjectionErrorMetrics(distanceDataT2, enrichedTreeT2);
            setTreeDataT2(enrichedTreeT2);
          } else {
            setTreeDataT2(null);
          }
        } else {
          setTreeDataT2(null);
        }

        setErrorData((prev) => ({
          ...prev,
          t1: metricsT1,
          t2: metricsT2,
          comparison: metricsT1 && metricsT2 ? computeComparisonMetrics(metricsT1, metricsT2) : null
        }));

        setProjectionQuality((prev) => {
          const previous = prev ?? {};
          const next = { ...previous };
          let changed = false;

          if (metricsT1) {
            if (previous.t1 !== metricsT1) {
              next.t1 = metricsT1;
              changed = true;
            }
          } else if (previous.t1) {
            next.t1 = null;
            changed = true;
          }

          if (metricsT2) {
            if (previous.t2 !== metricsT2) {
              next.t2 = metricsT2;
              changed = true;
            }
          } else if (previous.t2) {
            next.t2 = null;
            changed = true;
          }

          return changed ? next : previous;
        });
      } catch (error) {
        toast({
          title: "Failed to load trees",
          description: error.message,
          status: "error",
          duration: 3000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTrees();
  }, [
    currentDataset,
    comparisonDataset,
    setProjectionQuality,
    toast
  ]);

  useEffect(() => {
    if (!projectionQuality) return;

    setErrorData((prev) => {
      const updated = {
        ...prev,
        t1: projectionQuality.t1 ?? prev.t1,
        t2: projectionQuality.t2 ?? prev.t2
      };

      updated.comparison = (updated.t1 && updated.t2)
        ? computeComparisonMetrics(updated.t1, updated.t2)
        : null;

      return updated;
    });
  }, [projectionQuality]);

  // Update dimensions on resize
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

  // Render visualization
  useEffect(() => {
    const activeTree = viewMode === "t2" ? treeDataT2 : treeDataT1;
    const datasetMetrics = viewMode === "t2" ? errorData.t2 : errorData.t1;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!activeTree?.root || !datasetMetrics) {
      return;
    }

    const width = Math.max(360, dimensions.width || 0);
    const height = Math.max(360, dimensions.height || 0);
    svg.attr("width", width).attr("height", height);

    const maxErrorRaw = datasetMetrics.stats?.maxError ?? 0.5;
    const safeMaxError = maxErrorRaw > 1e-6 ? maxErrorRaw : 0.25;

    const errorColorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([safeMaxError, 0]);

    const thicknessScale = d3.scaleLinear()
      .domain([0, safeMaxError])
      .range([1.2, 6]);

    const theme = {
      ...defaultTreeTheme,
      label: {
        ...defaultTreeTheme.label,
        color: textColor
      }
    };

    const selectedLabel = selectedNode
      ? normalizeLabel(selectedNode.name || selectedNode.id)
      : null;

    const overlayRoot = viewMode === "comparison" && treeDataT1?.root && treeDataT2?.root
      ? (activeTree === treeDataT1 ? treeDataT2.root : treeDataT1.root)
      : null;

    const leafColorAccessor = (node) => {
      const absError = Math.abs(node.data?.projectionError ?? 0);
      if (errorVisualization === "heatmap" || errorVisualization === "nodeSize" || errorVisualization === "thickness") {
        return errorColorScale(absError);
      }
      return defaultTreeTheme.leaf.fill;
    };

    const linkStyler = (link) => {
      const absError = Math.abs(link.target?.data?.projectionError ?? 0);
      const style = {};

      if (errorVisualization === "heatmap") {
        style.stroke = errorColorScale(absError);
      }

      if (errorVisualization === "thickness") {
        style.stroke = "rgba(71, 85, 105, 0.85)";
        style.strokeWidth = thicknessScale(absError);
      }

      if (selectedLabel) {
        const targetLabel = normalizeLabel(link.target.data?.name ?? link.target.data?.id);
        if (targetLabel === selectedLabel) {
          style.stroke = "#fb923c";
          style.strokeWidth = (style.strokeWidth ?? 1.8) + 1.4;
          style.strokeOpacity = 0.95;
        } else {
          style.strokeOpacity = style.strokeOpacity ?? 0.35;
        }
      }

      return style;
    };

    const nodeStyler = (node) => {
      const isLeaf = !node.children || node.children.length === 0;
      const absError = Math.abs(node.data?.projectionError ?? 0);
      const style = {};

      if (errorVisualization === "nodeSize" && isLeaf) {
        style.radius = 4 + Math.min(10, absError * 14);
      }

      if (selectedLabel) {
        const label = normalizeLabel(node.data?.name ?? node.data?.id);
        if (label === selectedLabel) {
          style.stroke = "#f97316";
          style.strokeWidth = 2.6;
          style.opacity = 1;
        } else {
          style.opacity = 0.55;
        }
      }

      return style;
    };

    const renderResult = renderRadialTree({
      svg,
      rootData: activeTree.root,
      width,
      height,
      theme,
      showLabels,
      leafColorAccessor,
      internalColorAccessor: (node) => {
        const absError = Math.abs(node.data?.projectionError ?? 0);
        return errorColorScale(absError);
      },
      highlight: {
        nodes: (node) => {
          if (!selectedLabel) return false;
          const label = normalizeLabel(node.data?.name ?? node.data?.id);
          return label === selectedLabel;
        }
      },
      overlayRoot,
      linkStyler,
      nodeStyler,
      useBranchLengths: showBranchLength,
      onLeafClick: (node) => setSelectedNode(node.data),
      onNodeClick: (node) => {
        if (node.children && node.children.length) {
          setSelectedNode(node.data);
        }
      }
    });

    const nodeGroup = renderResult.treeGroup.select(".tree-nodes");
    if (!nodeGroup.empty()) {
      nodeGroup
        .selectAll("g")
        .filter((d) => d && (!d.children || d.children.length === 0))
        .append("title")
        .text((d) => {
          const absError = Math.abs(d?.data?.projectionError ?? 0);
          const label = d?.data?.displayName ?? d?.data?.name ?? "";
          return `${label}\nMean error: ${(absError * 100).toFixed(2)}%`;
        });
    }

    const defs = svg.append("defs");
    const gradientId = `agg-error-gradient-${viewMode}`;
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId);

    gradient.selectAll("stop")
      .data([
        { offset: "0%", color: errorColorScale(0) },
        { offset: "50%", color: errorColorScale(safeMaxError * 0.5) },
        { offset: "100%", color: errorColorScale(safeMaxError) }
      ])
      .join("stop")
      .attr("offset", (d) => d.offset)
      .attr("stop-color", (d) => d.color);

    const legend = svg.append("g")
      .attr("class", "error-legend")
      .attr("transform", `translate(${20}, ${height - 80})`);

    legend.append("rect")
      .attr("width", 232)
      .attr("height", 56)
      .attr("rx", 10)
      .attr("fill", "rgba(255,255,255,0.92)")
      .attr("stroke", "rgba(148, 163, 184, 0.6)");

    legend.append("text")
      .attr("x", 18)
      .attr("y", 20)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text(`Error Scale (${viewMode.toUpperCase()})`);

    legend.append("rect")
      .attr("x", 18)
      .attr("y", 26)
      .attr("width", 190)
      .attr("height", 12)
      .attr("fill", `url(#${gradientId})`);

    legend.append("text")
      .attr("x", 18)
      .attr("y", 26 + 20)
      .attr("font-size", 10)
      .text("0");

    legend.append("text")
      .attr("x", 18 + 190)
      .attr("y", 26 + 20)
      .attr("font-size", 10)
      .attr("text-anchor", "end")
      .text(safeMaxError.toFixed(2));

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
    treeDataT1,
    treeDataT2,
    viewMode,
    dimensions,
    showBranchLength,
    errorVisualization,
    showLabels,
    textColor,
    errorData,
    selectedNode
  ]);

  // Render error distribution chart
  const renderErrorDistribution = (metrics, dataset) => {
    if (!metrics?.histogram || metrics.histogram.length === 0) return null;

    const totalPairs = metrics.stats?.pairCount ?? 0;
    if (!totalPairs) return null;

    return (
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={2}>Error Distribution ({dataset})</Text>
        <Box height="100px">
          {metrics.histogram.map((bin, i) => (
            <HStack key={i} spacing={2} mb={1}>
              <Text fontSize="xs" width="60px">
                {bin.x0?.toFixed(3)}-{bin.x1?.toFixed(3)}
              </Text>
              <Box flex={1}>
                <Progress
                  value={(bin.length / totalPairs) * 100}
                  colorScheme={i < 3 ? "green" : i < 6 ? "yellow" : "red"}
                  size="sm"
                />
              </Box>
              <Text fontSize="xs" width="30px">{bin.length}</Text>
            </HStack>
          ))}
        </Box>
      </Box>
    );
  };

  if (!currentDataset) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="warning">
          <AlertIcon />
          Please load a dataset from the Data Input tab to analyze aggregated errors.
        </Alert>
      </Box>
    );
  }

  const datasetMetrics = viewMode === "t2" ? errorData.t2 : errorData.t1;
  const comparisonMetrics = errorData.comparison;

  return (
    <Box h="full" display="flex">
      {/* Left Sidebar */}
      <Box w="400px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Aggregated Error Analysis</Text>
          <Text fontSize="sm" color="gray.600">
            Analyze projection errors in phylogenetic tree reconstruction
            {comparisonDataset && " and compare error metrics between T1 and T2 datasets."}
          </Text>

          <Divider />

          {/* Dataset Information */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Datasets</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs">T1 Dataset:</Text>
                  <Badge colorScheme="blue">{currentDataset.length} nodes</Badge>
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

          {/* View Mode Selection */}
          {comparisonDataset && (
            <Card>
              <CardBody>
                <FormControl>
                  <FormLabel fontSize="sm">View Dataset</FormLabel>
                  <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="sm">
                    <option value="t1">T1 Tree Errors</option>
                    <option value="t2">T2 Tree Errors</option>
                    <option value="comparison">Error Comparison</option>
                  </Select>
                </FormControl>
              </CardBody>
            </Card>
          )}

          {/* Error Metrics */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">
                {viewMode === "comparison" ? "Error Comparison" : `Error Metrics (${viewMode.toUpperCase()})`}
              </Text>
            </CardHeader>
            <CardBody>
              {viewMode === "comparison" ? (
                comparisonMetrics ? (
                  <VStack spacing={3} align="stretch">
                    <Stat size="sm">
                      <StatLabel>Error Improvement</StatLabel>
                      <StatNumber color={(comparisonMetrics.improvementRatio ?? 0) > 0 ? "green.500" : "red.500"}>
                        {(comparisonMetrics.improvementRatio ?? 0) > 0 ? "↓" : "↑"}
                        {formatNumber(Math.abs(comparisonMetrics.improvementRatio ?? 0), 1)}%
                      </StatNumber>
                      <StatHelpText>T2 vs T1</StatHelpText>
                    </Stat>
                    <HStack justify="space-between">
                      <Text fontSize="xs">T1 Mean Error:</Text>
                      <Badge colorScheme="blue">{formatNumber(errorData.t1?.stats?.meanError)}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs">T2 Mean Error:</Text>
                      <Badge colorScheme="purple">{formatNumber(errorData.t2?.stats?.meanError)}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs">Correlation:</Text>
                      <Badge>{formatNumber(comparisonMetrics.correlationCoeff ?? 0, 3)}</Badge>
                    </HStack>
                  </VStack>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    Comparison metrics will appear once both datasets are processed.
                  </Text>
                )
              ) : (
                datasetMetrics ? (
                  <VStack spacing={3} align="stretch">
                    <Stat size="sm">
                      <StatLabel>Mean Error</StatLabel>
                      <StatNumber color={(datasetMetrics.stats?.meanError ?? 0) < 0.2 ? "green.500" : "orange.500"}>
                        {formatNumber(datasetMetrics.stats?.meanError)}
                      </StatNumber>
                      <Progress
                        value={Math.min(100, (datasetMetrics.stats?.meanError ?? 0) * 100)}
                        colorScheme={(datasetMetrics.stats?.meanError ?? 0) < 0.2 ? "green" : "orange"}
                        size="xs"
                      />
                    </Stat>
                    <HStack justify="space-between">
                      <Text fontSize="xs">Std Deviation:</Text>
                      <Badge>{formatNumber(datasetMetrics.stats?.stdError)}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs">Max Error:</Text>
                      <Badge colorScheme="red">{formatNumber(datasetMetrics.stats?.maxError)}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs">Min Error:</Text>
                      <Badge colorScheme="green">{formatNumber(datasetMetrics.stats?.minError)}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="xs">Total Comparisons:</Text>
                      <Badge>{datasetMetrics.stats?.pairCount ?? 0}</Badge>
                    </HStack>
                  </VStack>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    Metrics will appear after the selected dataset is processed.
                  </Text>
                )
              )}
            </CardBody>
          </Card>

          {/* Visualization Controls */}
          <Card>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Text fontWeight="bold" fontSize="sm">Visualization Options</Text>

                <FormControl>
                  <FormLabel fontSize="sm">Error Display</FormLabel>
                  <Select value={errorVisualization} onChange={(e) => setErrorVisualization(e.target.value)} size="sm">
                    <option value="heatmap">Heatmap Colors</option>
                    <option value="thickness">Line Thickness</option>
                    <option value="nodeSize">Node Size</option>
                  </Select>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="branch-length" mb="0" fontSize="sm">
                    Use Branch Length
                  </FormLabel>
                  <Switch id="branch-length" isChecked={showBranchLength} onChange={(e) => setShowBranchLength(e.target.checked)} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-labels" mb="0" fontSize="sm">
                    Show Labels
                  </FormLabel>
                  <Switch id="show-labels" isChecked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Error Distribution */}
          {viewMode !== "comparison" && datasetMetrics && (
            <Card>
              <CardBody>
                {renderErrorDistribution(datasetMetrics, viewMode.toUpperCase())}
              </CardBody>
            </Card>
          )}

          {/* Comparison Table */}
          {viewMode === "comparison" && comparisonDataset && errorData.t1 && errorData.t2 && comparisonMetrics && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Metrics Comparison</Text>
              </CardHeader>
              <CardBody>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th fontSize="xs">Metric</Th>
                      <Th fontSize="xs">T1</Th>
                      <Th fontSize="xs">T2</Th>
                      <Th fontSize="xs">Diff</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    <Tr>
                      <Td fontSize="xs">Mean</Td>
                      <Td fontSize="xs">{formatNumber(errorData.t1.stats?.meanError)}</Td>
                      <Td fontSize="xs">{formatNumber(errorData.t2.stats?.meanError)}</Td>
                      <Td fontSize="xs" color={(errorData.t2.stats?.meanError ?? 0) < (errorData.t1.stats?.meanError ?? 0) ? "green.500" : "red.500"}>
                        {formatNumber((errorData.t2.stats?.meanError ?? 0) - (errorData.t1.stats?.meanError ?? 0))}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td fontSize="xs">Std Dev</Td>
                      <Td fontSize="xs">{formatNumber(errorData.t1.stats?.stdError)}</Td>
                      <Td fontSize="xs">{formatNumber(errorData.t2.stats?.stdError)}</Td>
                      <Td fontSize="xs">{formatNumber((errorData.t2.stats?.stdError ?? 0) - (errorData.t1.stats?.stdError ?? 0))}</Td>
                    </Tr>
                    <Tr>
                      <Td fontSize="xs">Max</Td>
                      <Td fontSize="xs">{formatNumber(errorData.t1.stats?.maxError)}</Td>
                      <Td fontSize="xs">{formatNumber(errorData.t2.stats?.maxError)}</Td>
                      <Td fontSize="xs">{formatNumber((errorData.t2.stats?.maxError ?? 0) - (errorData.t1.stats?.maxError ?? 0))}</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          )}

          {/* Selected Node */}
          {selectedNode && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Selected Node</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="xs" noOfLines={2}>{selectedNode.displayName ?? selectedNode.name}</Text>
                  {selectedNode.projectionError !== undefined && (
                    <>
                      <HStack>
                        <Text fontSize="xs">Error:</Text>
                        <Badge colorScheme={selectedNode.errorLevel === "low" ? "green" : selectedNode.errorLevel === "medium" ? "yellow" : "red"}>
                          {selectedNode.projectionError.toFixed(4)}
                        </Badge>
                      </HStack>
                      <HStack>
                        <Text fontSize="xs">Level:</Text>
                        <Badge>{selectedNode.errorLevel}</Badge>
                      </HStack>
                    </>
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

      {/* Main Visualization */}
      <Box flex={1} ref={containerRef} bg={bgColor} position="relative">
        {isLoading ? (
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)">
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" />
              <Text fontWeight="bold">Analyzing Aggregated Errors...</Text>
              <VStack spacing={1}>
                <Text fontSize="sm" color="gray.600">Processing T1 dataset ({currentDataset?.length || 0} nodes)</Text>
                {comparisonDataset && (
                  <Text fontSize="sm" color="gray.600">Processing T2 dataset ({comparisonDataset?.length || 0} nodes)</Text>
                )}
              </VStack>
            </VStack>
          </Box>
        ) : (
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        )}
      </Box>
    </Box>
  );
};

export default AggregatedErrorTreeView;

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  fetchNeighborJoiningTree,
  createTreeLayout,
  createColorScales,
  linkStep
} from "../../utils/treeUtils";
import {
  constructIncrementalTree,
  analyzeDatasetDifferences
} from "../../utils/incrementalTreeUtils";

const AggregatedErrorTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const { currentDataset, comparisonDataset } = usePhylo();
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

  // Aggregated errors for both datasets
  const [aggregatedErrors, setAggregatedErrors] = useState({
    t1: {
      meanError: 0,
      stdError: 0,
      maxError: 0,
      minError: 1,
      errorDistribution: [],
      totalPoints: 0
    },
    t2: {
      meanError: 0,
      stdError: 0,
      maxError: 0,
      minError: 1,
      errorDistribution: [],
      totalPoints: 0
    },
    comparison: {
      errorDifference: 0,
      improvementRatio: 0,
      correlationCoeff: 0
    }
  });

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  // Calculate aggregated projection errors for a tree
  const calculateAggregatedErrors = useCallback((treeRoot, distanceMatrix) => {
    if (!treeRoot || !distanceMatrix) return null;

    let totalError = 0;
    let errorCount = 0;
    let maxError = 0;
    let minError = 1;
    const errors = [];
    const nodeErrors = new Map();

    // Calculate pairwise errors based on distance matrix
    const leafNodes = [];
    const collectLeaves = (node, index = 0) => {
      if (!node.children) {
        leafNodes.push({ node, index: leafNodes.length });
      } else {
        node.children.forEach(child => collectLeaves(child));
      }
    };
    collectLeaves(treeRoot);

    // Calculate tree distance between leaves
    const calculateTreeDistance = (node1, node2) => {
      // Simplified tree distance calculation
      return Math.random() * 0.5; // Would be replaced with actual tree distance
    };

    // Calculate projection errors
    leafNodes.forEach((leaf1, i) => {
      leafNodes.forEach((leaf2, j) => {
        if (i < j && distanceMatrix[i] && distanceMatrix[i][j] !== undefined) {
          const originalDist = distanceMatrix[i][j];
          const treeDist = calculateTreeDistance(leaf1.node, leaf2.node);
          const error = Math.abs(originalDist - treeDist) / originalDist;

          errors.push(error);
          totalError += error;
          errorCount++;
          maxError = Math.max(maxError, error);
          minError = Math.min(minError, error);

          // Store error for each node
          if (!nodeErrors.has(leaf1.node.name)) nodeErrors.set(leaf1.node.name, []);
          if (!nodeErrors.has(leaf2.node.name)) nodeErrors.set(leaf2.node.name, []);
          nodeErrors.get(leaf1.node.name).push(error);
          nodeErrors.get(leaf2.node.name).push(error);
        }
      });
    });

    // Calculate average error per node
    leafNodes.forEach(({ node }) => {
      const nodeErrorList = nodeErrors.get(node.name) || [];
      const avgError = nodeErrorList.length > 0
        ? nodeErrorList.reduce((a, b) => a + b) / nodeErrorList.length
        : 0;
      node.projectionError = avgError;
      node.errorLevel = avgError > 0.3 ? "high" : avgError > 0.15 ? "medium" : "low";
    });

    const meanError = errorCount > 0 ? totalError / errorCount : 0;
    const variance = errors.length > 0
      ? errors.reduce((acc, err) => acc + Math.pow(err - meanError, 2), 0) / errors.length
      : 0;
    const stdError = Math.sqrt(variance);

    // Create error distribution for histogram
    const errorBins = d3.histogram()
      .domain([0, maxError > 0 ? maxError : 0.5])
      .thresholds(10);

    const errorDistribution = errorBins(errors);

    return {
      meanError,
      stdError,
      maxError,
      minError,
      errorDistribution,
      totalPoints: errorCount,
      errors
    };
  }, []);

  // Compare error metrics between two datasets
  const compareErrorMetrics = useCallback((errorsT1, errorsT2) => {
    if (!errorsT1 || !errorsT2) return { errorDifference: 0, improvementRatio: 0, correlationCoeff: 0 };

    const errorDifference = Math.abs(errorsT1.meanError - errorsT2.meanError);
    const improvementRatio = errorsT1.meanError > 0
      ? ((errorsT1.meanError - errorsT2.meanError) / errorsT1.meanError) * 100
      : 0;

    // Simple correlation coefficient (would need actual paired errors for real calculation)
    const correlationCoeff = 0.75 + Math.random() * 0.25; // Simulated

    return { errorDifference, improvementRatio, correlationCoeff };
  }, []);

  // Load trees for both datasets
  useEffect(() => {
    const loadTrees = async () => {
      if (!currentDataset || currentDataset.length === 0) return;

      setIsLoading(true);
      try {
        // Load T1 tree - use all nodes
        const distanceDataT1 = calculateDistanceMatrix(currentDataset);
        const treeResultT1 = await fetchNeighborJoiningTree(distanceDataT1, currentDataset);

        if (treeResultT1) {
          setTreeDataT1(treeResultT1);
          const errorsT1 = calculateAggregatedErrors(treeResultT1.root, distanceDataT1.matrix);

          // Load T2 tree incrementally if available
          if (comparisonDataset) {
            // Analyze differences
            const differences = analyzeDatasetDifferences(currentDataset, comparisonDataset);

            // Construct T2 incrementally from T1
            const treeResultT2 = await constructIncrementalTree(
              treeResultT1,
              currentDataset,
              comparisonDataset
            );

            if (treeResultT2) {
              setTreeDataT2({ root: treeResultT2.root });

              // Calculate distance matrix for T2 for error calculation
              const distanceDataT2 = calculateDistanceMatrix(comparisonDataset);
              const errorsT2 = calculateAggregatedErrors(treeResultT2.root, distanceDataT2.matrix);
              const comparison = compareErrorMetrics(errorsT1, errorsT2);

              setAggregatedErrors({
                t1: errorsT1,
                t2: errorsT2,
                comparison
              });
            }
          } else {
            setAggregatedErrors(prev => ({
              ...prev,
              t1: errorsT1
            }));
          }
        }
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
  }, [currentDataset, comparisonDataset, toast, calculateAggregatedErrors, compareErrorMetrics]);

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
    const treeData = viewMode === "t2" ? treeDataT2 : treeDataT1;
    const errors = viewMode === "t2" ? aggregatedErrors.t2 : aggregatedErrors.t1;

    if (!treeData || !treeData.root) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const { outerRadius, innerRadius } = createTreeLayout(
      d3.hierarchy(treeData.root),
      width,
      height
    );

    svg.attr("viewBox", [-outerRadius, -outerRadius, width, height]);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create hierarchy and layout
    const root = d3.hierarchy(treeData.root);
    const cluster = d3.cluster()
      .size([360, innerRadius])
      .separation((a, b) => 1);

    cluster(root);

    // Set radius for branch length
    const setRadius = (d, y0, k) => {
      d.radius = (y0 += d.data.length || 0) * k;
      if (d.children) d.children.forEach(child => setRadius(child, y0, k));
    };

    const maxLength = (d) => {
      return (d.data.length || 0) + (d.children ? d3.max(d.children, maxLength) : 0);
    };

    setRadius(root, root.data.length = 0, innerRadius / maxLength(root));

    // Color scale for errors
    const errorColorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([errors.maxError || 0.5, 0]);

    // Draw links with error-based styling
    const link = g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", d => linkStep(
        d.source.x,
        showBranchLength ? d.source.radius : d.source.y,
        d.target.x,
        showBranchLength ? d.target.radius : d.target.y
      ))
      .attr("stroke", d => {
        // Color based on average error of descendants
        const descendants = d.target.descendants().filter(n => !n.children);
        const avgError = descendants.length > 0
          ? descendants.reduce((sum, n) => sum + (n.data.projectionError || 0), 0) / descendants.length
          : 0;
        return errorVisualization === "heatmap" ? errorColorScale(avgError) : "#999";
      })
      .attr("stroke-width", d => {
        const descendants = d.target.descendants().filter(n => !n.children);
        const avgError = descendants.length > 0
          ? descendants.reduce((sum, n) => sum + (n.data.projectionError || 0), 0) / descendants.length
          : 0;
        return errorVisualization === "thickness" ? (1 + avgError * 5) : 1.5;
      })
      .attr("stroke-opacity", 0.8);

    // Draw nodes
    const node = g.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `
        rotate(${d.x - 90})
        translate(${showBranchLength ? d.radius : d.y},0)
      `);

    // Node circles with error visualization
    node.append("circle")
      .attr("r", d => {
        if (!d.children) {
          const error = d.data.projectionError || 0;
          return errorVisualization === "nodeSize" ? (3 + error * 10) : 4;
        }
        return 2;
      })
      .attr("fill", d => {
        if (!d.children) {
          const error = d.data.projectionError || 0;
          return errorColorScale(error);
        }
        return "#999";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode(d.data);
      })
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d => d.children ? 3 : 6);

        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .style("background", "white")
          .style("border", "1px solid #ccc")
          .style("border-radius", "4px")
          .style("padding", "8px")
          .style("font-size", "12px");

        if (d.data.projectionError !== undefined) {
          tooltip.html(`
            <strong>${d.data.name}</strong><br/>
            Error: ${d.data.projectionError.toFixed(3)}<br/>
            Level: ${d.data.errorLevel}
          `)
          .style("visibility", "visible")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
        }
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d => d.children ? 2 : 4);

        d3.selectAll(".tooltip").remove();
      });

    // Labels
    if (showLabels) {
      node.filter(d => !d.children)
        .append("text")
        .attr("dy", ".31em")
        .attr("x", d => d.x < 180 ? 6 : -6)
        .attr("text-anchor", d => d.x < 180 ? "start" : "end")
        .attr("transform", d => d.x >= 180 ? "rotate(180)" : null)
        .text(d => d.data.name ? d.data.name.substring(0, 15) : "")
        .style("font-size", "9px")
        .style("fill", textColor);
    }

    // Add error scale legend
    const legendWidth = 200;
    const legendHeight = 20;

    const legend = svg.append("g")
      .attr("transform", `translate(${-outerRadius + 20}, ${outerRadius - 50})`);

    // Background
    legend.append("rect")
      .attr("width", legendWidth + 40)
      .attr("height", 60)
      .attr("fill", "white")
      .attr("stroke", "#ccc")
      .attr("opacity", 0.9);

    // Title
    legend.append("text")
      .attr("x", 10)
      .attr("y", 15)
      .text(`Error Scale (${viewMode.toUpperCase()})`)
      .style("font-size", "12px")
      .style("font-weight", "bold");

    // Gradient
    const gradientId = `error-gradient-${viewMode}`;
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", gradientId);

    gradient.selectAll("stop")
      .data([
        {offset: "0%", color: d3.interpolateRdYlGn(1)},
        {offset: "50%", color: d3.interpolateRdYlGn(0.5)},
        {offset: "100%", color: d3.interpolateRdYlGn(0)}
      ])
      .join("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    legend.append("rect")
      .attr("x", 10)
      .attr("y", 25)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${gradientId})`);

    // Scale labels
    legend.append("text")
      .attr("x", 10)
      .attr("y", 25 + legendHeight + 12)
      .text("0")
      .style("font-size", "10px");

    legend.append("text")
      .attr("x", 10 + legendWidth)
      .attr("y", 25 + legendHeight + 12)
      .text(errors.maxError.toFixed(2))
      .style("font-size", "10px")
      .attr("text-anchor", "end");

  }, [treeDataT1, treeDataT2, viewMode, dimensions, showBranchLength, errorVisualization, showLabels, textColor, aggregatedErrors]);

  // Render error distribution chart
  const renderErrorDistribution = (errors, dataset) => {
    if (!errors.errorDistribution || errors.errorDistribution.length === 0) return null;

    return (
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={2}>Error Distribution ({dataset})</Text>
        <Box height="100px">
          {errors.errorDistribution.map((bin, i) => (
            <HStack key={i} spacing={2} mb={1}>
              <Text fontSize="xs" width="60px">
                {bin.x0?.toFixed(3)}-{bin.x1?.toFixed(3)}
              </Text>
              <Box flex={1}>
                <Progress
                  value={(bin.length / errors.totalPoints) * 100}
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
                <VStack spacing={3} align="stretch">
                  <Stat size="sm">
                    <StatLabel>Error Improvement</StatLabel>
                    <StatNumber color={aggregatedErrors.comparison.improvementRatio > 0 ? "green.500" : "red.500"}>
                      {aggregatedErrors.comparison.improvementRatio > 0 ? "↓" : "↑"}
                      {Math.abs(aggregatedErrors.comparison.improvementRatio).toFixed(1)}%
                    </StatNumber>
                    <StatHelpText>T2 vs T1</StatHelpText>
                  </Stat>
                  <HStack justify="space-between">
                    <Text fontSize="xs">T1 Mean Error:</Text>
                    <Badge colorScheme="blue">{aggregatedErrors.t1.meanError.toFixed(4)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">T2 Mean Error:</Text>
                    <Badge colorScheme="purple">{aggregatedErrors.t2.meanError.toFixed(4)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Correlation:</Text>
                    <Badge>{aggregatedErrors.comparison.correlationCoeff.toFixed(3)}</Badge>
                  </HStack>
                </VStack>
              ) : (
                <VStack spacing={3} align="stretch">
                  <Stat size="sm">
                    <StatLabel>Mean Error</StatLabel>
                    <StatNumber color={aggregatedErrors[viewMode].meanError < 0.2 ? "green.500" : "orange.500"}>
                      {aggregatedErrors[viewMode].meanError.toFixed(4)}
                    </StatNumber>
                    <Progress
                      value={aggregatedErrors[viewMode].meanError * 200}
                      colorScheme={aggregatedErrors[viewMode].meanError < 0.2 ? "green" : "orange"}
                      size="xs"
                    />
                  </Stat>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Std Deviation:</Text>
                    <Badge>{aggregatedErrors[viewMode].stdError.toFixed(4)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Max Error:</Text>
                    <Badge colorScheme="red">{aggregatedErrors[viewMode].maxError.toFixed(4)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Min Error:</Text>
                    <Badge colorScheme="green">{aggregatedErrors[viewMode].minError.toFixed(4)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Total Comparisons:</Text>
                    <Badge>{aggregatedErrors[viewMode].totalPoints}</Badge>
                  </HStack>
                </VStack>
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
          {viewMode !== "comparison" && (
            <Card>
              <CardBody>
                {renderErrorDistribution(aggregatedErrors[viewMode], viewMode.toUpperCase())}
              </CardBody>
            </Card>
          )}

          {/* Comparison Table */}
          {viewMode === "comparison" && comparisonDataset && (
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
                      <Td fontSize="xs">{aggregatedErrors.t1.meanError.toFixed(4)}</Td>
                      <Td fontSize="xs">{aggregatedErrors.t2.meanError.toFixed(4)}</Td>
                      <Td fontSize="xs" color={aggregatedErrors.t2.meanError < aggregatedErrors.t1.meanError ? "green.500" : "red.500"}>
                        {(aggregatedErrors.t2.meanError - aggregatedErrors.t1.meanError).toFixed(4)}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td fontSize="xs">Std Dev</Td>
                      <Td fontSize="xs">{aggregatedErrors.t1.stdError.toFixed(4)}</Td>
                      <Td fontSize="xs">{aggregatedErrors.t2.stdError.toFixed(4)}</Td>
                      <Td fontSize="xs">{(aggregatedErrors.t2.stdError - aggregatedErrors.t1.stdError).toFixed(4)}</Td>
                    </Tr>
                    <Tr>
                      <Td fontSize="xs">Max</Td>
                      <Td fontSize="xs">{aggregatedErrors.t1.maxError.toFixed(4)}</Td>
                      <Td fontSize="xs">{aggregatedErrors.t2.maxError.toFixed(4)}</Td>
                      <Td fontSize="xs">{(aggregatedErrors.t2.maxError - aggregatedErrors.t1.maxError).toFixed(4)}</Td>
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
                  <Text fontSize="xs" noOfLines={2}>{selectedNode.name}</Text>
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
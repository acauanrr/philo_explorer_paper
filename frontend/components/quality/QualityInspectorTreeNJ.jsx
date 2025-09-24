"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import {
  Box,
  VStack,
  HStack,
  Button,
  ButtonGroup,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  Switch,
  FormControl,
  FormLabel,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Divider,
  Select,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Tooltip,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";
import { usePhylo } from "../../src/context/PhyloContext";
import {
  calculateDistanceMatrix,
  fetchNeighborJoiningTree,
  createTreeLayout,
  linkStep,
  createColorScales
} from "../../src/utils/treeUtils";
import {
  constructIncrementalTree,
  analyzeDatasetDifferences,
  calculateTreeSimilarity
} from "../../src/utils/incrementalTreeUtils";

const QualityInspectorTreeNJ = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const { currentDataset, comparisonDataset } = usePhylo();
  const toast = useToast();

  // Visualization state
  const [nodeSize, setNodeSize] = useState(5);
  const [showLabels, setShowLabels] = useState(true);
  const [showErrors, setShowErrors] = useState(true);
  const [showBranchLength, setShowBranchLength] = useState(false);
  const [colorBy, setColorBy] = useState("category");
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLoading, setIsLoading] = useState(false);

  // Tree data for both datasets
  const [treeDataT1, setTreeDataT1] = useState(null);
  const [treeDataT2, setTreeDataT2] = useState(null);
  const [viewMode, setViewMode] = useState("t1"); // "t1", "t2", or "comparison"

  // Quality metrics for both datasets
  const [qualityMetrics, setQualityMetrics] = useState({
    t1: { meanError: 0, maxError: 0, minError: 0, coverage: 0, nodeCount: 0 },
    t2: { meanError: 0, maxError: 0, minError: 0, coverage: 0, nodeCount: 0 },
    comparison: { similarity: 0, differenceCount: 0, commonNodes: 0 }
  });

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  // Calculate quality metrics for a tree
  const calculateQualityMetrics = useCallback((treeRoot, datasetSize) => {
    if (!treeRoot) return { meanError: 0, maxError: 0, minError: 0, coverage: 0, nodeCount: 0 };

    let errors = [];
    let nodeCount = 0;

    const traverse = (node) => {
      if (!node.children) {
        nodeCount++;
        // Simulate error values for demonstration
        const error = Math.random() * 0.5;
        errors.push(error);
      } else {
        node.children.forEach(traverse);
      }
    };

    traverse(treeRoot);

    const meanError = errors.length > 0 ? errors.reduce((a, b) => a + b) / errors.length : 0;
    const maxError = errors.length > 0 ? Math.max(...errors) : 0;
    const minError = errors.length > 0 ? Math.min(...errors) : 0;
    const coverage = datasetSize > 0 ? nodeCount / datasetSize : 0;

    return { meanError, maxError, minError, coverage, nodeCount };
  }, []);

  // Compare two trees
  const compareTrees = useCallback((tree1, tree2) => {
    if (!tree1 || !tree2) return { similarity: 0, differenceCount: 0, commonNodes: 0 };

    const getLeaves = (node) => {
      const leaves = new Set();
      const traverse = (n) => {
        if (!n.children) {
          leaves.add(n.name);
        } else {
          n.children.forEach(traverse);
        }
      };
      traverse(node);
      return leaves;
    };

    const leaves1 = getLeaves(tree1);
    const leaves2 = getLeaves(tree2);

    const commonNodes = [...leaves1].filter(n => leaves2.has(n)).length;
    const totalUnique = new Set([...leaves1, ...leaves2]).size;
    const similarity = totalUnique > 0 ? commonNodes / totalUnique : 0;
    const differenceCount = Math.abs(leaves1.size - leaves2.size);

    return { similarity, differenceCount, commonNodes };
  }, []);

  // Load trees for both datasets
  useEffect(() => {
    const loadTrees = async () => {
      if (!currentDataset) return;

      setIsLoading(true);
      try {
        // Load T1 tree - use all nodes
        const distanceDataT1 = calculateDistanceMatrix(currentDataset);
        const treeResultT1 = await fetchNeighborJoiningTree(distanceDataT1, currentDataset);

        if (treeResultT1) {
          setTreeDataT1(treeResultT1);
          const metricsT1 = calculateQualityMetrics(treeResultT1.root, currentDataset.length);

          // Load T2 tree incrementally if available
          if (comparisonDataset) {
            // Analyze differences between datasets
            const differences = analyzeDatasetDifferences(currentDataset, comparisonDataset);
            console.log('Dataset differences:', differences);

            // Construct T2 incrementally from T1
            const treeResultT2 = await constructIncrementalTree(
              treeResultT1,
              currentDataset,
              comparisonDataset
            );

            if (treeResultT2) {
              setTreeDataT2({ root: treeResultT2.root, changeType: treeResultT2.changeType });
              const metricsT2 = calculateQualityMetrics(treeResultT2.root, comparisonDataset.length);

              // Calculate similarity between trees
              const similarity = calculateTreeSimilarity(treeResultT1.root, treeResultT2.root);
              const comparison = {
                similarity,
                differenceCount: differences.summary.addedCount + differences.summary.removedCount,
                commonNodes: differences.summary.unchangedCount,
                changeType: treeResultT2.changeType
              };

              setQualityMetrics({
                t1: metricsT1,
                t2: metricsT2,
                comparison
              });
            }
          } else {
            setQualityMetrics(prev => ({
              ...prev,
              t1: metricsT1
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
  }, [currentDataset, comparisonDataset, calculateQualityMetrics, compareTrees, toast]);

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

  // Render tree visualization
  useEffect(() => {
    const treeData = viewMode === "t2" ? treeDataT2 : treeDataT1;
    if (!treeData || !treeData.root) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height;
    const outerRadius = Math.min(width, height) / 2;
    const innerRadius = outerRadius - 170;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-outerRadius, -outerRadius, width, height]);

    const g = svg.append("g");

    // Create hierarchy
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

    // Color scales
    const { categoryColor, errorColor, qualityColor } = createColorScales();

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Links
    const link = g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .each(function(d) {
        d.target.linkNode = d.source;
      })
      .attr("d", d => linkStep(d.source.x, d.source.radius, d.target.x, showBranchLength ? d.target.radius : d.source.radius))
      .attr("stroke-width", d => {
        const errors = d.target.descendants().filter(n => !n.children).map(n => n.data.error || 0);
        const avgError = errors.length > 0 ? errors.reduce((a, b) => a + b) / errors.length : 0;
        return showErrors ? (1 + avgError * 3) : 1;
      })
      .attr("stroke", d => {
        if (!showErrors) return "#999";
        const errors = d.target.descendants().filter(n => !n.children).map(n => n.data.error || 0);
        const avgError = errors.length > 0 ? errors.reduce((a, b) => a + b) / errors.length : 0;
        return errorColor(avgError);
      });

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `
        rotate(${d.x - 90})
        translate(${showBranchLength ? d.radius : d.parent ? d.parent.radius : 0},0)
      `);

    // Node circles
    node.append("circle")
      .attr("r", d => d.children ? 2 : nodeSize)
      .attr("fill", d => {
        if (!d.children) {
          switch(colorBy) {
            case "category":
              return d.data.category ? categoryColor(d.data.category) : "#999";
            case "error":
              return errorColor(d.data.error || 0);
            case "quality":
              return qualityColor(d.data.qualityScore || 0);
            default:
              return "#69b3a2";
          }
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
        setHoveredNode(d.data);
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d => d.children ? 3 : nodeSize * 1.5);
      })
      .on("mouseout", function(event, d) {
        setHoveredNode(null);
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", d => d.children ? 2 : nodeSize);
      });

    // Labels
    if (showLabels) {
      node.filter(d => !d.children)
        .append("text")
        .attr("dy", ".31em")
        .attr("x", d => d.x < 180 ? 6 : -6)
        .attr("text-anchor", d => d.x < 180 ? "start" : "end")
        .attr("transform", d => d.x >= 180 ? "rotate(180)" : null)
        .text(d => d.data.name ? d.data.name.substring(0, 20) : "")
        .style("font-size", "10px")
        .style("fill", textColor);
    }

    // Add legend for comparison mode
    if (viewMode === "comparison" && treeDataT2) {
      const legend = svg.append("g")
        .attr("transform", `translate(${-outerRadius + 20}, ${-outerRadius + 20})`);

      legend.append("rect")
        .attr("width", 200)
        .attr("height", 80)
        .attr("fill", "white")
        .attr("stroke", "gray")
        .attr("opacity", 0.9);

      legend.append("text")
        .attr("x", 10)
        .attr("y", 20)
        .text(`T1: ${qualityMetrics.t1.nodeCount} nodes`)
        .style("font-size", "12px");

      legend.append("text")
        .attr("x", 10)
        .attr("y", 40)
        .text(`T2: ${qualityMetrics.t2.nodeCount} nodes`)
        .style("font-size", "12px");

      legend.append("text")
        .attr("x", 10)
        .attr("y", 60)
        .text(`Similarity: ${(qualityMetrics.comparison.similarity * 100).toFixed(1)}%`)
        .style("font-size", "12px");
    }

  }, [treeDataT1, treeDataT2, viewMode, dimensions, showLabels, showErrors, showBranchLength, colorBy, nodeSize, textColor, qualityMetrics]);

  if (!currentDataset) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="warning">
          <AlertIcon />
          Please load a dataset from the Data Input tab to inspect quality.
        </Alert>
      </Box>
    );
  }

  return (
    <Box h="full" display="flex">
      {/* Left Sidebar */}
      <Box w="350px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Quality Inspector</Text>
          <Text fontSize="sm" color="gray.600">
            Analyze phylogenetic tree quality using Neighbor Joining reconstruction
            {comparisonDataset && " and compare T1 with T2 datasets."}
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
                  <FormLabel fontSize="sm">View Mode</FormLabel>
                  <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="sm">
                    <option value="t1">T1 Tree</option>
                    <option value="t2">T2 Tree</option>
                    <option value="comparison">Comparison View</option>
                  </Select>
                </FormControl>
              </CardBody>
            </Card>
          )}

          {/* Quality Metrics */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">
                {viewMode === "comparison" ? "Comparison Metrics" : `Quality Metrics (${viewMode.toUpperCase()})`}
              </Text>
            </CardHeader>
            <CardBody>
              {viewMode === "comparison" ? (
                <VStack spacing={3} align="stretch">
                  <Stat size="sm">
                    <StatLabel>Similarity</StatLabel>
                    <StatNumber color="blue.500">
                      {(qualityMetrics.comparison.similarity * 100).toFixed(1)}%
                    </StatNumber>
                    <Progress value={qualityMetrics.comparison.similarity * 100} colorScheme="blue" size="xs" />
                  </Stat>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Common Nodes:</Text>
                    <Badge>{qualityMetrics.comparison.commonNodes}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Difference Count:</Text>
                    <Badge colorScheme="orange">{qualityMetrics.comparison.differenceCount}</Badge>
                  </HStack>
                </VStack>
              ) : (
                <VStack spacing={3} align="stretch">
                  <Stat size="sm">
                    <StatLabel>Mean Error</StatLabel>
                    <StatNumber color={qualityMetrics[viewMode].meanError < 0.3 ? "green.500" : "orange.500"}>
                      {qualityMetrics[viewMode].meanError.toFixed(3)}
                    </StatNumber>
                    <Progress value={qualityMetrics[viewMode].meanError * 100} colorScheme={qualityMetrics[viewMode].meanError < 0.3 ? "green" : "orange"} size="xs" />
                  </Stat>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Max Error:</Text>
                    <Badge colorScheme="red">{qualityMetrics[viewMode].maxError.toFixed(3)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Min Error:</Text>
                    <Badge colorScheme="green">{qualityMetrics[viewMode].minError.toFixed(3)}</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Coverage:</Text>
                    <Badge>{(qualityMetrics[viewMode].coverage * 100).toFixed(1)}%</Badge>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="xs">Node Count:</Text>
                    <Badge>{qualityMetrics[viewMode].nodeCount}</Badge>
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

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-labels" mb="0" fontSize="sm">
                    Show Labels
                  </FormLabel>
                  <Switch id="show-labels" isChecked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-errors" mb="0" fontSize="sm">
                    Show Errors
                  </FormLabel>
                  <Switch id="show-errors" isChecked={showErrors} onChange={(e) => setShowErrors(e.target.checked)} />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="branch-length" mb="0" fontSize="sm">
                    Use Branch Length
                  </FormLabel>
                  <Switch id="branch-length" isChecked={showBranchLength} onChange={(e) => setShowBranchLength(e.target.checked)} />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">Color By</FormLabel>
                  <Select value={colorBy} onChange={(e) => setColorBy(e.target.value)} size="sm">
                    <option value="category">Category</option>
                    <option value="error">Error Level</option>
                    <option value="quality">Quality Score</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">Node Size: {nodeSize}</FormLabel>
                  <Slider value={nodeSize} onChange={setNodeSize} min={2} max={10} step={1}>
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Selected Node Information */}
          {selectedNode && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Selected Node</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="xs" noOfLines={2}>{selectedNode.name}</Text>
                  {selectedNode.category && (
                    <Badge colorScheme="purple">{selectedNode.category}</Badge>
                  )}
                  {selectedNode.error !== undefined && (
                    <HStack>
                      <Text fontSize="xs">Error:</Text>
                      <Badge colorScheme={selectedNode.error < 0.3 ? "green" : "orange"}>
                        {selectedNode.error.toFixed(3)}
                      </Badge>
                    </HStack>
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
              <Text fontWeight="bold">Loading Quality Inspector...</Text>
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

export default QualityInspectorTreeNJ;
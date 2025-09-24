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
  Td,
} from "@chakra-ui/react";
import { usePhylo } from "../../context/PhyloContext";
import {
  calculateDistanceMatrix,
  fetchNeighborJoiningTree,
  createTreeLayout,
  linkStep
} from "../../utils/treeUtils";
import {
  constructIncrementalTree,
  analyzeDatasetDifferences,
  calculateTreeSimilarity
} from "../../utils/incrementalTreeUtils";

const CompareProjectionsTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const { currentDataset, comparisonDataset } = usePhylo();
  const toast = useToast();

  const [treeDataT1, setTreeDataT1] = useState(null);
  const [treeDataT2, setTreeDataT2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState("side-by-side");
  const [highlightDifferences, setHighlightDifferences] = useState(true);
  const [showNewNodes, setShowNewNodes] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [comparisonMetrics, setComparisonMetrics] = useState({
    addedNodes: [],
    removedNodes: [],
    structuralSimilarity: 0,
    topologyChange: 0,
    commonNodes: 0,
    t1NodeCount: 0,
    t2NodeCount: 0
  });

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  // Calculate comparison metrics between two trees
  const calculateComparisonMetrics = useCallback((tree1, tree2) => {
    if (!tree1 || !tree2) return;

    // Collect all leaf nodes from both trees
    const getLeafNodes = (node) => {
      const leaves = [];
      const traverse = (n) => {
        if (!n.children) {
          leaves.push(n.name);
        } else {
          n.children.forEach(traverse);
        }
      };
      traverse(node);
      return leaves;
    };

    const leaves1 = getLeafNodes(tree1);
    const leaves2 = getLeafNodes(tree2);

    const set1 = new Set(leaves1);
    const set2 = new Set(leaves2);

    // Find added and removed nodes
    const addedNodes = leaves2.filter(n => !set1.has(n));
    const removedNodes = leaves1.filter(n => !set2.has(n));
    const commonNodes = leaves1.filter(n => set2.has(n));

    // Calculate structural similarity (Jaccard index)
    const union = new Set([...leaves1, ...leaves2]);
    const intersection = commonNodes.length;
    const structuralSimilarity = intersection / union.size;

    // Calculate topology change
    const topologyChange = (addedNodes.length + removedNodes.length) / union.size;

    setComparisonMetrics({
      addedNodes,
      removedNodes,
      commonNodes: commonNodes.length,
      structuralSimilarity,
      topologyChange,
      t1NodeCount: leaves1.length,
      t2NodeCount: leaves2.length
    });
  }, []);

  // Load trees for both datasets
  useEffect(() => {
    const loadTrees = async () => {
      if (!currentDataset || !comparisonDataset) return;

      setIsLoading(true);
      try {
        // Load T1 tree - use all nodes
        const distanceDataT1 = calculateDistanceMatrix(currentDataset);
        const treeResultT1 = await fetchNeighborJoiningTree(distanceDataT1, currentDataset);

        if (treeResultT1) {
          setTreeDataT1(treeResultT1);

          // Analyze differences and construct T2 incrementally
          const differences = analyzeDatasetDifferences(currentDataset, comparisonDataset);
          const treeResultT2 = await constructIncrementalTree(
            treeResultT1,
            currentDataset,
            comparisonDataset
          );

          if (treeResultT2) {
            setTreeDataT2({ root: treeResultT2.root });

            // Calculate metrics including tree similarity
            const similarity = calculateTreeSimilarity(treeResultT1.root, treeResultT2.root);
            // Don't override the comparison metrics from calculateTreeSimilarity
            // Just add the additional metrics
            setComparisonMetrics(prevMetrics => ({
              ...prevMetrics,
              t1NodeCount: currentDataset.length,
              t2NodeCount: comparisonDataset.length,
              changeType: treeResultT2.changeType
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
  }, [currentDataset, comparisonDataset, toast, calculateComparisonMetrics]);

  // Render comparison visualization
  useEffect(() => {
    if (!treeDataT1 || !treeDataT2) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    if (viewMode === "side-by-side") {
      // Side-by-side view
      const halfWidth = width / 2;

      // Create two groups for each tree
      const g1 = svg.append("g")
        .attr("transform", `translate(${halfWidth / 2}, ${height / 2})`);

      const g2 = svg.append("g")
        .attr("transform", `translate(${halfWidth + halfWidth / 2}, ${height / 2})`);

      // Draw divider
      svg.append("line")
        .attr("x1", halfWidth)
        .attr("y1", 0)
        .attr("x2", halfWidth)
        .attr("y2", height)
        .attr("stroke", "gray")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5");

      // Labels
      svg.append("text")
        .attr("x", halfWidth / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(`T1 (${comparisonMetrics.t1NodeCount} nodes)`);

      svg.append("text")
        .attr("x", halfWidth + halfWidth / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", "bold")
        .text(`T2 (${comparisonMetrics.t2NodeCount} nodes)`);

      // Draw both trees
      drawTree(g1, treeDataT1.root, Math.min(halfWidth, height) / 2, "T1");
      drawTree(g2, treeDataT2.root, Math.min(halfWidth, height) / 2, "T2");
    } else {
      // Overlay view
      const g = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

      const outerRadius = Math.min(width, height) / 2;

      // Draw T1 tree (baseline)
      drawTree(g, treeDataT1.root, outerRadius, "T1", 0.3);

      // Draw T2 tree (overlay)
      drawTree(g, treeDataT2.root, outerRadius, "T2", 1.0, true);
    }
  }, [treeDataT1, treeDataT2, dimensions, viewMode, highlightDifferences, showNewNodes]);

  // Draw individual tree
  const drawTree = (container, treeRoot, radius, treeType, opacity = 1.0, isOverlay = false) => {
    const innerRadius = radius - 100;

    // Create hierarchy and layout
    const root = d3.hierarchy(treeRoot);
    const cluster = d3.cluster()
      .size([360, innerRadius])
      .separation((a, b) => 1);

    cluster(root);

    // Color schemes
    const baseColor = treeType === "T1" ? "#4169E1" : "#FF6347";
    const newNodeColor = "#00FF00";
    const removedNodeColor = "#FF0000";

    // Link generator
    const linkConstant = (d) => linkStep(d.source.x, d.source.y, d.target.x, d.target.y);

    // Draw links
    const links = container.append("g")
      .attr("fill", "none")
      .attr("opacity", opacity)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", linkConstant)
      .attr("stroke", isOverlay ? baseColor : "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", isOverlay ? 2 : 1);

    // Draw nodes
    const nodes = container.append("g")
      .attr("opacity", opacity)
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `
        rotate(${d.x - 90})
        translate(${d.y},0)
      `);

    // Highlight differences
    if (highlightDifferences) {
      nodes.filter(d => {
        if (!d.children) {
          if (treeType === "T2" && comparisonMetrics.addedNodes.includes(d.data.name)) {
            return true;
          }
          if (treeType === "T1" && comparisonMetrics.removedNodes.includes(d.data.name)) {
            return true;
          }
        }
        return false;
      })
      .append("circle")
      .attr("r", 8)
      .attr("fill", "none")
      .attr("stroke", d => {
        if (comparisonMetrics.addedNodes.includes(d.data.name)) return newNodeColor;
        if (comparisonMetrics.removedNodes.includes(d.data.name)) return removedNodeColor;
        return "none";
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "2,2");
    }

    // Node circles
    nodes.append("circle")
      .attr("r", d => d.children ? 2 : 4)
      .attr("fill", d => {
        if (!d.children) {
          if (showNewNodes && comparisonMetrics.addedNodes.includes(d.data.name)) {
            return newNodeColor;
          }
          if (showNewNodes && comparisonMetrics.removedNodes.includes(d.data.name)) {
            return removedNodeColor;
          }
        }
        return isOverlay ? baseColor : "#999";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode({
          ...d.data,
          treeType,
          isAdded: comparisonMetrics.addedNodes.includes(d.data.name),
          isRemoved: comparisonMetrics.removedNodes.includes(d.data.name)
        });
      })
      .on("mouseover", function(event, d) {
        d3.select(this).attr("r", d => d.children ? 3 : 6);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("r", d => d.children ? 2 : 4);
      });

    // Labels for changed nodes
    if (showNewNodes) {
      nodes.filter(d => !d.children && (
        comparisonMetrics.addedNodes.includes(d.data.name) ||
        comparisonMetrics.removedNodes.includes(d.data.name)
      ))
      .append("text")
      .attr("dy", ".31em")
      .attr("x", d => d.x < 180 ? 6 : -6)
      .attr("text-anchor", d => d.x < 180 ? "start" : "end")
      .attr("transform", d => d.x >= 180 ? "rotate(180)" : null)
      .text(d => d.data.name.substring(0, 15))
      .attr("font-size", 8)
      .attr("fill", d => {
        if (comparisonMetrics.addedNodes.includes(d.data.name)) return newNodeColor;
        if (comparisonMetrics.removedNodes.includes(d.data.name)) return removedNodeColor;
        return "#000";
      })
      .attr("font-weight", "bold");
    }
  };

  // Handle resize
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

  if (!currentDataset || !comparisonDataset) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="warning">
          <AlertIcon />
          Please load both T1 and T2 datasets from the Data Input tab to compare projections.
        </Alert>
      </Box>
    );
  }

  return (
    <Box h="full" display="flex">
      {/* Left Sidebar */}
      <Box w="350px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Compare Projections</Text>
          <Text fontSize="sm" color="gray.600">
            Compare phylogenetic trees between T1 (original) and T2 (updated) datasets
            to analyze how data changes affect tree structure.
          </Text>

          <Divider />

          {/* Dataset Information */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Datasets Loaded</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.600">T1 Dataset:</Text>
                  <Badge colorScheme="blue">{comparisonMetrics.t1NodeCount || currentDataset?.length || 0} nodes</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.600">T2 Dataset:</Text>
                  <Badge colorScheme="purple">{comparisonMetrics.t2NodeCount || comparisonDataset?.length || 0} nodes</Badge>
                </HStack>
                {comparisonMetrics.t1NodeCount > 0 && comparisonMetrics.t2NodeCount > 0 && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.600">Difference:</Text>
                    <Badge colorScheme={Math.abs(comparisonMetrics.t1NodeCount - comparisonMetrics.t2NodeCount) > 0 ? "orange" : "green"}>
                      {Math.abs(comparisonMetrics.t1NodeCount - comparisonMetrics.t2NodeCount)} nodes
                    </Badge>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Comparison Metrics */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Comparison Metrics</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Stat size="sm">
                  <StatLabel>Structural Similarity</StatLabel>
                  <StatNumber color="blue.500">
                    {(comparisonMetrics.structuralSimilarity * 100).toFixed(1)}%
                  </StatNumber>
                  <Progress
                    value={comparisonMetrics.structuralSimilarity * 100}
                    colorScheme="blue"
                    size="xs"
                  />
                </Stat>
                <Stat size="sm">
                  <StatLabel>Topology Change</StatLabel>
                  <StatNumber color="orange.500">
                    {(comparisonMetrics.topologyChange * 100).toFixed(1)}%
                  </StatNumber>
                  <Progress
                    value={comparisonMetrics.topologyChange * 100}
                    colorScheme="orange"
                    size="xs"
                  />
                </Stat>
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.600">Common Nodes:</Text>
                  <Badge colorScheme="purple">{comparisonMetrics.commonNodes}</Badge>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Changes Summary */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Changes Summary</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm">Added Nodes:</Text>
                  <Badge colorScheme="green">{comparisonMetrics.addedNodes.length}</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm">Removed Nodes:</Text>
                  <Badge colorScheme="red">{comparisonMetrics.removedNodes.length}</Badge>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* View Controls */}
          <Card>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Text fontWeight="bold" fontSize="sm">View Options</Text>

                <FormControl>
                  <FormLabel fontSize="sm">View Mode</FormLabel>
                  <Select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                    size="sm"
                  >
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
                  <FormLabel htmlFor="show-new" mb="0" fontSize="sm">
                    Show New/Removed
                  </FormLabel>
                  <Switch
                    id="show-new"
                    isChecked={showNewNodes}
                    onChange={(e) => setShowNewNodes(e.target.checked)}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Selected Node */}
          {selectedNode && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Selected Node</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="xs" noOfLines={2}>{selectedNode.name}</Text>
                  <HStack>
                    <Badge colorScheme="blue">{selectedNode.treeType}</Badge>
                    {selectedNode.isAdded && (
                      <Badge colorScheme="green">New</Badge>
                    )}
                    {selectedNode.isRemoved && (
                      <Badge colorScheme="red">Removed</Badge>
                    )}
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Changed Nodes List */}
          {(comparisonMetrics.addedNodes.length > 0 || comparisonMetrics.removedNodes.length > 0) && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Changed Nodes</Text>
              </CardHeader>
              <CardBody>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th fontSize="xs">Node</Th>
                      <Th fontSize="xs">Change</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {comparisonMetrics.addedNodes.slice(0, 5).map((node, i) => (
                      <Tr key={`add-${i}`}>
                        <Td fontSize="xs">{(typeof node === 'string' ? node : node?.name || node?.id || 'Unknown').substring(0, 15)}</Td>
                        <Td>
                          <Badge colorScheme="green" size="sm">Added</Badge>
                        </Td>
                      </Tr>
                    ))}
                    {comparisonMetrics.removedNodes.slice(0, 5).map((node, i) => (
                      <Tr key={`rem-${i}`}>
                        <Td fontSize="xs">{(typeof node === 'string' ? node : node?.name || node?.id || 'Unknown').substring(0, 15)}</Td>
                        <Td>
                          <Badge colorScheme="red" size="sm">Removed</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
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
              <Text fontWeight="bold">Comparing projections...</Text>
              <VStack spacing={1}>
                <Text fontSize="sm" color="gray.600">Loading T1 dataset ({currentDataset?.length || 0} nodes)</Text>
                <Text fontSize="sm" color="gray.600">Loading T2 dataset ({comparisonDataset?.length || 0} nodes)</Text>
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

export default CompareProjectionsTreeView;
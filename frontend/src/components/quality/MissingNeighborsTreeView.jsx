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
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Alert,
  AlertIcon,
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
  analyzeDatasetDifferences
} from "../../utils/incrementalTreeUtils";

const MissingNeighborsTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const { currentDataset, comparisonDataset } = usePhylo();
  const toast = useToast();

  const [treeDataT1, setTreeDataT1] = useState(null);
  const [treeDataT2, setTreeDataT2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMissingLinks, setShowMissingLinks] = useState(true);
  const [showRemovedNodes, setShowRemovedNodes] = useState(true);
  const [neighborThreshold, setNeighborThreshold] = useState(5);
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [viewMode, setViewMode] = useState("t1"); // "t1", "t2", or "comparison"
  const [missingNeighborsData, setMissingNeighborsData] = useState({
    totalMissing: 0,
    avgMissingPerNode: 0,
    maxMissing: 0,
    removedNodes: [],
    addedNodes: [],
    missingConnections: [],
    affectedNodes: []
  });

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");

  // Calculate missing neighbors between T1 and T2
  const calculateMissingNeighborsBetweenDatasets = useCallback((tree1, tree2, data1, data2) => {
    if (!tree1 || !tree2) return;

    // Collect all leaf nodes from both trees
    const getLeafNodes = (node) => {
      const leaves = [];
      const traverse = (n) => {
        if (!n.children) {
          leaves.push({
            name: n.name,
            id: n.id,
            data: n
          });
        } else {
          n.children.forEach(traverse);
        }
      };
      traverse(node);
      return leaves;
    };

    const leavesT1 = getLeafNodes(tree1);
    const leavesT2 = getLeafNodes(tree2);

    // Create maps for quick lookup
    const t1Map = new Map(leavesT1.map(l => [l.name, l]));
    const t2Map = new Map(leavesT2.map(l => [l.name, l]));

    // Find removed nodes (in T1 but not in T2)
    const removedNodes = leavesT1.filter(l => !t2Map.has(l.name));

    // Find added nodes (in T2 but not in T1)
    const addedNodes = leavesT2.filter(l => !t1Map.has(l.name));

    // Calculate missing connections for common nodes
    const commonNodes = leavesT1.filter(l => t2Map.has(l.name));
    const missingConnections = [];
    let totalMissing = 0;

    // For visualization mode based on which dataset is larger
    const primaryTree = data1.length >= data2.length ? tree1 : tree2;
    const primaryLeaves = data1.length >= data2.length ? leavesT1 : leavesT2;

    // If T1 has more nodes (e.g., 210 vs 200), show what's missing in T2
    if (data1.length > data2.length) {
      // For each removed node, all its connections are missing in T2
      removedNodes.forEach(removedNode => {
        // Find neighbors of this node in T1
        commonNodes.forEach(commonNode => {
          missingConnections.push({
            source: removedNode.name,
            target: commonNode.name,
            type: "removed",
            description: `${removedNode.name} → ${commonNode.name} (node removed in T2)`
          });
          totalMissing++;
        });
      });
    } else if (data2.length > data1.length) {
      // If T2 has more nodes, show what's new
      addedNodes.forEach(addedNode => {
        commonNodes.forEach(commonNode => {
          missingConnections.push({
            source: addedNode.name,
            target: commonNode.name,
            type: "added",
            description: `${addedNode.name} → ${commonNode.name} (node added in T2)`
          });
          totalMissing++;
        });
      });
    }

    // Calculate statistics
    const affectedNodes = [
      ...removedNodes.map(n => ({ ...n, status: "removed" })),
      ...addedNodes.map(n => ({ ...n, status: "added" }))
    ];

    const avgMissingPerNode = affectedNodes.length > 0 ? totalMissing / affectedNodes.length : 0;

    setMissingNeighborsData({
      totalMissing,
      avgMissingPerNode,
      maxMissing: Math.max(removedNodes.length, addedNodes.length),
      removedNodes: removedNodes.map(n => n.name),
      addedNodes: addedNodes.map(n => n.name),
      missingConnections,
      affectedNodes,
      t1Count: data1.length,
      t2Count: data2.length
    });

    return { primaryTree, primaryLeaves };
  }, []);

  // Load trees for both datasets
  useEffect(() => {
    const loadTrees = async () => {
      if (!currentDataset || !comparisonDataset) return;

      setIsLoading(true);
      try {
        // Calculate distance matrix for T1
        const distanceDataT1 = calculateDistanceMatrix(currentDataset);
        const treeResultT1 = await fetchNeighborJoiningTree(distanceDataT1, currentDataset);

        if (treeResultT1) {
          setTreeDataT1(treeResultT1);

          // Analyze differences between datasets
          const differences = analyzeDatasetDifferences(currentDataset, comparisonDataset);

          // Construct T2 incrementally from T1
          const treeResultT2 = await constructIncrementalTree(
            treeResultT1,
            currentDataset,
            comparisonDataset
          );

          if (treeResultT2) {
            setTreeDataT2({ root: treeResultT2.root });

            // Update missing neighbors data based on differences
            setMissingNeighborsData({
              totalMissing: differences.summary.addedCount + differences.summary.removedCount,
              avgMissingPerNode: (differences.summary.addedCount + differences.summary.removedCount) /
                                 Math.max(currentDataset.length, comparisonDataset.length),
              maxMissing: Math.max(differences.summary.addedCount, differences.summary.removedCount),
              removedNodes: differences.removed.map(n => n.id),
              addedNodes: differences.added.map(n => n.id),
              missingConnections: [],
              affectedNodes: [
                ...differences.removed.map(n => ({
                  id: n.id,
                  name: n.title || n.name || n.id,
                  title: n.title,
                  status: 'removed'
                })),
                ...differences.added.map(n => ({
                  id: n.id,
                  name: n.title || n.name || n.id,
                  title: n.title,
                  status: 'added'
                })),
                ...differences.modified.map(n => ({
                  id: n.new.id,
                  name: n.new.title || n.new.name || n.new.id,
                  title: n.new.title,
                  status: 'modified'
                }))
              ],
              t1Count: currentDataset.length,
              t2Count: comparisonDataset.length,
              changeType: treeResultT2.changeType
            });
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
  }, [currentDataset, comparisonDataset, toast, calculateMissingNeighborsBetweenDatasets]);

  // Render visualization
  useEffect(() => {
    if (!treeDataT1 || !treeDataT2) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const { outerRadius, innerRadius } = createTreeLayout(
      d3.hierarchy(viewMode === "t2" ? treeDataT2.root : treeDataT1.root),
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

    // Decide which tree to show based on view mode
    const primaryTreeData = viewMode === "t2" ? treeDataT2 : treeDataT1;
    const primaryRoot = d3.hierarchy(primaryTreeData.root);

    // Create tree layout
    const cluster = d3.cluster()
      .size([360, innerRadius])
      .separation((a, b) => 1);

    cluster(primaryRoot);

    // Color scales
    const nodeColorScale = d3.scaleOrdinal()
      .domain(["common", "removed", "added"])
      .range(["#4CAF50", "#FF5252", "#2196F3"]);

    // Link generator
    const linkConstant = (d) => linkStep(d.source.x, d.source.y, d.target.x, d.target.y);

    // Draw tree links
    const links = g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(primaryRoot.links())
      .join("path")
      .attr("d", linkConstant)
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6);

    // Draw missing connections between removed/added nodes
    if (showMissingLinks && missingNeighborsData.missingConnections.length > 0) {
      const missingLinksGroup = g.append("g")
        .attr("class", "missing-links");

      // Draw connections for removed/added nodes
      missingNeighborsData.missingConnections.forEach(connection => {
        const sourceNode = primaryRoot.leaves().find(n => n.data.name === connection.source);
        const targetNode = primaryRoot.leaves().find(n => n.data.name === connection.target);

        if (sourceNode && targetNode) {
          const sourceAngle = (sourceNode.x - 90) * Math.PI / 180;
          const targetAngle = (targetNode.x - 90) * Math.PI / 180;

          missingLinksGroup.append("path")
            .attr("d", d3.line()([
              [Math.cos(sourceAngle) * sourceNode.y, Math.sin(sourceAngle) * sourceNode.y],
              [Math.cos(targetAngle) * targetNode.y, Math.sin(targetAngle) * targetNode.y]
            ]))
            .attr("stroke", connection.type === "removed" ? "red" : "blue")
            .attr("stroke-opacity", 0.3)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
        }
      });
    }

    // Draw nodes
    const nodes = g.append("g")
      .selectAll("g")
      .data(primaryRoot.descendants())
      .join("g")
      .attr("transform", d => `
        rotate(${d.x - 90})
        translate(${d.y},0)
      `);

    // Determine node status
    const getNodeStatus = (node) => {
      if (!node.children) {
        if (missingNeighborsData.removedNodes.includes(node.data.name)) {
          return "removed";
        }
        if (missingNeighborsData.addedNodes.includes(node.data.name)) {
          return "added";
        }
      }
      return "common";
    };

    // Add halos for removed/added nodes
    nodes.filter(d => !d.children)
      .each(function(d) {
        const status = getNodeStatus(d);
        if (status !== "common") {
          d3.select(this).append("circle")
            .attr("r", 8)
            .attr("fill", "none")
            .attr("stroke", status === "removed" ? "red" : "blue")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.6);
        }
      });

    // Main node circles
    nodes.append("circle")
      .attr("r", d => d.children ? 2 : 4)
      .attr("fill", d => {
        if (!d.children) {
          const status = getNodeStatus(d);
          return nodeColorScale(status);
        }
        return "#999";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const status = getNodeStatus(d);
        setSelectedNode({
          ...d.data,
          status: status
        });
      });

    // Add labels for affected nodes
    if (showRemovedNodes) {
      nodes.filter(d => !d.children && getNodeStatus(d) !== "common")
        .append("text")
        .attr("dy", ".31em")
        .attr("x", d => d.x < 180 ? 6 : -6)
        .attr("text-anchor", d => d.x < 180 ? "start" : "end")
        .attr("transform", d => d.x >= 180 ? "rotate(180)" : null)
        .text(d => d.data.name.substring(0, 20))
        .attr("font-size", 9)
        .attr("fill", d => {
          const status = getNodeStatus(d);
          return status === "removed" ? "red" : status === "added" ? "blue" : textColor;
        })
        .attr("font-weight", "bold");
    }

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${-outerRadius + 20}, ${-outerRadius + 20})`);

    legend.append("text")
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .text("Missing Neighbors");

    const legendItems = [
      { label: `T1: ${missingNeighborsData.t1Count} nodes`, color: "#4169E1" },
      { label: `T2: ${missingNeighborsData.t2Count} nodes`, color: "#FF6347" },
      { label: "Common nodes", color: "#4CAF50" },
      { label: `Removed (${missingNeighborsData.removedNodes.length})`, color: "#FF5252" },
      { label: `Added (${missingNeighborsData.addedNodes.length})`, color: "#2196F3" }
    ];

    legendItems.forEach((item, i) => {
      const g = legend.append("g")
        .attr("transform", `translate(0, ${20 + i * 20})`);

      g.append("circle")
        .attr("r", 5)
        .attr("fill", item.color);

      g.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .attr("font-size", 10)
        .text(item.label);
    });

  }, [treeDataT1, treeDataT2, dimensions, showMissingLinks, showRemovedNodes, missingNeighborsData, textColor, viewMode]);

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
          <Text>
            Please load both T1 and T2 datasets from the Data Input tab to analyze missing neighbors.
          </Text>
        </Alert>
      </Box>
    );
  }

  return (
    <Box h="full" display="flex">
      {/* Left Sidebar */}
      <Box w="350px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Missing Neighbors Analysis</Text>
          <Text fontSize="sm" color="gray.600">
            Compares T1 ({currentDataset.length} nodes) and T2 ({comparisonDataset.length} nodes)
            to identify missing neighbor relationships.
          </Text>

          <Divider />

          {/* Dataset Comparison */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Dataset Comparison</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm">T1 Dataset:</Text>
                  <Badge colorScheme="blue">{missingNeighborsData.t1Count || currentDataset.length} nodes</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm">T2 Dataset:</Text>
                  <Badge colorScheme="orange">{missingNeighborsData.t2Count || comparisonDataset.length} nodes</Badge>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm">Difference:</Text>
                  <Badge colorScheme={
                    Math.abs((currentDataset.length || 0) - (comparisonDataset.length || 0)) > 0 ? "red" : "green"
                  }>
                    {Math.abs((currentDataset.length || 0) - (comparisonDataset.length || 0))} nodes
                  </Badge>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader pb={2}>
              <Text fontWeight="bold" fontSize="sm">Missing Neighbor Statistics</Text>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Stat size="sm">
                  <StatLabel>Removed Nodes</StatLabel>
                  <StatNumber color="red.500">{missingNeighborsData.removedNodes.length}</StatNumber>
                  <StatHelpText>Nodes in T1 but not T2</StatHelpText>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Added Nodes</StatLabel>
                  <StatNumber color="blue.500">{missingNeighborsData.addedNodes.length}</StatNumber>
                  <StatHelpText>Nodes in T2 but not T1</StatHelpText>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Missing Connections</StatLabel>
                  <StatNumber color="orange.500">{missingNeighborsData.totalMissing}</StatNumber>
                  <StatHelpText>Total broken connections</StatHelpText>
                </Stat>
              </VStack>
            </CardBody>
          </Card>

          {/* Controls */}
          <Card>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Text fontWeight="bold" fontSize="sm">Visualization Controls</Text>

                <FormControl>
                  <FormLabel fontSize="sm">View Tree</FormLabel>
                  <ButtonGroup size="sm" isAttached variant="outline">
                    <Button
                      onClick={() => setViewMode("t1")}
                      isActive={viewMode === "t1"}
                      colorScheme={viewMode === "t1" ? "blue" : "gray"}
                    >
                      T1 Tree
                    </Button>
                    <Button
                      onClick={() => setViewMode("t2")}
                      isActive={viewMode === "t2"}
                      colorScheme={viewMode === "t2" ? "blue" : "gray"}
                    >
                      T2 Tree
                    </Button>
                  </ButtonGroup>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-missing" mb="0" fontSize="sm">
                    Show Missing Links
                  </FormLabel>
                  <Switch
                    id="show-missing"
                    isChecked={showMissingLinks}
                    onChange={(e) => setShowMissingLinks(e.target.checked)}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-removed" mb="0" fontSize="sm">
                    Label Affected Nodes
                  </FormLabel>
                  <Switch
                    id="show-removed"
                    isChecked={showRemovedNodes}
                    onChange={(e) => setShowRemovedNodes(e.target.checked)}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Selected Node Info */}
          {selectedNode && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Selected Node</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={2}>
                  <Text fontSize="xs" noOfLines={2}>{selectedNode.name}</Text>
                  <Badge
                    colorScheme={
                      selectedNode.status === "removed" ? "red" :
                      selectedNode.status === "added" ? "blue" : "green"
                    }
                  >
                    {selectedNode.status === "removed" ? "Removed in T2" :
                     selectedNode.status === "added" ? "Added in T2" : "Common"}
                  </Badge>
                </VStack>
              </CardBody>
            </Card>
          )}

          {/* Affected Nodes List */}
          {missingNeighborsData.affectedNodes.length > 0 && (
            <Card>
              <CardHeader pb={2}>
                <Text fontWeight="bold" fontSize="sm">Affected Nodes</Text>
              </CardHeader>
              <CardBody>
                <Box maxH="200px" overflowY="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th fontSize="xs">Node</Th>
                        <Th fontSize="xs">Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {missingNeighborsData.affectedNodes.slice(0, 10).map((node, i) => (
                        <Tr key={i}>
                          <Td fontSize="xs">
                            {(node.name || node.title || node.id || 'Unknown').substring(0, 20)}
                          </Td>
                          <Td>
                            <Badge
                              size="sm"
                              colorScheme={node.status === "removed" ? "red" : node.status === "added" ? "green" : "yellow"}
                            >
                              {node.status}
                            </Badge>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Box>

      {/* Main Visualization */}
      <Box flex={1} ref={containerRef} bg={bgColor} position="relative">
        {isLoading ? (
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)">
            <VStack>
              <Spinner size="xl" color="blue.500" />
              <Text>Analyzing missing neighbors...</Text>
            </VStack>
          </Box>
        ) : (
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        )}
      </Box>
    </Box>
  );
};

export default MissingNeighborsTreeView;
import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Text,
  Tooltip,
  IconButton,
  VStack,
  useToast,
  Badge,
  Card,
  CardBody,
  CardHeader,
} from "@chakra-ui/react";
import {
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiDownload,
  FiInfo,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { parseNewick } from "./libs/parseNewick";
import SidebarContent from "../../layout/Sidebar";
import { usePhyloCtx } from "../../../contexts/PhyloContext";
import {
  assignColorsToTree,
  getNodeColor,
  createLegendData
} from "./utils/colorScheme";

export default function PhyloTreeVisualization({ show }) {
  const {
    visDataPhylo,
    selectedNode,
    setSelectedNode,
    selectedTheme,
    setSelectedTheme,
    setVisDataWords,
    setVisDataTime,
    unifiedSelection,
    handleUnifiedSelection,
    extractThemeFromNodeName
  } = usePhyloCtx();

  const svgRef = useRef();
  const containerRef = useRef();
  const toast = useToast();
  const zoomRef = useRef();

  // Layout options: 1 = Radial, 2 = Dendrogram
  const [layoutType, setLayoutType] = useState("1");
  const [showDistances, setShowDistances] = useState(true);
  const [showInternalLabels, setShowInternalLabels] = useState(false);
  const [showLeafLabels, setShowLeafLabels] = useState(true);
  const [nodeSize, setNodeSize] = useState(5);
  const [depthColorGroups, setDepthColorGroups] = useState(3);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Process tree data with color assignments
  const processedTree = useMemo(() => {
    if (!visDataPhylo) return null;

    try {
      const newickData = parseNewick(visDataPhylo);
      const hierarchy = d3.hierarchy(newickData, d => d.branchset)
        .sum(d => d.branchset ? 0 : 1)
        .sort((a, b) => (a.height - b.height) || d3.ascending(a.data.name, b.data.name));

      // Assign colors to the tree
      assignColorsToTree(hierarchy);

      return hierarchy;
    } catch (error) {
      console.error("Error processing tree:", error);
      return null;
    }
  }, [visDataPhylo]);

  // Generate word cloud data separately to avoid setState during render
  const wordCloudData = useMemo(() => {
    if (!processedTree) return [];

    const wordFrequency = new Map();
    processedTree.each(node => {
      if (node.data.name) {
        const name = node.data.name.split("_")[0];
        wordFrequency.set(name, (wordFrequency.get(name) || 0) + 1);
      }
    });

    return Array.from(wordFrequency.entries())
      .map(([word, qtd]) => ({ word, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 50);
  }, [processedTree]);

  // Update word cloud data in a separate effect to avoid setState during render
  useEffect(() => {
    if (wordCloudData.length > 0 && setVisDataWords) {
      setVisDataWords(wordCloudData);
    }
  }, [wordCloudData, setVisDataWords]);

  // ==================== HIGHLIGHT FUNCTIONS ====================
  // Generic highlight path function that works with D3 selections
  function highlightPathToRoot(node, links, nodes, labels) {
    if (!node || !links || !nodes) return;

    const pathToRoot = [];
    let current = node;
    while (current) {
      pathToRoot.push(current);
      current = current.parent;
    }

    // Dim all links first
    links
      .attr("stroke-opacity", d => {
        const inPath = pathToRoot.includes(d.source) && pathToRoot.includes(d.target);
        return inPath ? 1 : 0.2;
      })
      .attr("stroke-width", d => {
        const inPath = pathToRoot.includes(d.source) && pathToRoot.includes(d.target);
        if (inPath) {
          if (d.source.depth === 0) return 3;
          if (d.source.depth === 1) return 2.5;
          return 2;
        }
        return 1;
      });

    // Highlight nodes
    if (nodes.select) {
      nodes.select("circle")
        .attr("opacity", d => pathToRoot.includes(d) ? 1 : 0.3);
    }

    // Highlight labels
    if (labels) {
      labels.attr("opacity", d => pathToRoot.includes(d) ? 1 : 0.3);
    }
  }

  function clearHighlightPath(links, nodes, labels) {
    if (links) {
      links
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", d => {
          if (d.source.depth === 0) return 2;
          if (d.source.depth === 1) return 1.5;
          return 1;
        });
    }
    if (nodes && nodes.select) {
      nodes.select("circle").attr("opacity", 1);
    }
    if (labels) {
      labels.attr("opacity", 1);
    }
  }

  // ==================== IMPROVED RADIAL LAYOUT (Tree of Life style) ====================
  function createRadialLayout(root, width, height) {
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.3; // Larger inner radius for better label space
    const outerRadius = radius * 0.95;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto; font-family: sans-serif;");

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    const g = svg.append("g");

    // Use cluster layout for uniform angular distribution (like Tree of Life)
    const cluster = d3.cluster()
      .size([360, outerRadius - innerRadius])
      .separation((a, b) => 1);

    // Apply layout
    cluster(root);

    // Adjust positions for radial layout
    root.each(d => {
      const angle = (d.x / 180) * Math.PI;
      const radius = d.y + innerRadius;
      d.x0 = Math.cos(angle) * radius;
      d.y0 = Math.sin(angle) * radius;
      d.angle = angle;
      d.radius = radius;
    });

    // Create link generator
    const linkGenerator = function(d) {
      const sourceAngle = d.source.angle;
      const sourceRadius = d.source.radius;
      const targetAngle = d.target.angle;
      const targetRadius = d.target.radius;

      // Use step function for cleaner tree structure
      const path = d3.path();
      path.moveTo(
        Math.cos(sourceAngle) * sourceRadius,
        Math.sin(sourceAngle) * sourceRadius
      );

      if (showDistances && d.target.data.length) {
        // Curved path for distance display
        const midRadius = (sourceRadius + targetRadius) / 2;
        path.quadraticCurveTo(
          Math.cos(sourceAngle) * midRadius,
          Math.sin(sourceAngle) * midRadius,
          Math.cos(targetAngle) * targetRadius,
          Math.sin(targetAngle) * targetRadius
        );
      } else {
        // Step connection (rectangular)
        path.lineTo(
          Math.cos(sourceAngle) * targetRadius,
          Math.sin(sourceAngle) * targetRadius
        );
        path.lineTo(
          Math.cos(targetAngle) * targetRadius,
          Math.sin(targetAngle) * targetRadius
        );
      }

      return path.toString();
    };

    // Create gradient definitions for links
    const defs = svg.append("defs");

    // Create links with color based on target node taxonomy
    const linkGroup = g.append("g")
      .attr("class", "links")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.6);

    const links = linkGroup.selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", linkGenerator)
      .attr("stroke", d => getNodeColor(d.target, depthColorGroups))
      .attr("stroke-width", d => {
        // Thicker lines for major branches
        if (d.source.depth === 0) return 2;
        if (d.source.depth === 1) return 1.5;
        return 1;
      })
      .attr("class", "link")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke-width", 3)
          .attr("stroke-opacity", 1);

        // Highlight connected nodes
        highlightPath(d.target);
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .attr("stroke-width", d => {
            if (d.source.depth === 0) return 2;
            if (d.source.depth === 1) return 1.5;
            return 1;
          })
          .attr("stroke-opacity", 0.6);

        clearHighlight();
      });

    // Add distance labels on branches (if enabled)
    if (showDistances && root.links().some(d => d.target.data.length)) {
      const distanceLabels = g.append("g")
        .attr("class", "distance-labels")
        .selectAll("text")
        .data(root.links().filter(d => d.target.data.length))
        .join("text")
        .attr("font-size", 7)
        .attr("fill", "#666")
        .attr("text-anchor", "middle")
        .attr("dy", -2)
        .text(d => d.target.data.length.toFixed(4))
        .attr("transform", d => {
          const angle = (d.source.angle + d.target.angle) / 2;
          const radius = (d.source.radius + d.target.radius) / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const rotation = (angle * 180 / Math.PI) - 90;
          return `translate(${x},${y}) rotate(${rotation > 90 && rotation < 270 ? rotation + 180 : rotation})`;
        });
    }

    // Create nodes
    const nodeGroup = g.append("g")
      .attr("class", "nodes");

    const nodes = nodeGroup.selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => handleNodeClick(d))
      .on("mouseover", function(event, d) {
        setHoveredNode(d);
        highlightPath(d);
        showTooltip(event, d);
      })
      .on("mouseout", function(event, d) {
        setHoveredNode(null);
        clearHighlight();
        hideTooltip();
      });

    // Add node circles
    nodes.append("circle")
      .attr("r", d => {
        if (d.children) {
          return d.depth === 0 ? nodeSize * 2 : nodeSize;
        }
        return nodeSize * 0.8;
      })
      .attr("fill", d => getNodeColor(d, depthColorGroups))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("class", "node-circle");

    // Add labels with D3 Tree of Life style positioning
    const labels = nodes.append("text")
      .attr("dy", "0.31em")
      .attr("font-size", d => {
        if (d.depth === 0) return 0; // Hide root label
        if (d.depth === 1) return 11;
        if (d.depth === 2) return 10;
        return 9;
      })
      .attr("fill", d => d.children ? "#333" : "#555")
      .attr("font-weight", d => d.depth <= 2 ? "600" : "400")
      .text(d => d.data.name || "")
      .style("display", d => {
        if (d.depth === 0) return "none"; // Hide root
        if (d.children && !showInternalLabels) return "none";
        if (!d.children && !showLeafLabels) return "none";
        return "block";
      })
      .attr("transform", d => {
        // D3 Tree of Life style rotation
        const angle = d.angle * 180 / Math.PI - 90;
        const distance = d.children ? -8 : (innerRadius + 4);
        return `rotate(${angle}) translate(${distance},0)${angle < 180 ? "" : " rotate(180)"}`;
      })
      .attr("text-anchor", d => {
        const angle = d.angle * 180 / Math.PI - 90;
        if (d.children) {
          return angle < 180 ? "end" : "start";
        } else {
          return angle < 180 ? "start" : "end";
        }
      });

    // Helper functions for highlighting
    function highlightPath(node) {
      // Fade all elements
      links.attr("stroke-opacity", 0.2);
      nodes.select("circle").attr("opacity", 0.3);
      labels.attr("opacity", 0.3);

      // Highlight path to root
      let current = node;
      const pathNodes = new Set();
      while (current) {
        pathNodes.add(current);
        current = current.parent;
      }

      // Highlight descendants
      function addDescendants(n) {
        pathNodes.add(n);
        if (n.children) {
          n.children.forEach(addDescendants);
        }
      }
      addDescendants(node);

      // Apply highlighting
      links.filter(d => pathNodes.has(d.source) && pathNodes.has(d.target))
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 2);

      nodes.filter(d => pathNodes.has(d))
        .select("circle")
        .attr("opacity", 1);

      labels.filter(d => pathNodes.has(d))
        .attr("opacity", 1);
    }

    function clearHighlight() {
      links
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", d => {
          if (d.source.depth === 0) return 2;
          if (d.source.depth === 1) return 1.5;
          return 1;
        });
      nodes.select("circle").attr("opacity", 1);
      labels.attr("opacity", 1);
    }

    // Add center circle with tree statistics
    const centerGroup = g.append("g")
      .attr("class", "center-info");

    centerGroup.append("circle")
      .attr("r", innerRadius - 10)
      .attr("fill", "white")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1);

    centerGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.5em")
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .text("Phylogenetic Tree");

    centerGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(`${root.descendants().length} nodes`);

    centerGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "2.5em")
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(`Depth: ${root.height}`);

    return { svg, g, nodes, links, labels };
  }

  // Helper functions for highlighting paths in any layout
  function highlightPathGeneric(node) {
    const svg = d3.select(svgRef.current);

    // Fade all elements
    svg.selectAll(".link").attr("stroke-opacity", 0.2);
    svg.selectAll(".node-circle").attr("opacity", 0.3);
    svg.selectAll(".node text").attr("opacity", 0.3);

    // Build set of nodes in path
    const pathNodes = new Set();

    // Add ancestors to root
    let current = node;
    while (current) {
      pathNodes.add(current);
      current = current.parent;
    }

    // Add all descendants
    function addDescendants(n) {
      pathNodes.add(n);
      if (n.children) {
        n.children.forEach(addDescendants);
      }
    }
    addDescendants(node);

    // Highlight path elements
    svg.selectAll(".link")
      .filter(d => pathNodes.has(d.source) && pathNodes.has(d.target))
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 2.5);

    svg.selectAll(".node")
      .filter(d => pathNodes.has(d))
      .select(".node-circle")
      .attr("opacity", 1);

    svg.selectAll(".node")
      .filter(d => pathNodes.has(d))
      .select("text")
      .attr("opacity", 1);
  }

  function clearHighlightGeneric() {
    const svg = d3.select(svgRef.current);

    svg.selectAll(".link")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5);

    svg.selectAll(".node-circle")
      .attr("opacity", 1);

    svg.selectAll(".node text")
      .attr("opacity", 1);
  }

  // ==================== DENDROGRAM LAYOUT ====================
  function createDendrogramLayout(root, width, height) {
    // Calculate dynamic margins based on tree depth
    const maxLabelLength = Math.max(...root.leaves().map(d => d.data.name.length));
    const margin = {
      top: 40,
      right: Math.max(200, maxLabelLength * 7),
      bottom: 40,
      left: 80
    };
    const treeWidth = width - margin.left - margin.right;

    // Calculate tree height based on number of leaves to prevent overlap
    const leafCount = root.leaves().length;
    const minNodeSpacing = 25; // Minimum pixels between nodes
    const treeHeight = Math.max(height - margin.top - margin.bottom, leafCount * minNodeSpacing);

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create zoom behavior with better initial scale
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Use cluster for uniform spacing with dynamic separation
    const cluster = d3.cluster()
      .size([treeHeight, treeWidth])
      .separation((a, b) => {
        // Increase separation for nodes at the same depth
        return a.parent === b.parent ? 1.5 : 2;
      });

    cluster(root);

    // Auto-fit zoom if tree is large
    if (leafCount > 15) {
      const scaleFactor = Math.min(1, (height - margin.top - margin.bottom) / treeHeight);
      svg.call(zoom.transform, d3.zoomIdentity.scale(scaleFactor));
    }

    // Create links with elbow connections
    const linkGroup = g.append("g")
      .attr("class", "links")
      .attr("fill", "none");

    const links = linkGroup.selectAll("path")
      .data(root.links())
      .join("path")
      .attr("class", "link")
      .attr("d", d => {
        return `M${d.target.y},${d.target.x}
                C${(d.target.y + d.source.y) / 2},${d.target.x}
                 ${(d.target.y + d.source.y) / 2},${d.source.x}
                 ${d.source.y},${d.source.x}`;
      })
      .attr("stroke", d => getNodeColor(d.target, depthColorGroups))
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    // Add distance labels
    if (showDistances && root.links().some(d => d.target.data.length)) {
      g.append("g")
        .attr("class", "distance-labels")
        .selectAll("text")
        .data(root.links().filter(d => d.target.data.length))
        .join("text")
        .attr("x", d => (d.source.y + d.target.y) / 2)
        .attr("y", d => (d.source.x + d.target.x) / 2)
        .attr("font-size", 8)
        .attr("fill", "#666")
        .attr("text-anchor", "middle")
        .attr("dy", -3)
        .text(d => d.target.data.length.toFixed(4));
    }

    // Create nodes
    const nodeGroup = g.append("g")
      .attr("class", "nodes");

    const nodes = nodeGroup.selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (event, d) => handleNodeClick(d))
      .on("mouseenter", (event, d) => {
        setHoveredNode(d);
        highlightPathGeneric(d);
        showTooltip(event, d);
      })
      .on("mouseleave", () => {
        setHoveredNode(null);
        clearHighlightGeneric();
        hideTooltip();
      });

    // Add node circles
    nodes.append("circle")
      .attr("r", d => d.children ? nodeSize : nodeSize * 0.8)
      .attr("fill", d => getNodeColor(d, depthColorGroups))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("class", "node-circle");

    // Add labels with dynamic font size
    nodes.append("text")
      .attr("x", d => d.children ? -10 : 10)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .attr("font-size", d => {
        // Dynamic font size based on number of leaves
        const baseFontSize = leafCount > 30 ? 8 : leafCount > 20 ? 9 : 10;
        return d.children ? baseFontSize : baseFontSize;
      })
      .attr("dy", "0.35em")
      .attr("fill", "#333")
      .text(d => d.data.name)
      .style("display", d => {
        if (d.children && !showInternalLabels) return "none";
        if (!d.children && !showLeafLabels) return "none";
        return "block";
      });

    return { svg, g, nodes, links };
  }

  // Handle node click for cross-visualization communication
  function handleNodeClick(node) {
    // Check if clicking on already selected node (to deselect)
    if (unifiedSelection?.nodeName === node.data?.name) {
      handleUnifiedSelection({ clear: true });
      setSelectedNode(null);
    } else {
      // Select the node using unified selection
      handleUnifiedSelection({
        nodeId: node.id,
        nodeName: node.data?.name,
        source: 'phylo'
      });
      setSelectedNode(node);
    }

    // Show toast with node info
    toast({
      title: "Node Selected",
      description: `${node.data.name} (Depth: ${node.depth})`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  }

  // Tooltip functions
  function showTooltip(event, node) {
    // Implementation for tooltip display
  }

  function hideTooltip() {
    // Implementation for tooltip hiding
  }

  // Zoom controls
  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Export SVG
  function exportSVG() {
    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phylo-tree-${layoutType}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Main visualization effect with resize observer
  useEffect(() => {
    if (!processedTree || !containerRef.current) return;

    const renderVisualization = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width || containerRef.current.offsetWidth;
      const height = rect.height || containerRef.current.offsetHeight;

      // Ensure minimum dimensions
      if (width < 100 || height < 100) return;

      switch (layoutType) {
        case "1":
          createRadialLayout(processedTree, width, height);
          break;
        case "2":
          createDendrogramLayout(processedTree, width, height);
          break;
      }
    };

    // Initial render
    renderVisualization();

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => {
      renderVisualization();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [processedTree, layoutType, showDistances, showInternalLabels, showLeafLabels, nodeSize, depthColorGroups]);

  // Sync with unified selection from other views
  useEffect(() => {
    if (!processedTree || !svgRef.current) return;

    const selectedThemeValue = unifiedSelection?.theme || selectedTheme;

    // Clear all existing highlights first
    d3.select(svgRef.current)
      .selectAll(".node circle")
      .attr("stroke", d => d.children ? "#555" : "#999")
      .attr("stroke-width", 1);

    if (selectedThemeValue) {
      // Find and highlight nodes matching the selected theme
      processedTree.each(node => {
        if (node.data && node.data.name) {
          const nodeTheme = extractThemeFromNodeName(node.data.name);
          if (nodeTheme === selectedThemeValue) {
            // Highlight this node in the visualization
            d3.select(svgRef.current)
              .selectAll(".node")
              .filter(d => d === node)
              .select("circle")
              .attr("stroke", "#dc2626")
              .attr("stroke-width", 3)
              .attr("filter", "drop-shadow(0 0 4px rgba(220, 38, 38, 0.5))");

            // If selection is from another view, update local selected node
            if (unifiedSelection?.source && unifiedSelection.source !== 'phylo') {
              setSelectedNode(node);
              setHoveredNode(node);

              // Highlight path to root using D3 selections
              const svg = d3.select(svgRef.current);
              const links = svg.selectAll(".link");
              const nodes = svg.selectAll(".node");
              const labels = svg.selectAll(".node text");

              highlightPathToRoot(node, links, nodes, labels);
            }
          }
        }
      });
    } else {
      // Clear highlights using D3 selections
      const svg = d3.select(svgRef.current);
      const links = svg.selectAll(".link");
      const nodes = svg.selectAll(".node");
      const labels = svg.selectAll(".node text");

      clearHighlightPath(links, nodes, labels);
    }
  }, [unifiedSelection, selectedTheme, processedTree, layoutType]);

  return (
    <HStack w="full" h="full" spacing={0} overflow="hidden">
      <SidebarContent
        option={layoutType}
        setOption={setLayoutType}
        intLabelNodes={showInternalLabels}
        setIntLabelNodes={setShowInternalLabels}
        leafLabelNodes={showLeafLabels}
        setLeafLabelNodes={setShowLeafLabels}
        raioLeaf={nodeSize}
        setRaioLeaf={setNodeSize}
        depthColorGroups={depthColorGroups}
        setDepthColorGroups={setDepthColorGroups}
        showDistances={showDistances}
        setShowDistances={setShowDistances}
      />

      <Flex
        ref={containerRef}
        flex="1"
        height="100%"
        position="relative"
        overflow="hidden"
        bg="white"
      >
        {/* Control Panel */}
        <Card
          position="absolute"
          top={4}
          right={4}
          zIndex={100}
          size="sm"
          variant="elevated"
          bg="white"
          shadow="lg"
        >
          <CardHeader pb={2}>
            <HStack justify="space-between" w="full">
              <Text fontSize="xs" fontWeight="bold" color="gray.700">
                Controls
              </Text>
              <Badge colorScheme="blue" fontSize="2xs">
                {layoutType === "1" ? "Radial" : "Dendrogram"}
              </Badge>
            </HStack>
          </CardHeader>
          <CardBody pt={0}>
            <VStack spacing={3}>
              {/* Zoom Controls */}
              <ButtonGroup size="sm" isAttached variant="outline" colorScheme="blue">
                <Tooltip label="Zoom In">
                  <IconButton icon={<FiZoomIn />} onClick={handleZoomIn} />
                </Tooltip>
                <Tooltip label="Zoom Out">
                  <IconButton icon={<FiZoomOut />} onClick={handleZoomOut} />
                </Tooltip>
                <Tooltip label="Reset View">
                  <IconButton icon={<FiMaximize2 />} onClick={handleResetZoom} />
                </Tooltip>
              </ButtonGroup>

              {/* Export Button */}
              <Tooltip label="Export as SVG">
                <Button
                  size="sm"
                  leftIcon={<FiDownload />}
                  onClick={exportSVG}
                  colorScheme="green"
                  variant="outline"
                  w="full"
                >
                  Export
                </Button>
              </Tooltip>

              {/* Toggle Distance Labels */}
              <Button
                size="sm"
                leftIcon={showDistances ? <FiEyeOff /> : <FiEye />}
                variant={showDistances ? "solid" : "outline"}
                onClick={() => setShowDistances(!showDistances)}
                colorScheme="purple"
                w="full"
              >
                {showDistances ? "Hide" : "Show"} Distances
              </Button>

              {/* Zoom Level */}
              <Text fontSize="xs" color="gray.600" textAlign="center">
                Zoom: {(zoomLevel * 100).toFixed(0)}%
              </Text>
            </VStack>
          </CardBody>
        </Card>


        {/* Hovered Node Info */}
        {hoveredNode && hoveredNode !== selectedNode && (
          <Box
            position="absolute"
            top={4}
            left={4}
            zIndex={99}
            bg="gray.900"
            color="white"
            p={2}
            borderRadius="md"
            fontSize="xs"
          >
            {hoveredNode.data.name}
          </Box>
        )}

        {/* Main SVG */}
        <Box flex="1" position="relative" ref={containerRef} w="100%" h="100%">
          <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }}></svg>
        </Box>
      </Flex>
    </HStack>
  );
}
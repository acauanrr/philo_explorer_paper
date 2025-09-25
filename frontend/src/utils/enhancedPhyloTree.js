import * as d3 from "d3";

const normalizeLabel = (value) => (value ?? "").toString().trim();

// Enhanced color schemes for better visualization
const colorSchemes = {
  viridis: d3.interpolateViridis,
  plasma: d3.interpolatePlasma,
  turbo: d3.interpolateTurbo,
  rainbow: d3.interpolateRainbow,
  spectral: d3.interpolateSpectral,
  coolwarm: d3.interpolateRdBu,  // Using RdBu as alternative to CoolWarm
  rdylgn: d3.interpolateRdYlGn,
  inferno: d3.interpolateInferno,
  magma: d3.interpolateMagma,
  cividis: d3.interpolateCividis
};

export function renderEnhancedPhyloTree({
  svg,
  rootData,
  width,
  height,
  metricValues = [],
  labels = [],
  labelToIndex = new Map(),
  colorScale,
  showLabels = false,
  showDistances = true,
  highlightLeafSet = null,
  animateTransitions = true,
  colorScheme = "turbo",
  nodeSize = 5,
  linkWidth = 1.8,
  onSelectNode,
  onHoverNode
}) {
  svg.selectAll("*").remove();

  if (!rootData) {
    return { positionsByLabel: new Map() };
  }

  const hierarchy = d3.hierarchy(rootData);

  // Map metrics to nodes
  const metricMap = new Map();
  labels.forEach((label, idx) => {
    const normalized = normalizeLabel(label);
    const value = metricValues[idx];
    if (value !== undefined && value !== null) {
      metricMap.set(normalized, value);
    }
  });


  // Assign metric values to leaf nodes
  let leafCount = 0;
  let mappedCount = 0;
  hierarchy.each((node) => {
    if (!node.children || node.children.length === 0) {
      leafCount++;
      const label = normalizeLabel(node.data?.displayName ?? node.data?.name ?? node.data?.id);
      const value = metricMap.get(label);
      if (value !== undefined) {
        node.metricValue = value;
        mappedCount++;
      } else {
        // Try alternative label formats
        const altLabel = normalizeLabel(node.data?.name ?? node.data?.id);
        const altValue = metricMap.get(altLabel);
        if (altValue !== undefined) {
          node.metricValue = altValue;
          mappedCount++;
        } else {
          node.metricValue = 0;
        }
      }
    }
  });


  // Propagate metrics up the tree
  hierarchy.eachAfter((node) => {
    if (node.children && node.children.length) {
      const values = node.leaves()
        .map((leaf) => leaf.metricValue)
        .filter((val) => val !== undefined);
      node.metricValue = values.length ? d3.mean(values) : 0;
    }
  });

  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * 0.15; // Start tree a bit from center for better visibility
  const outerRadius = radius * 0.85;

  // Setup SVG with enhanced styling
  const viewBox = [-width / 2, -height / 2, width, height];
  svg
    .attr("viewBox", viewBox.join(" "))
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto; font-family: 'Inter', -apple-system, sans-serif;");

  // Add gradient background for depth
  const defs = svg.append("defs");

  // Radial gradient for background
  const bgGradient = defs.append("radialGradient")
    .attr("id", "bg-gradient")
    .attr("cx", "50%")
    .attr("cy", "50%")
    .attr("r", "50%");

  bgGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#f0f4f8")
    .attr("stop-opacity", 0.2);

  bgGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#e2e8f0")
    .attr("stop-opacity", 0.1);

  // Background circle with subtle gradient
  svg.append("circle")
    .attr("r", outerRadius)
    .attr("fill", "url(#bg-gradient)");

  // Add concentric circles for depth indication
  const depthCircles = svg.append("g").attr("class", "depth-circles");
  const maxDepth = hierarchy.height || 1;

  for (let i = 1; i <= maxDepth; i++) {
    const circleRadius = innerRadius + (outerRadius - innerRadius) * (i / maxDepth);
    depthCircles.append("circle")
      .attr("r", circleRadius)
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "2,4")
      .attr("opacity", 0.3);
  }

  const rootGroup = svg.append("g").attr("class", "phylo-tree-root");

  // Enhanced zoom with smooth transitions
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 10])
    .on("zoom", (event) => {
      if (animateTransitions) {
        rootGroup.transition()
          .duration(50)
          .attr("transform", event.transform);
      } else {
        rootGroup.attr("transform", event.transform);
      }
    });

  svg.call(zoomBehavior).on("dblclick.zoom", () => {
    svg.transition()
      .duration(750)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  });

  // Use cluster layout for radial tree
  const cluster = d3.cluster()
    .size([360, outerRadius - innerRadius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / (a.depth + 1));

  cluster(hierarchy);

  // Calculate edge lengths
  hierarchy.each((node) => {
    if (!node.parent) {
      node.edgeLength = 0;
      node.pathLength = 0;
      return;
    }
    const rawLength = node.data?.length ?? node.data?.distance ?? node.data?.branch_length ?? 0;
    const edgeLength = Number.isFinite(rawLength) ? Math.max(0, Number(rawLength)) : 0;
    node.edgeLength = edgeLength;
    node.pathLength = (node.parent.pathLength ?? 0) + edgeLength;
  });

  const maxPathLength = d3.max(hierarchy.leaves(), (leaf) => leaf.pathLength ?? 0) ?? 0;
  const hasMeaningfulLengths = maxPathLength > 0 && showDistances;

  // Radial scales
  const radialScale = hasMeaningfulLengths
    ? d3.scaleLinear()
        .domain([0, Math.max(1e-6, maxPathLength)])
        .range([innerRadius, outerRadius])
        .clamp(true)
    : d3.scaleLinear()
        .domain([0, hierarchy.height || 1])
        .range([innerRadius, outerRadius])
        .clamp(true);

  // Convert to Cartesian coordinates
  hierarchy.each((node) => {
    const angle = ((node.x - 90) / 180) * Math.PI;
    const radialDistance = hasMeaningfulLengths
      ? radialScale(node.pathLength ?? 0)
      : radialScale(node.depth ?? 0);

    node.angle = angle;
    node.radius = radialDistance;
    node.xPos = Math.cos(angle) * radialDistance;
    node.yPos = Math.sin(angle) * radialDistance;
  });

  // Enhanced color scale with better handling of uniform values
  const validMetrics = metricValues.filter(v => Number.isFinite(v));
  let metricExtent = validMetrics.length > 0 ? d3.extent(validMetrics) : [0, 1];

  // Calculate domain based on the actual data range
  let finalDomain;

  // If very small variation (less than 0.01), expand the range for better visualization
  const range = metricExtent[1] - metricExtent[0];

  if (range < 0.01) {
    // For nearly uniform values, create an artificial range
    const center = (metricExtent[0] + metricExtent[1]) / 2;
    // Expand by at least 10% on each side, or to 0-1 bounds
    const expansion = Math.max(0.1, center * 0.5);
    finalDomain = [
      Math.max(0, center - expansion),
      Math.min(1, center + expansion)
    ];
  } else if (range < 0.05) {
    // For small variation, add 20% padding
    const padding = range * 0.2;
    finalDomain = [
      Math.max(0, metricExtent[0] - padding),
      Math.min(1, metricExtent[1] + padding)
    ];
  } else {
    // Use actual extent for good variation
    finalDomain = metricExtent;
  }

  // Create color scale with selected interpolator
  const interpolator = colorSchemes[colorScheme] || d3.interpolateTurbo;
  const enhancedColorScale = d3.scaleSequential()
    .interpolator(interpolator)
    .domain(finalDomain);


  // Create smooth curved paths for links
  const linkGenerator = d3.linkRadial()
    .angle(d => d.angle)
    .radius(d => d.radius);

  // Add shadow filter for depth
  const shadowFilter = defs.append("filter")
    .attr("id", "shadow")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");

  shadowFilter.append("feGaussianBlur")
    .attr("in", "SourceAlpha")
    .attr("stdDeviation", 2);

  shadowFilter.append("feOffset")
    .attr("dx", 0)
    .attr("dy", 1);

  shadowFilter.append("feComponentTransfer")
    .append("feFuncA")
    .attr("type", "linear")
    .attr("slope", 0.3);

  const feMerge = shadowFilter.append("feMerge");
  feMerge.append("feMergeNode");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // Draw links with enhanced styling
  const links = rootGroup.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(hierarchy.links())
    .join("path")
    .attr("d", linkGenerator)
    .attr("fill", "none")
    .attr("stroke", d => {
      // Color links based on target node metric
      const targetValue = d.target.metricValue;
      if (targetValue !== undefined && Number.isFinite(targetValue)) {
        return enhancedColorScale(targetValue);
      }
      return "#94a3b8";
    })
    .attr("stroke-width", d => {
      // Vary width based on depth for visual hierarchy
      const depthFactor = Math.max(0.3, 1 - (d.target.depth / (hierarchy.height || 1)) * 0.6);
      return linkWidth * depthFactor;
    })
    .attr("stroke-opacity", d => {
      // Highlight or dim based on selection
      if (highlightLeafSet) {
        const targetLeaves = d.target.leaves ? d.target.leaves() : [d.target];
        const hasHighlight = targetLeaves.some(leaf => {
          const label = normalizeLabel(leaf.data?.name ?? leaf.data?.id);
          return highlightLeafSet.has(label);
        });
        return hasHighlight ? 0.85 : 0.15;
      }
      return 0.6;
    })
    .attr("stroke-linecap", "round")
    .style("transition", "all 0.3s ease");

  // Create node groups
  const nodes = rootGroup.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(hierarchy.descendants())
    .join("g")
    .attr("transform", d => `translate(${d.xPos},${d.yPos})`);

  // Add glow effect for important nodes
  const glowGradient = defs.append("radialGradient")
    .attr("id", "node-glow");

  glowGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#fff")
    .attr("stop-opacity", 0.8);

  glowGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#fff")
    .attr("stop-opacity", 0);

  // Node circles with enhanced visuals
  nodes.append("circle")
    .attr("class", "node-bg")
    .attr("r", d => {
      if (!d.children) return nodeSize * 1.8;
      return nodeSize * 1.2;
    })
    .attr("fill", d => {
      if (d.metricValue !== undefined && Number.isFinite(d.metricValue)) {
        const color = d3.color(enhancedColorScale(d.metricValue));
        color.opacity = 0.15;
        return color.toString();
      }
      return "rgba(100, 116, 139, 0.1)";
    })
    .attr("filter", d => d.children ? "" : "url(#shadow)");

  nodes.append("circle")
    .attr("class", "node-main")
    .attr("r", d => {
      // Larger nodes for leaves and important branches
      if (!d.children) return nodeSize;
      return nodeSize * 0.75;
    })
    .attr("fill", d => {
      if (d.metricValue !== undefined && Number.isFinite(d.metricValue)) {
        return enhancedColorScale(d.metricValue);
      }
      return "#64748b";
    })
    .attr("stroke", d => {
      // Highlight selected or hovered nodes
      if (highlightLeafSet && !d.children) {
        const label = normalizeLabel(d.data?.name ?? d.data?.id);
        if (highlightLeafSet.has(label)) {
          return "#1e40af";
        }
      }
      return "#fff";
    })
    .attr("stroke-width", d => {
      if (highlightLeafSet && !d.children) {
        const label = normalizeLabel(d.data?.name ?? d.data?.id);
        if (highlightLeafSet.has(label)) {
          return 2.5;
        }
      }
      return 1.5;
    })
    .attr("opacity", d => {
      if (highlightLeafSet) {
        if (!d.children) {
          const label = normalizeLabel(d.data?.name ?? d.data?.id);
          return highlightLeafSet.has(label) ? 1 : 0.25;
        }
        const leaves = d.leaves();
        const hasHighlight = leaves.some(leaf => {
          const label = normalizeLabel(leaf.data?.name ?? leaf.data?.id);
          return highlightLeafSet.has(label);
        });
        return hasHighlight ? 0.9 : 0.25;
      }
      return 0.95;
    })
    .style("cursor", "pointer")
    .style("transition", "all 0.3s ease");

  // Interactive behavior - only click, no hover
  nodes
    .on("click", function(event, d) {
      event.stopPropagation();

      // Clear any previous selection
      nodes.selectAll(".node-main")
        .attr("stroke-width", 1.5)
        .attr("r", function(n) {
          return n.children ? nodeSize * 0.75 : nodeSize;
        });

      // Highlight clicked node
      const clickedNode = d3.select(this);
      clickedNode.select(".node-main")
        .transition()
        .duration(200)
        .attr("r", d.children ? nodeSize * 0.9 : nodeSize * 1.3)
        .attr("stroke-width", 3);

      // Add ripple effect
      const ripple = clickedNode
        .append("circle")
        .attr("class", "ripple")
        .attr("r", nodeSize)
        .attr("fill", "none")
        .attr("stroke", enhancedColorScale(d.metricValue ?? 0.5))
        .attr("stroke-width", 2)
        .attr("opacity", 0.8);

      ripple.transition()
        .duration(600)
        .attr("r", nodeSize * 4)
        .attr("stroke-width", 0.5)
        .attr("opacity", 0)
        .remove();

      // Call the select handler for any node type
      if (onSelectNode) {
        onSelectNode(d);
      }
    });

  // Add labels for leaf nodes (if enabled) with better positioning
  if (showLabels) {
    nodes.filter(d => !d.children)
      .append("text")
      .attr("class", "node-label")
      .attr("dy", "0.31em")
      .attr("x", d => {
        const angleDeg = (d.x - 90);
        return Math.cos(angleDeg * Math.PI / 180) > 0 ? 10 : -10;
      })
      .attr("text-anchor", d => {
        const angleDeg = (d.x - 90);
        return Math.cos(angleDeg * Math.PI / 180) > 0 ? "start" : "end";
      })
      .attr("transform", d => {
        const rotation = d.x < 180 ? d.x - 90 : d.x + 90;
        return `rotate(${rotation})`;
      })
      .text(d => d.data?.displayName ?? d.data?.name ?? d.data?.id ?? "")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#1e293b")
      .attr("opacity", 0.85)
      .style("text-shadow", "0 1px 2px rgba(255,255,255,0.8)")
      .style("pointer-events", "none");
  }

  // Add tooltips for all nodes
  nodes.append("title")
    .text(d => {
      const name = d.data?.displayName ?? d.data?.name ?? d.data?.id ?? "Node";
      const value = d.metricValue !== undefined ? ` (${(d.metricValue * 100).toFixed(1)}%)` : "";
      return `${name}${value}`;
    });

  // Add center decoration
  rootGroup.append("circle")
    .attr("r", innerRadius * 0.8)
    .attr("fill", "url(#node-glow)")
    .attr("opacity", 0.6)
    .style("pointer-events", "none");

  rootGroup.append("circle")
    .attr("r", innerRadius * 0.5)
    .attr("fill", "#3b82f6")
    .attr("opacity", 0.2)
    .style("pointer-events", "none");

  // Return positions for external use
  const positionsByLabel = new Map();
  hierarchy.leaves().forEach((leaf) => {
    const label = normalizeLabel(leaf.data?.displayName ?? leaf.data?.name ?? leaf.data?.id);
    positionsByLabel.set(label, { x: leaf.xPos, y: leaf.yPos, label });
  });

  return { positionsByLabel };
}
import * as d3 from "d3";

const normalizeLabel = (value) => (value ?? "").toString().trim();

const blendColor = (baseColor, alpha = 1) => {
  if (!baseColor) {
    return `rgba(148,163,184,${alpha})`;
  }
  const c = d3.color(baseColor);
  if (!c) {
    return `rgba(148,163,184,${alpha})`;
  }
  c.opacity = alpha;
  return c.formatRgb();
};

export function renderPhyloExplorerTree({
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
  showVoronoi = true,
  voronoiAlpha = 0.3,
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
    metricMap.set(normalized, metricValues[idx] ?? 0);
  });

  hierarchy.each((node) => {
    const label = normalizeLabel(node.data?.displayName ?? node.data?.name ?? node.data?.id);
    if (!node.children || node.children.length === 0) {
      node.metricValue = metricMap.get(label) ?? 0;
    }
  });

  hierarchy.eachAfter((node) => {
    if (node.children && node.children.length) {
      const values = node.children
        .filter((child) => child.metricValue !== undefined)
        .map((child) => child.metricValue);
      if (values.length) {
        node.metricValue = d3.mean(values);
      } else {
        const descendantValues = node.leaves()
          .map((leaf) => leaf.metricValue)
          .filter((val) => val !== undefined);
        node.metricValue = descendantValues.length ? d3.mean(descendantValues) : 0;
      }
    }
  });

  const radius = Math.min(width, height) / 2;
  const innerRadius = 0;
  const outerRadius = radius * 0.92;

  const viewBox = [-width / 2, -height / 2, width, height];
  svg
    .attr("viewBox", viewBox.join(" "))
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto; font-family: 'Inter', sans-serif;");

  const rootGroup = svg.append("g").attr("class", "phylo-explorer-root");

  const zoomBehavior = d3.zoom()
    .scaleExtent([0.35, 6])
    .on("zoom", (event) => {
      rootGroup.attr("transform", event.transform);
    });

  svg.call(zoomBehavior).on("dblclick.zoom", null);

  const cluster = d3.cluster()
    .size([360, outerRadius - innerRadius])
    .separation(() => 1);

  cluster(hierarchy);

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
  const hasMeaningfulLengths = maxPathLength > 0;
  const maxDepth = hierarchy.height || 1;

  const radialByLength = d3
    .scaleLinear()
    .domain([0, Math.max(1e-6, maxPathLength)])
    .range([innerRadius, outerRadius])
    .clamp(true);

  const radialByDepth = d3
    .scaleLinear()
    .domain([0, maxDepth])
    .range([innerRadius, outerRadius])
    .clamp(true);

  hierarchy.each((node) => {
    const angle = (node.x / 180) * Math.PI;
    const radialDistance = hasMeaningfulLengths
      ? radialByLength(node.pathLength ?? 0)
      : radialByDepth(node.depth ?? 0);

    node.angle = angle;
    node.radius = radialDistance;
    node.xPos = Math.cos(angle) * radialDistance;
    node.yPos = Math.sin(angle) * radialDistance;
  });

  const positionsByLabel = new Map();
  hierarchy.leaves().forEach((leaf) => {
    const label = normalizeLabel(leaf.data?.displayName ?? leaf.data?.name ?? leaf.data?.id);
    positionsByLabel.set(label, { x: leaf.xPos, y: leaf.yPos, label });
  });

  const linkPath = (linkDatum) => {
    const sourceAngle = linkDatum.source.angle;
    const sourceRadius = linkDatum.source.radius;
    const targetAngle = linkDatum.target.angle;
    const targetRadius = linkDatum.target.radius;

    const path = d3.path();
    path.moveTo(sourceRadius * Math.cos(sourceAngle), sourceRadius * Math.sin(sourceAngle));

    if (showDistances && linkDatum.target.data?.length) {
      const midRadius = (sourceRadius + targetRadius) / 2;
      path.quadraticCurveTo(
        midRadius * Math.cos(sourceAngle),
        midRadius * Math.sin(sourceAngle),
        targetRadius * Math.cos(targetAngle),
        targetRadius * Math.sin(targetAngle)
      );
    } else {
      const midRadius = (sourceRadius + targetRadius) / 2;
      path.bezierCurveTo(
        midRadius * Math.cos(sourceAngle),
        midRadius * Math.sin(sourceAngle),
        midRadius * Math.cos(targetAngle),
        midRadius * Math.sin(targetAngle),
        targetRadius * Math.cos(targetAngle),
        targetRadius * Math.sin(targetAngle)
      );
    }

    return path.toString();
  };

  const linksGroup = rootGroup.append("g").attr("class", "phylo-links");
  const nodesGroup = rootGroup.append("g").attr("class", "phylo-nodes");
  const labelsGroup = rootGroup.append("g").attr("class", "phylo-labels");

  const links = linksGroup
    .selectAll("path")
    .data(hierarchy.links())
    .join("path")
    .attr("class", "phylo-link")
    .attr("fill", "none")
    .attr("stroke", (d) => blendColor(colorScale(d.target.metricValue ?? 0), 0.85))
    .attr("stroke-width", (d) => (d.source.depth === 0 ? 2 : d.source.depth === 1 ? 1.5 : 1))
    .attr("stroke-opacity", 0.6)
    .attr("d", linkPath);

  const nodeEnter = nodesGroup
    .selectAll("g")
    .data(hierarchy.descendants())
    .join("g")
    .attr("transform", (d) => `translate(${d.xPos}, ${d.yPos})`)
    .attr("class", "phylo-node");

  const circles = nodeEnter
    .append("circle")
    .attr("r", (d) => (d.children ? Math.max(1.5, Math.min(6, 6 - d.depth * 0.5)) : 4.5))
    .attr("fill", (d) => {
      const baseColor = colorScale(d.metricValue ?? 0);
      const alpha = d.children ? 0.9 : 1;
      return blendColor(baseColor, alpha);
    })
    .attr("stroke", (d) => (d.children ? "rgba(15,23,42,0.35)" : "rgba(15,23,42,0.65)"))
    .attr("stroke-width", (d) => (d.children ? 0.7 : 0.9))
    .attr("pointer-events", showVoronoi ? "none" : "all")
    .on("click", (event, d) => {
      if (!showVoronoi) {
        event.stopPropagation();
        onSelectNode?.(d);
      }
    })
    .on("mouseover", (event, d) => {
      if (!showVoronoi) {
        onHoverNode?.(d, true);
      }
    })
    .on("mouseout", () => {
      if (!showVoronoi) {
        onHoverNode?.(null, false);
      }
    });

  if (showLabels) {
    labelsGroup
      .selectAll("text")
      .data(hierarchy.leaves())
      .join("text")
      .attr("class", "phylo-label")
      .attr("font-size", 10)
      .attr("fill", "#334155")
      .attr("transform", (d) => {
        const rotation = (d.angle * 180) / Math.PI;
        return `translate(${d.xPos}, ${d.yPos}) rotate(${rotation >= 90 && rotation <= 270 ? rotation + 180 : rotation}) translate(${rotation >= 90 && rotation <= 270 ? 6 : -6}, 4)`;
      })
      .attr("text-anchor", (d) => {
        const rotation = (d.angle * 180) / Math.PI;
        return rotation >= 90 && rotation <= 270 ? "end" : "start";
      })
      .text((d) => d.data?.displayName ?? d.data?.name ?? d.data?.id ?? "");
  }

  if (showVoronoi) {
    const leaves = hierarchy.leaves();
    const delaunay = d3.Delaunay.from(
      leaves,
      (d) => d.xPos,
      (d) => d.yPos
    );
    const voronoiPad = radius * 0.08;
    const voronoiBounds = [
      -outerRadius - voronoiPad,
      -outerRadius - voronoiPad,
      outerRadius + voronoiPad,
      outerRadius + voronoiPad
    ];
    const voronoi = delaunay.voronoi(voronoiBounds);

    const baseVoronoiAlpha = Math.min(1, Math.max(0.08, voronoiAlpha ? voronoiAlpha * 0.3 : 0.15));

    const voronoiGroup = rootGroup.insert("g", ".phylo-links")
      .attr("class", "phylo-voronoi");

    const voronoiCells = voronoiGroup
      .selectAll("path")
      .data(leaves)
      .join("path")
      .attr("d", (_, i) => voronoi.renderCell(i))
      .attr("fill", (d) => colorScale(d.metricValue ?? 0))
      .attr("fill-opacity", baseVoronoiAlpha)
      .attr("stroke", "none")
      .attr("pointer-events", "all")
      .style("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        // Brighten Voronoi cell on hover
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", colorScale(d.metricValue ?? 0))
          .attr("fill-opacity", Math.min(1, Math.max(0.2, voronoiAlpha ?? 0.3)))
          .attr("stroke", blendColor(colorScale(d.metricValue ?? 0), 0.8))
          .attr("stroke-width", 1.5);

        // Highlight corresponding node
        const nodeCircle = circles.filter(n => n === d);
        nodeCircle
          .transition()
          .duration(150)
          .attr("r", 6.5);

        // Call hover callback
        if (onHoverNode) {
          onHoverNode(d, true);
        }
      })
      .on("mouseleave", function(event, d) {
        // Fade Voronoi cell back to subtle visibility
        d3.select(this)
          .transition()
          .duration(300)
          .attr("fill", colorScale(d.metricValue ?? 0))
          .attr("fill-opacity", baseVoronoiAlpha)
          .attr("stroke", "none");

        // Reset node size
        const nodeCircle = circles.filter(n => n === d);
        nodeCircle
          .transition()
          .duration(300)
          .attr("r", 4.5);

        // Call hover callback
        if (onHoverNode) {
          onHoverNode(null, false);
        }
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onSelectNode) {
          onSelectNode(d);
        }
      });

    // Optional: Add mesh for debugging
    voronoiGroup.append("path")
      .attr("class", "voronoi-mesh")
      .attr("d", voronoi.render())
      .attr("fill", "none")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0)
      .attr("pointer-events", "none");
  }

  if (highlightLeafSet) {
    links.attr("stroke-opacity", (d) => {
      const normalizedTarget = normalizeLabel(d.target.data?.displayName ?? d.target.data?.name ?? d.target.data?.id);
      return highlightLeafSet.has(normalizedTarget) ? 0.85 : 0.2;
    });

    nodeEnter.select("circle")
      .attr("opacity", (d) => {
        const normalized = normalizeLabel(d.data?.displayName ?? d.data?.name ?? d.data?.id);
        if (!highlightLeafSet.size) return 1;
        if (!d.children && highlightLeafSet.has(normalized)) return 1;
        if (d.children) {
          const hasDescendant = d.leaves().some((leaf) => {
            const leafLabel = normalizeLabel(leaf.data?.displayName ?? leaf.data?.name ?? leaf.data?.id);
            return highlightLeafSet.has(leafLabel);
          });
          return hasDescendant ? 1 : 0.25;
        }
        return highlightLeafSet.has(normalized) ? 1 : 0.25;
      });
  }

  return {
    positionsByLabel,
    root: hierarchy
  };
}

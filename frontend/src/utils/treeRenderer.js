import * as d3 from "d3";
import { createTreeLayout, linkStep } from "./treeUtils";

export const defaultTreeTheme = {
  background: "transparent",
  radialGrid: {
    enabled: true,
    steps: 5,
    stroke: "rgba(148, 163, 184, 0.35)",
    strokeWidth: 0.6
  },
  branch: {
    stroke: "rgba(148, 163, 184, 0.6)",
    width: 1.4,
    highlightStroke: "#f97316",
    highlightWidth: 2.4,
    opacity: 0.9
  },
  leaf: {
    radius: 4,
    stroke: "#ffffff",
    strokeWidth: 1.2,
    fill: "#0ea5e9"
  },
  internal: {
    stroke: "#ffffff",
    strokeWidth: 1,
    minRadius: 2.2,
    maxRadius: 4.5,
    baseFill: "#cbd5f5"
  },
  label: {
    fontSize: 9,
    color: "#334155",
    halo: "rgba(255,255,255,0.85)",
    haloWidth: 3
  },
  glow: {
    enabled: true,
    color: "rgba(14, 165, 233, 0.35)",
    stdDeviation: 4
  }
};

const labFromColor = (color) => {
  try {
    return d3.lab(color);
  } catch (error) {
    return d3.lab("#cccccc");
  }
};

const blendColors = (colors = []) => {
  if (!colors.length) {
    return "#94a3b8";
  }

  const labs = colors.map(labFromColor);
  const l = d3.mean(labs, (c) => c.l) ?? 70;
  const a = d3.mean(labs, (c) => c.a) ?? 0;
  const b = d3.mean(labs, (c) => c.b) ?? 0;
  return d3.lab(l, a, b).formatHex();
};

const ensureDefs = (svg) => {
  let defs = svg.select("defs");
  if (defs.empty()) {
    defs = svg.append("defs");
  }
  return defs;
};

const setupGlowFilter = (svg, theme) => {
  if (!theme.glow?.enabled) return null;

  const defs = ensureDefs(svg);
  const filterId = "tree-node-glow";
  let filter = defs.select(`#${filterId}`);
  if (filter.empty()) {
    filter = defs.append("filter")
      .attr("id", filterId)
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    filter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", theme.glow.stdDeviation ?? 4)
      .attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
  }

  return `url(#${filterId})`;
};

const drawRadialGrid = (group, radius, theme) => {
  if (!theme.radialGrid?.enabled) return;
  const steps = theme.radialGrid.steps ?? 4;
  const radii = d3.range(1, steps + 1).map((step) => (radius * step) / steps);

  const gridGroup = group.append("g")
    .attr("class", "tree-radial-grid")
    .attr("stroke", theme.radialGrid.stroke)
    .attr("stroke-width", theme.radialGrid.strokeWidth)
    .attr("fill", "none");

  gridGroup.selectAll("circle")
    .data(radii)
    .join("circle")
    .attr("r", (d) => d);
};

const normalizeLabel = (value) => (value ?? "").toString().trim();

export const renderRadialTree = ({
  svg,
  rootData,
  width,
  height,
  theme = defaultTreeTheme,
  showLabels = false,
  labelAccessor = (d) => d.data?.displayName ?? d.data?.name ?? "",
  leafColorAccessor = (d) => d.data?.color ?? theme.leaf.fill,
  internalColorAccessor,
  highlight = {},
  overlayRoot = null,
  linkStyler,
  nodeStyler,
  useBranchLengths = true,
  radiusAccessor,
  onNodeClick,
  onLeafClick,
  onLeafHover
}) => {
  if (!svg || !rootData) {
    return { positions: new Map(), positionsByLabel: new Map(), root: null };
  }

  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", height);

  const root = d3.hierarchy(rootData);
  const { outerRadius, innerRadius } = createTreeLayout(root, width, height);

  const resolveRadius = (node) => {
    if (typeof radiusAccessor === "function") {
      return radiusAccessor(node);
    }
    if (useBranchLengths && node.radius !== undefined) {
      return node.radius;
    }
    return node.y;
  };

  const glowUrl = setupGlowFilter(svg, theme);
  const treeGroup = svg.append("g")
    .attr("class", "radial-tree-root")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  drawRadialGrid(treeGroup, innerRadius, theme);

  const highlightLinks = highlight.links ?? (() => false);
  const highlightNodes = highlight.nodes ?? (() => false);
  const resolveLinkStyler = typeof linkStyler === "function" ? linkStyler : () => ({});
  const resolveNodeStyler = typeof nodeStyler === "function" ? nodeStyler : () => ({});

  treeGroup.append("g")
    .attr("class", "tree-links")
    .attr("fill", "none")
    .selectAll("path")
    .data(root.links())
    .join("path")
    .each(function(d) {
      const baseStroke = highlightLinks(d)
        ? (theme.branch.highlightStroke ?? theme.branch.stroke)
        : theme.branch.stroke;
      const baseWidth = highlightLinks(d)
        ? (theme.branch.highlightWidth ?? theme.branch.width)
        : theme.branch.width;
      const baseOpacity = theme.branch.opacity ?? 1;

      d3.select(this)
        .attr("d", linkStep(d.source.x, resolveRadius(d.source), d.target.x, resolveRadius(d.target)))
        .attr("stroke", baseStroke)
        .attr("stroke-width", baseWidth)
        .attr("stroke-opacity", baseOpacity);

      const style = resolveLinkStyler(d) || {};
      if (style.stroke) d3.select(this).attr("stroke", style.stroke);
      if (style.strokeWidth !== undefined) d3.select(this).attr("stroke-width", style.strokeWidth);
      if (style.strokeOpacity !== undefined) d3.select(this).attr("stroke-opacity", style.strokeOpacity);
      if (style.strokeDasharray) d3.select(this).attr("stroke-dasharray", style.strokeDasharray);
    });

  const nodeGroup = treeGroup.append("g")
    .attr("class", "tree-nodes")
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", (d) => `
      rotate(${d.x - 90})
      translate(${resolveRadius(d)},0)
    `);

  const positions = new Map();
  const positionsByLabel = new Map();

  const getLeafColor = (d) => leafColorAccessor(d);
  const getInternalColor = (d) => {
    if (internalColorAccessor) {
      return internalColorAccessor(d);
    }
    const childColors = (d.children ?? [])
      .filter((child) => !child.children || child.children.length === 0)
      .map((child) => getLeafColor(child));
    return childColors.length ? blendColors(childColors) : theme.internal.baseFill;
  };

  nodeGroup.append("circle")
    .each(function(d) {
      const isInternal = Boolean(d.children && d.children.length);
      const baseRadius = isInternal
        ? (() => {
            const base = theme.internal.minRadius ?? 2.2;
            const max = theme.internal.maxRadius ?? 4.5;
            const depthFactor = Math.min(1, d.depth / (root.height || 1));
            return base + (max - base) * (1 - depthFactor);
          })()
        : (theme.leaf.radius ?? 4);

      const baseFill = isInternal ? getInternalColor(d) : getLeafColor(d);
      const baseStroke = isInternal ? (theme.internal.stroke ?? "#fff") : (theme.leaf.stroke ?? "#fff");
      const baseStrokeWidth = isInternal ? (theme.internal.strokeWidth ?? 1) : (theme.leaf.strokeWidth ?? 1);
      const baseOpacity = highlightNodes(d) ? 1 : 0.9;
      const baseFilter = isInternal ? null : (glowUrl ?? null);

      const style = resolveNodeStyler(d) || {};
      const radius = style.radius !== undefined ? style.radius : baseRadius;
      const fill = style.fill ?? baseFill;
      const stroke = style.stroke ?? baseStroke;
      const strokeWidth = style.strokeWidth ?? baseStrokeWidth;
      const opacity = style.opacity ?? baseOpacity;
      const filter = style.filter !== undefined ? style.filter : baseFilter;

      d3.select(this)
        .attr("r", radius)
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth)
        .attr("filter", filter)
        .attr("opacity", opacity);
    })
    .style("cursor", (d) => (d.children && d.children.length ? "default" : "pointer"))
    .on("mouseover", function(event, d) {
      if (d.children && d.children.length) return;
      d3.select(this).attr("stroke-width", (theme.leaf.strokeWidth ?? 1) + 0.8);
      onLeafHover?.(d, true);
    })
    .on("mouseout", function(event, d) {
      if (d.children && d.children.length) return;
      d3.select(this).attr("stroke-width", theme.leaf.strokeWidth ?? 1);
      onLeafHover?.(d, false);
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      onNodeClick?.(d);
      if (!d.children || !d.children.length) {
        onLeafClick?.(d);
      }
    });

  nodeGroup.each((node) => {
    if (!node.children || !node.children.length) {
      const angle = (node.x - 90) * (Math.PI / 180);
      const radius = resolveRadius(node);
      const x = Math.cos(angle) * radius + width / 2;
      const y = Math.sin(angle) * radius + height / 2;
      const label = labelAccessor(node) ?? "";
      const normalized = normalizeLabel(label);
      positions.set(node, { x, y, label });
      positionsByLabel.set(normalized, { x, y, label });
    }
  });

  if (showLabels) {
    nodeGroup.filter((d) => !d.children || d.children.length === 0)
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d) => (d.x < 180 ? 8 : -8))
      .attr("text-anchor", (d) => (d.x < 180 ? "start" : "end"))
      .attr("transform", (d) => (d.x >= 180 ? "rotate(180)" : null))
      .text((d) => (labelAccessor(d) ?? "").substring(0, 40))
      .attr("fill", theme.label.color)
      .attr("font-size", `${theme.label.fontSize ?? 9}px`)
      .attr("paint-order", "stroke")
      .attr("stroke", theme.label.halo ?? "#ffffff")
      .attr("stroke-width", theme.label.haloWidth ?? 2)
      .attr("stroke-linejoin", "round");
  }

  if (overlayRoot) {
    const overlay = d3.hierarchy(overlayRoot);
    createTreeLayout(overlay, width, height);

    treeGroup.append("g")
      .attr("fill", "none")
      .attr("stroke", "rgba(248,113,113,0.45)")
      .attr("stroke-width", theme.branch.width ?? 1.2)
      .selectAll("path")
      .data(overlay.links())
      .join("path")
      .attr("d", (d) => linkStep(
        d.source.x,
        resolveRadius(d.source),
        d.target.x,
        resolveRadius(d.target)
      ));
  }

  return { positions, positionsByLabel, root, treeGroup };
};

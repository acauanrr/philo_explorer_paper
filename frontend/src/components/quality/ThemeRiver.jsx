"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const ThemeRiver = ({ data = [], categories = [], width = 320, height = 220, colorScheme = "turbo" }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!data.length || !categories.length) {
      return;
    }

    const margin = { top: 10, right: 10, bottom: 20, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleTime()
      .domain(d3.extent(data, (d) => d.date))
      .range([0, innerWidth]);

    const stack = d3.stack()
      .keys(categories)
      .order(d3.stackOrderInsideOut)
      .offset(d3.stackOffsetWiggle);

    const stackedSeries = stack(data);

    const yExtent = d3.extent(stackedSeries.flatMap((layer) => layer.flat()));
    const y = d3.scaleLinear()
      .domain([yExtent[0] ?? -1, yExtent[1] ?? 1])
      .range([innerHeight, 0]);

    // Create color scale based on selected color scheme
    const colorSchemes = {
      viridis: d3.interpolateViridis,
      plasma: d3.interpolatePlasma,
      turbo: d3.interpolateTurbo,
      inferno: d3.interpolateInferno,
      magma: d3.interpolateMagma,
      cividis: d3.interpolateCividis,
      warm: d3.interpolateWarm,
      cool: d3.interpolateCool,
      cubehelix: d3.interpolateCubehelixDefault,
      rainbow: d3.interpolateRainbow,
      sinebow: d3.interpolateSinebow,
      spectral: d3.interpolateSpectral,
      rdbu: d3.interpolateRdBu,
      rdylgn: d3.interpolateRdYlGn,
      rdylbu: d3.interpolateRdYlBu,
      puor: d3.interpolatePuOr,
      prgn: d3.interpolatePRGn,
      brbg: d3.interpolateBrBG,
      piyg: d3.interpolatePiYG
    };

    const selectedInterpolator = colorSchemes[colorScheme] || d3.interpolateTurbo;

    // Create color scale distributing categories across the interpolator range
    const color = d3.scaleOrdinal()
      .domain(categories)
      .range(categories.map((_, i) => selectedInterpolator(i / Math.max(1, categories.length - 1))));

    const area = d3.area()
      .curve(d3.curveCatmullRom)
      .x((d) => x(d.data.date))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]));

    const root = svg
      .attr("viewBox", [0, 0, width, height])
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    root.selectAll("path.theme-river-layer")
      .data(stackedSeries)
      .join("path")
      .attr("class", "theme-river-layer")
      .attr("fill", (d) => color(d.key))
      .attr("d", area)
      .attr("fill-opacity", 0.85)
      .attr("stroke", "rgba(15,23,42,0.12)")
      .attr("stroke-width", 0.6)
      .append("title")
      .text((d) => d.key);

    const axis = root.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, data.length)).tickFormat(d3.timeFormat("%b %Y")));

    axis.selectAll("text")
      .attr("font-size", 10)
      .attr("fill", "#475569")
      .attr("dy", "0.8em")
      .attr("transform", "rotate(-10)");
  }, [data, categories, width, height, colorScheme]);

  return (
    <svg ref={svgRef} width={width} height={height} role="img" aria-label="Theme river visualization" />
  );
};

export default ThemeRiver;

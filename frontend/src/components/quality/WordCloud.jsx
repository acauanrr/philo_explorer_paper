"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import cloud from "d3-cloud";

const WordCloud = ({
  words = [],
  width = 320,
  height = 220,
  minFontSize = 12,
  maxFontSize = 46
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!words.length) {
      return;
    }

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(words, (d) => d.value) || 1])
      .range([minFontSize, maxFontSize]);

    const layout = cloud()
      .size([width, height])
      .words(words.map((w) => ({ ...w, size: sizeScale(w.value) })))
      .padding(2)
      .rotate(() => (Math.random() > 0.5 ? 0 : 90))
      .font("Inter, sans-serif")
      .fontSize((d) => d.size)
      .on("end", (drawn) => {
        svg.attr("viewBox", [0, 0, width, height]);
        const group = svg.append("g")
          .attr("transform", `translate(${width / 2}, ${height / 2})`);

        group.selectAll("text")
          .data(drawn)
          .join("text")
          .attr("text-anchor", "middle")
          .attr("font-size", (d) => d.size)
          .attr("fill", (d, i) => d3.schemeTableau10[i % d3.schemeTableau10.length])
          .attr("transform", (d) => `translate(${d.x}, ${d.y}) rotate(${d.rotate})`)
          .text((d) => d.text)
          .append("title")
          .text((d) => `${d.text}: ${d.value}`);
      });

    layout.start();

    return () => {
      layout.stop();
    };
  }, [words, width, height, minFontSize, maxFontSize]);

  return (
    <svg ref={svgRef} width={width} height={height} role="img" aria-label="Word cloud visualization" />
  );
};

export default WordCloud;

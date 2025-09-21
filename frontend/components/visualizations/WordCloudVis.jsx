"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import cloud from "d3-cloud";
import { Box, Text, VStack, useColorModeValue } from "@chakra-ui/react";
import { usePhyloCtx } from "../../contexts/PhyloContext";
import { getNodeColor } from "./PhyloExplorer/utils/colorScheme";

export default function WordCloudVis() {
  const { visDataWords, selectedTheme, unifiedSelection, handleUnifiedSelection } = usePhyloCtx();
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 });
  const containerRef = useRef();
  const wordsRef = useRef(); // Store word elements for updates without re-render

  const bgColor = useColorModeValue("gray.50", "gray.900");
  const textColor = useColorModeValue("gray.600", "gray.400");
  const bgGradient = useColorModeValue(
    "linear(to-br, white, gray.50)",
    "linear(to-br, gray.900, black)"
  );

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: width || 300,
          height: height || 300
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Draw word cloud
  useEffect(() => {
    if (!visDataWords || !svgRef.current || visDataWords.length === 0) return;

    const { width, height } = dimensions;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Sort words by frequency for better placement
    const sortedWords = [...visDataWords].sort((a, b) => b.qtd - a.qtd);

    // Calculate better size scaling
    const maxCount = Math.max(...sortedWords.map(d => d.qtd));
    const minCount = Math.min(...sortedWords.map(d => d.qtd));
    const sizeScale = d3.scaleSqrt()
      .domain([minCount, maxCount])
      .range([12, Math.min(80, width / 8)]); // Dynamic max size based on container

    // Create word cloud layout with improved settings
    const layout = cloud()
      .size([width, height])
      .words(sortedWords.map(d => ({
        text: d.word,
        size: sizeScale(d.qtd),
        qtd: d.qtd
      })))
      .padding(8) // More padding to prevent overlap
      .rotate(() => {
        // Mix of horizontal and slight angles for better readability
        const angles = [0, 0, 0, -15, 15]; // More horizontal words
        return angles[Math.floor(Math.random() * angles.length)];
      })
      .font("Inter, Segoe UI, system-ui, sans-serif") // Modern font stack
      .fontSize(d => d.size)
      .spiral("rectangular") // Better packing algorithm
      .on("end", draw);

    layout.start();

    function draw(words) {
      const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

      // Professional color palette with good contrast
      const colorPalette = [
        "#2563eb", // Blue
        "#7c3aed", // Purple
        "#dc2626", // Red
        "#ea580c", // Orange
        "#16a34a", // Green
        "#0891b2", // Cyan
        "#e11d48", // Rose
        "#9333ea", // Violet
      ];

      // Use a categorical scale for better distinction
      const colorScale = d3.scaleOrdinal()
        .domain(words.map(d => d.text))
        .range(colorPalette);

      // Opacity based on frequency for depth
      const opacityScale = d3.scaleLinear()
        .domain([d3.min(words, d => d.qtd), d3.max(words, d => d.qtd)])
        .range([0.6, 1]);

      const texts = g.selectAll("text")
        .data(words)
        .enter().append("text")
        .style("font-size", d => `${d.size}px`)
        .style("font-family", "Inter, Segoe UI, system-ui, sans-serif")
        .style("font-weight", d => {
          // Progressive font weights based on frequency
          if (d.qtd > maxCount * 0.7) return "700";
          if (d.qtd > maxCount * 0.4) return "600";
          if (d.qtd > maxCount * 0.2) return "500";
          return "400";
        })
        .style("fill", d => colorScale(d.text))
        .style("opacity", d => opacityScale(d.qtd))
        .style("cursor", "pointer")
        .attr("text-anchor", "middle")
        .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .attr("data-word", d => d.text) // Add data attribute for easy selection
        .text(d => d.text)
        .on("click", (event, d) => {
          event.stopPropagation();
          // Use unified selection handler
          if (unifiedSelection?.theme === d.text) {
            handleUnifiedSelection({ clear: true });
          } else {
            handleUnifiedSelection({
              theme: d.text,
              source: 'wordcloud'
            });
          }
        })
        .on("mouseover", function(event, d) {
          // Smooth transition on hover
          d3.select(this)
            .transition()
            .duration(200)
            .style("opacity", 1)
            .style("font-size", `${d.size * 1.15}px`)
            .style("filter", "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))");

          // Fade other words smoothly
          texts.filter(w => w !== d)
            .transition()
            .duration(200)
            .style("opacity", 0.2);

          // Show tooltip
          const tooltip = d3.select("body").append("div")
            .attr("class", "wordcloud-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.95)")
            .style("color", "white")
            .style("padding", "8px 12px")
            .style("border-radius", "6px")
            .style("font-size", "13px")
            .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)")
            .style("border", "1px solid rgba(255, 255, 255, 0.1)")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .html(`<strong>${d.text}</strong><br/>Count: ${d.qtd}`)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 10}px`);

          // Store tooltip reference
          d3.select(this).property("tooltip", tooltip);
        })
        .on("mouseout", function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .style("font-size", `${d.size}px`)
            .style("filter", "none")
            .style("opacity", d => opacityScale(d.qtd));

          // Reset opacity smoothly
          texts.transition()
            .duration(200)
            .style("opacity", d => opacityScale(d.qtd));

          // Remove tooltip
          const tooltip = d3.select(this).property("tooltip");
          if (tooltip) {
            tooltip.remove();
          }
        });

      // Store texts reference for later updates
      wordsRef.current = texts;

      // Add subtle animation on load
      texts
        .style("opacity", 0)
        .transition()
        .duration(800)
        .delay((d, i) => i * 20) // Stagger the appearance
        .style("opacity", d => opacityScale(d.qtd));
    }

    // Cleanup
    return () => {
      d3.select("body").selectAll(".wordcloud-tooltip").remove();
    };
  }, [visDataWords, dimensions]); // Removed selectedTheme to prevent re-render

  // Handle selection changes without re-rendering the entire cloud
  useEffect(() => {
    if (!wordsRef.current) return;

    const selectedThemeValue = unifiedSelection?.theme || selectedTheme;

    // Update only the visual styles of words based on selection
    wordsRef.current
      .transition()
      .duration(300)
      .style("fill", d => {
        if (selectedThemeValue && d.text === selectedThemeValue) {
          return "#dc2626"; // Red for selected
        }
        // Restore original color
        const colorPalette = [
          "#2563eb", "#7c3aed", "#dc2626", "#ea580c",
          "#16a34a", "#0891b2", "#e11d48", "#9333ea"
        ];
        const colorScale = d3.scaleOrdinal()
          .domain(wordsRef.current.data().map(w => w.text))
          .range(colorPalette);
        return colorScale(d.text);
      })
      .style("filter", d => {
        if (selectedThemeValue && d.text === selectedThemeValue) {
          return "drop-shadow(0 0 8px rgba(220, 38, 38, 0.5))";
        }
        return "none";
      })
      .style("font-weight", d => {
        if (selectedThemeValue && d.text === selectedThemeValue) {
          return "700";
        }
        // Restore original weight
        const maxCount = d3.max(wordsRef.current.data(), w => w.qtd);
        if (d.qtd > maxCount * 0.7) return "700";
        if (d.qtd > maxCount * 0.4) return "600";
        if (d.qtd > maxCount * 0.2) return "500";
        return "400";
      });
  }, [unifiedSelection, selectedTheme]);

  return (
    <Box
      ref={containerRef}
      w="full"
      h="full"
      bgGradient={bgGradient}
      position="relative"
      overflow="hidden"
      borderRadius="lg"
      boxShadow="inner"
    >
      {visDataWords && visDataWords.length > 0 ? (
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      ) : (
        <VStack
          w="full"
          h="full"
          justify="center"
          align="center"
          spacing={2}
        >
          <Text fontSize="sm" color={textColor}>
            No word data available
          </Text>
          <Text fontSize="xs" color="gray.500">
            Upload a dataset to see the word cloud
          </Text>
        </VStack>
      )}
    </Box>
  );
}
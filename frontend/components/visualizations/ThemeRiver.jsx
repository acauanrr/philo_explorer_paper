"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import {
  Box,
  HStack,
  VStack,
  Text,
  IconButton,
  Tooltip,
  Badge,
  useColorModeValue,
  ButtonGroup,
  Button,
} from "@chakra-ui/react";
import { FiZoomIn, FiZoomOut, FiMaximize2, FiFilter } from "react-icons/fi";
import { usePhyloCtx } from "../../contexts/PhyloContext";
import { parseNewick } from "../visualizations/PhyloExplorer/libs/parseNewick";

export default function ThemeRiver() {
  const {
    visDataPhylo,
    visDataWords,
    selectedNode,
    setSelectedNode,
    selectedTheme,
    setSelectedTheme,
    setVisDataTime,
    unifiedSelection,
    handleUnifiedSelection
  } = usePhyloCtx();
  const svgRef = useRef();
  const containerRef = useRef();
  const [hoveredTheme, setHoveredTheme] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 120 });
  const [streamMode, setStreamMode] = useState("expand"); // Default to normalized stack (expand)
  const zoomRef = useRef();
  const tooltipRef = useRef();

  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // Process data from word cloud or phylogenetic tree
  const processedData = useMemo(() => {
    // Prefer word cloud data if available
    if (visDataWords && visDataWords.length > 0) {
      // Use word cloud data to generate streamgraph
      const themes = visDataWords
        .filter(w => w && w.word && typeof w.word === 'string') // Filter out invalid entries
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 10) // Take top 10 words
        .map(w => w.word);

      const temporalData = generateTemporalDataFromWords(themes, visDataWords);

      if (setVisDataTime) {
        setVisDataTime(temporalData.data);
      }

      return temporalData;
    } else if (visDataPhylo) {
      // Fall back to phylogenetic data
      try {
        const tree = parseNewick(visDataPhylo);
        const hierarchy = d3.hierarchy(tree);
        const themes = extractThemesFromTree(hierarchy);
        const temporalData = generateTemporalData(themes);

        if (setVisDataTime) {
          setVisDataTime(temporalData.data);
        }

        return temporalData;
      } catch (error) {
        console.error("Error processing phylogenetic data:", error);
        return generateDemoData();
      }
    }

    return generateDemoData();
  }, [visDataPhylo, visDataWords, setVisDataTime]);

  // Extract themes (major clades) from phylogenetic tree
  function extractThemesFromTree(node, themes = new Map(), depth = 0) {
    if (!node) return themes;

    // Extract major groups based on node names
    if (node.name && depth < 3) { // Focus on higher-level taxonomy
      const themeName = node.name.split("_")[0]; // Get genus or higher level
      if (themeName && themeName !== "") {
        if (!themes.has(themeName)) {
          themes.set(themeName, {
            name: themeName,
            count: 0,
            totalDistance: 0,
            depths: []
          });
        }
        const theme = themes.get(themeName);
        theme.count++;
        theme.totalDistance += node.length || 0;
        theme.depths.push(depth);
      }
    }

    // Recursively process children
    if (node.children) {
      node.children.forEach(child => {
        extractThemesFromTree(child, themes, depth + 1);
      });
    }

    return themes;
  }

  // Generate temporal data from word cloud data
  function generateTemporalDataFromWords(themeList, wordData) {
    const timePoints = 40; // More time points for smoother curves
    const data = [];

    // Create a map for quick word data lookup
    const wordMap = new Map(wordData.map(w => [w.word, w.qtd]));

    for (let i = 0; i < timePoints; i++) {
      const timePoint = {
        time: i,
        date: new Date(2000 + Math.floor(i / 2), (i % 12), 1),
      };

      themeList.forEach((theme, idx) => {
        const baseValue = wordMap.get(theme) || 10;
        const normalizedValue = Math.sqrt(baseValue) * 5;

        // Create smooth temporal variations
        const amplitude = normalizedValue * 0.3;
        const phase = (Math.PI * 2 * idx) / themeList.length;
        const frequency = 0.1 + (idx * 0.02);

        // Base wave pattern
        let value = normalizedValue + amplitude * Math.sin(frequency * i + phase);

        // Add secondary wave for complexity
        value += amplitude * 0.5 * Math.cos(frequency * 2 * i + phase * 1.5);

        // Add growth/decline trends
        const trendFactor = 1 + (i / timePoints) * 0.2 * Math.sin(phase);
        value *= trendFactor;

        // Ensure positive values with minimum threshold
        timePoint[theme] = Math.max(1, value);
      });

      data.push(timePoint);
    }

    return { data, themes: themeList };
  }

  // Generate temporal data from themes
  function generateTemporalData(themes) {
    const themeList = Array.from(themes.values())
      .filter(t => t.count > 1) // Only include themes with multiple occurrences
      .slice(0, 8) // Limit to 8 major themes for visibility
      .map(t => t.name);

    if (themeList.length === 0) {
      return generateDemoData();
    }

    const timePoints = 30; // Number of time points
    const data = [];

    // Generate smooth temporal patterns
    for (let i = 0; i < timePoints; i++) {
      const timePoint = {
        time: i,
        date: new Date(2000 + i, 0, 1),
      };

      themeList.forEach((theme, idx) => {
        const themeData = themes.get(theme);
        const baseValue = 5 + (themeData.count * 2);
        const amplitude = Math.sqrt(themeData.totalDistance) * 3;
        const phase = (Math.PI * 2 * idx) / themeList.length;
        const frequency = 0.15 + (idx * 0.05);

        // Create evolutionary pattern
        let value = baseValue + amplitude * Math.sin(frequency * i + phase);

        // Add evolutionary events (expansions/contractions)
        if (i > 10 && i < 15 && idx % 2 === 0) {
          value *= 1.5; // Expansion event
        }
        if (i > 20 && i < 25 && idx % 3 === 0) {
          value *= 0.7; // Contraction event
        }

        // Add some noise for realism
        value += (Math.random() - 0.5) * 2;

        timePoint[theme] = Math.max(0.5, value);
      });

      data.push(timePoint);
    }

    return { data, themes: themeList };
  }

  // Generate demo data when no phylogenetic data is available
  function generateDemoData() {
    const themes = [
      "Bacteria",
      "Archaea",
      "Eukaryota",
      "Proteobacteria",
      "Firmicutes",
      "Actinobacteria",
      "Cyanobacteria",
      "Bacteroidetes"
    ];

    const timePoints = 30;
    const data = [];

    for (let i = 0; i < timePoints; i++) {
      const timePoint = {
        time: i,
        date: new Date(2000 + i, 0, 1),
      };

      themes.forEach((theme, idx) => {
        const baseValue = 10 + Math.random() * 10;
        const amplitude = 5 + Math.random() * 10;
        const phase = (Math.PI * 2 * idx) / themes.length;
        const frequency = 0.1 + Math.random() * 0.2;

        let value = baseValue + amplitude * Math.sin(frequency * i + phase);

        // Add evolutionary events
        if (i === 10 + idx) value *= 1.8; // Radiation event
        if (i === 20 - idx) value *= 0.6; // Extinction event

        value += (Math.random() - 0.5) * 3;
        timePoint[theme] = Math.max(0.5, value);
      });

      data.push(timePoint);
    }

    return { data, themes };
  }

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: width || 800,
          height: (height || 250) - 40 // Account for controls and padding
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Draw ThemeRiver visualization
  useEffect(() => {
    if (!svgRef.current || !processedData.data.length) return;

    const { data, themes } = processedData;
    const margin = { top: 5, right: 60, bottom: 20, left: 30 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    // Create patterns for selected streams
    const defs = svg.append("defs");
    themes.forEach((theme, i) => {
      // Ensure theme is a valid string
      const safeTheme = theme && typeof theme === 'string' ? theme : `theme-${i}`;

      const pattern = defs.append("pattern")
        .attr("id", `pattern-${safeTheme.replace(/\s/g, "-")}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 4)
        .attr("height", 4);

      pattern.append("rect")
        .attr("width", 4)
        .attr("height", 4)
        .attr("fill", d3.schemeTableau10[i % 10]);

      pattern.append("path")
        .attr("d", "M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2")
        .attr("stroke", "white")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.3);
    });

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .extent([[0, 0], [width, height]])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        // Update axis
        gAxis.call(xAxis.scale(event.transform.rescaleX(xScale)));
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.time))
      .range([0, width]);

    // Choose stack offset based on mode
    const offsetMethod = streamMode === "wiggle" ? d3.stackOffsetWiggle :
                        streamMode === "expand" ? d3.stackOffsetExpand :
                        d3.stackOffsetSilhouette;

    // Stack the data
    const stack = d3.stack()
      .keys(themes)
      .offset(offsetMethod)
      .order(d3.stackOrderInsideOut);

    const stackedData = stack(data);

    // Calculate y domain after stacking
    const yMin = d3.min(stackedData, layer => d3.min(layer, d => d[0]));
    const yMax = d3.max(stackedData, layer => d3.max(layer, d => d[1]));

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height, 0]);

    // Color scale
    const colorScale = d3.scaleOrdinal()
      .domain(themes)
      .range(d3.schemeTableau10);

    // Create area generator with smooth curves
    const area = d3.area()
      .x(d => xScale(d.data.time))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveBasis);

    // Create tooltip
    if (!tooltipRef.current) {
      tooltipRef.current = d3.select("body").append("div")
        .attr("class", "themeriver-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0, 0, 0, 0.9)")
        .style("color", "white")
        .style("padding", "10px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "10000")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)");
    }
    const tooltip = tooltipRef.current;

    // Draw the streams
    const streams = g.selectAll(".stream")
      .data(stackedData)
      .enter().append("g")
      .attr("class", "stream");

    streams.append("path")
      .attr("d", area)
      .attr("fill", d => {
        const selectedThemeValue = unifiedSelection?.theme || selectedTheme;
        if (d.key === selectedThemeValue) {
          const safeKey = d.key && typeof d.key === 'string' ? d.key : 'default';
          return `url(#pattern-${safeKey.replace(/\s/g, "-")})`;
        }
        return colorScale(d.key);
      })
      .attr("opacity", d => {
        const selectedThemeValue = unifiedSelection?.theme || selectedTheme;
        if (selectedThemeValue && d.key !== selectedThemeValue) return 0.3;
        return 0.85;
      })
      .attr("stroke", d => {
        const selectedThemeValue = unifiedSelection?.theme || selectedTheme;
        return d.key === selectedThemeValue ? textColor : "white";
      })
      .attr("stroke-width", d => {
        const selectedThemeValue = unifiedSelection?.theme || selectedTheme;
        return d.key === selectedThemeValue ? 1.5 : 0.5;
      })
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        if (!selectedTheme) {
          d3.select(this).attr("opacity", 1);
          streams.selectAll("path")
            .filter(s => s.key !== d.key)
            .attr("opacity", 0.4);
        }

        setHoveredTheme(d.key);

        // Calculate statistics
        const values = d.map(s => s[1] - s[0]);
        const avgValue = d3.mean(values);
        const maxValue = d3.max(values);
        const trend = values[values.length - 1] > values[0] ? "↑" : "↓";

        tooltip
          .style("visibility", "visible")
          .html(`
            <strong style="font-size: 14px">${d.key}</strong><br/>
            <div style="margin-top: 5px">
              <span style="color: #aaa">Average:</span> ${avgValue.toFixed(2)}<br/>
              <span style="color: #aaa">Maximum:</span> ${maxValue.toFixed(2)}<br/>
              <span style="color: #aaa">Trend:</span> ${trend}
            </div>
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", function(event, d) {
        if (!selectedTheme) {
          streams.selectAll("path")
            .attr("opacity", 0.85);
        }
        setHoveredTheme(null);
        tooltip.style("visibility", "hidden");
      })
      .on("click", function(event, d) {
        // Use unified selection handler
        if (unifiedSelection?.theme === d.key) {
          handleUnifiedSelection({ clear: true });
        } else {
          handleUnifiedSelection({
            theme: d.key,
            source: 'timeline'
          });
        }
      });

    // Add stream labels
    const labels = g.selectAll(".stream-label")
      .data(stackedData)
      .enter().append("text")
      .attr("class", "stream-label")
      .attr("x", width + 5)
      .attr("y", d => {
        const lastPoint = d[d.length - 1];
        return yScale((lastPoint[0] + lastPoint[1]) / 2);
      })
      .attr("alignment-baseline", "middle")
      .attr("font-size", "11px")
      .attr("fill", d => d.key === selectedTheme ? colorScale(d.key) : textColor)
      .attr("font-weight", d => d.key === selectedTheme ? "bold" : "normal")
      .style("cursor", "pointer")
      .text(d => d.key)
      .on("click", function(event, d) {
        // Use unified selection handler for legend
        if (unifiedSelection?.theme === d.key) {
          handleUnifiedSelection({ clear: true });
        } else {
          handleUnifiedSelection({
            theme: d.key,
            source: 'timeline'
          });
        }
      });

    // Add x-axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(15)
      .tickFormat(d => `T${d}`);

    const gAxis = g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);

    gAxis.append("text")
      .attr("x", width / 2)
      .attr("y", 28)
      .attr("fill", textColor)
      .style("text-anchor", "middle")
      .style("font-size", "11px")
      .text("Evolutionary Time →");

    // Add vertical time marker on hover
    const timeMarker = g.append("line")
      .attr("class", "time-marker")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", textColor)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0);

    // Add interaction overlay
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mousemove", function(event) {
        const [x] = d3.pointer(event);
        if (x >= 0 && x <= width) {
          timeMarker
            .attr("x1", x)
            .attr("x2", x)
            .attr("opacity", 0.3);
        }
      })
      .on("mouseout", function() {
        timeMarker.attr("opacity", 0);
      });

    // Cleanup function
    return () => {
      // Keep tooltip for reuse
    };
  }, [processedData, dimensions, selectedTheme, streamMode, textColor]);

  // Sync with unified selection from other views
  useEffect(() => {
    if (!svgRef.current) return;

    const selectedThemeValue = unifiedSelection?.theme || selectedTheme;

    // Update visual highlighting
    d3.select(svgRef.current)
      .selectAll(".stream path")
      .attr("fill", function(d) {
        if (selectedThemeValue && d.key === selectedThemeValue) {
          const safeKey = d.key && typeof d.key === 'string' ? d.key : 'default';
          return `url(#pattern-${safeKey.replace(/\s/g, "-")})`;
        }
        const colorScale = d3.scaleOrdinal()
          .domain(processedData?.keys || [])
          .range(d3.schemeTableau10);
        return colorScale(d.key);
      })
      .attr("opacity", function(d) {
        if (selectedThemeValue && d.key !== selectedThemeValue) return 0.3;
        return 0.85;
      })
      .attr("stroke", function(d) {
        return d.key === selectedThemeValue ? textColor : "white";
      })
      .attr("stroke-width", function(d) {
        return d.key === selectedThemeValue ? 1.5 : 0.5;
      });

    // Update legend highlighting
    d3.select(svgRef.current)
      .selectAll(".legend text")
      .attr("font-weight", function(d) {
        return d.key === selectedThemeValue ? "bold" : "normal";
      })
      .attr("fill", function(d) {
        return d.key === selectedThemeValue ? "#dc2626" : textColor;
      });
  }, [unifiedSelection, selectedTheme, processedData, textColor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 0.67);
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

  return (
    <Box
      ref={containerRef}
      w="full"
      h="full"
      position="relative"
      bg={bgColor}
      borderTop="1px"
      borderColor={borderColor}
      overflow="hidden"
    >
      {/* Controls */}
      <HStack
        position="absolute"
        top={2}
        right={2}
        zIndex={10}
        spacing={2}
      >

      </HStack>

      {/* Status Display */}
      <VStack
        position="absolute"
        top={2}
        left={2}
        align="start"
        spacing={1}
      >
        {hoveredTheme && (
          <Badge colorScheme="blue" fontSize="xs">
            {hoveredTheme}
          </Badge>
        )}
        {selectedTheme && (
          <Badge colorScheme="green" fontSize="xs">
            Selected: {selectedTheme}
          </Badge>
        )}
      </VStack>

      {/* SVG Container */}
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
    </Box>
  );
}
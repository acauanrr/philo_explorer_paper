"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Spinner,
  useColorModeValue,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Select,
  Switch,
  Divider,
  Button
} from "@chakra-ui/react";
import { usePhylo } from "../../context/PhyloContext";
import {
  prepareProjectionQualityBundle,
  computeNeighborhoodPreservationValues
} from "../../utils/projectionMetrics";
import { renderEnhancedPhyloTree } from "../../utils/enhancedPhyloTree";
import WordCloud from "./WordCloud";
import ThemeRiver from "./ThemeRiver";

const normalizeLabel = (v) => (v ?? "").toString().trim();

const STOP_WORDS = new Set([
  "the","and","for","with","that","from","this","have","has","will","into","about","over","were","their","them","they","been","after","more","than","when","which","also","such","these","those","under","between","across","where","there","using","within","while","without","against","among","through","toward","could","would","should","might","because","before","during","other","first","second","third","year","years","month","months","week","weeks","today","tomorrow","yesterday","new","news","report","study","studies","analysis","project","projects","plan","plans","update","updates","global","climate","change","changes","energy","emissions"
]);

const buildThemeRiverSeries = (articles, categoryLimit = 5) => {
  if (!articles || !articles.length) {
    return { data: [], categories: [] };
  }

  const parseDate = (input) => {
    if (!input) return null;
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const bucketMap = new Map();
  const totals = new Map();

  articles.forEach((article) => {
    const date = parseDate(article.published_at || article.date);
    if (!date) return;
    const bucket = new Date(date.getFullYear(), date.getMonth(), 1);
    const key = bucket.toISOString();
    const category = (article.category || article.topic || "Uncategorized").trim() || "Uncategorized";

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { date: bucket, counts: new Map() });
    }
    const bucketEntry = bucketMap.get(key);
    bucketEntry.counts.set(category, (bucketEntry.counts.get(category) || 0) + 1);

    totals.set(category, (totals.get(category) || 0) + 1);
  });

  if (!bucketMap.size) {
    return { data: [], categories: [] };
  }

  const topCategories = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, categoryLimit))
    .map(([category]) => category);

  const sortedBuckets = Array.from(bucketMap.values())
    .sort((a, b) => a.date - b.date);

  const data = sortedBuckets.map((bucket) => {
    const row = { date: bucket.date };
    topCategories.forEach((category) => {
      row[category] = bucket.counts.get(category) || 0;
    });
    return row;
  });

  return { data, categories: topCategories };
};


const NeighborhoodPreservationTreeView = () => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const {
    currentDataset,
    comparisonDataset,
    projectionQuality,
    setProjectionQuality
  } = usePhylo();

  const [viewDataset, setViewDataset] = useState("t1");
  const [k, setK] = useState(30);
  const [metric, setMetric] = useState("sdk"); // sdk | jdk | cpk-low | cpk-high
  const [showLabels, setShowLabels] = useState(false);
  const [showBranchLength, setShowBranchLength] = useState(true);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);
  const [hoveredNodeInfo, setHoveredNodeInfo] = useState(null);
  const [colorScheme, setColorScheme] = useState("turbo");
  const [nodeSize, setNodeSize] = useState(5);
  // Removed unused state variables for now
  const [showWordCloud, setShowWordCloud] = useState(true);
  const [wordCloudMaxWords, setWordCloudMaxWords] = useState(30);
  const [showThemeRiver, setShowThemeRiver] = useState(true);
  const [streamCategoryLimit, setStreamCategoryLimit] = useState(5);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [metricsData, setMetricsData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const metricValues = useMemo(() => {
    if (!metricsData) return [];
    if (metric === "jdk") return metricsData.jdk ?? [];
    if (metric === "sdk") return metricsData.sdk ?? [];
    if (metric === "cpk-high") return metricsData.cpkHigh ?? [];
    return metricsData.cpkLow ?? [];
  }, [metricsData, metric]);

  const labelToIndex = useMemo(() => {
    if (!metricsData?.labels) return new Map();
    const map = new Map();
    metricsData.labels.forEach((label, idx) => {
      map.set(normalizeLabel(label), idx);
    });
    return map;
  }, [metricsData]);

  const articleLookup = useMemo(() => {
    if (!metricsData?.labels) return new Map();
    const map = new Map();
    const articles = metricsData.articles ?? [];
    metricsData.labels.forEach((label, idx) => {
      const normalized = normalizeLabel(label);
      const article = articles[idx];
      if (article && !map.has(normalized)) {
        map.set(normalized, article);
      }
    });
    return map;
  }, [metricsData]);

  useEffect(() => {
    const totalLeaves = metricsData?.labels?.length ?? null;
    if (!totalLeaves) return;
    const maxValid = Math.max(3, Math.min(100, totalLeaves - 1));
    if (k >= maxValid) {
      setK(maxValid);
    }
  }, [metricsData, k]);

  const rootHierarchy = useMemo(() => {
    if (!metricsData?.root) return null;
    try {
      return d3.hierarchy(metricsData.root);
    } catch (error) {
      console.error("Failed to create hierarchy for metrics root", error);
      return null;
    }
  }, [metricsData]);

  const createNodeInfo = useCallback((node, datasetKey) => {
    if (!node) return null;
    const leafNodes = (!node.children || node.children.length === 0)
      ? [node]
      : node.leaves();

    const leafLabels = [];
    const articles = [];
    leafNodes.forEach((leaf) => {
      const label = normalizeLabel(leaf.data?.name ?? leaf.data?.id ?? "");
      if (label) {
        leafLabels.push(label);
      }
      const article = leaf.data?.article ?? articleLookup.get(label) ?? null;
      if (article) {
        articles.push(article);
      }
    });

    const metricValuesForLeaf = leafLabels
      .map((label) => {
        const idx = labelToIndex.get(label);
        return idx !== undefined ? metricValues[idx] : null;
      })
      .filter((value) => value !== null && Number.isFinite(value));

    const meanMetric = metricValuesForLeaf.length ? d3.mean(metricValuesForLeaf) : null;
    const maxMetric = metricValuesForLeaf.length ? d3.max(metricValuesForLeaf) : null;
    const minMetric = metricValuesForLeaf.length ? d3.min(metricValuesForLeaf) : null;

    return {
      datasetKey,
      nodeLabel: node.data?.displayName ?? node.data?.name ?? node.data?.id ?? `Cluster (${leafLabels.length})`,
      leafLabels: new Set(leafLabels),
      articles,
      metrics: {
        mean: meanMetric,
        max: maxMetric,
        min: minMetric,
        count: leafLabels.length
      }
    };
  }, [labelToIndex, metricValues, articleLookup]);

  const defaultNodeInfo = useMemo(() => {
    if (!rootHierarchy) return null;
    return createNodeInfo(rootHierarchy, viewDataset);
  }, [rootHierarchy, createNodeInfo, viewDataset]);

  // Use only selectedNodeInfo for Word Cloud and Theme River (click-based)
  const stableHighlightTarget = useMemo(() => {
    if (selectedNodeInfo && selectedNodeInfo.datasetKey === viewDataset) {
      return selectedNodeInfo;
    }
    return defaultNodeInfo;
  }, [selectedNodeInfo, defaultNodeInfo, viewDataset]);

  // Use hoveredNodeInfo for tree highlighting but not for complementary views
  const treeHighlightTarget = useMemo(() => {
    if (hoveredNodeInfo && hoveredNodeInfo.datasetKey === viewDataset) {
      return hoveredNodeInfo;
    }
    return stableHighlightTarget;
  }, [hoveredNodeInfo, stableHighlightTarget, viewDataset]);

  // Use stable target for Word Cloud and Theme River
  const activeArticles = stableHighlightTarget?.articles ?? [];
  const highlightStats = treeHighlightTarget?.metrics ?? null;

  const meanMetricAll = useMemo(() => {
    return metricValues.length ? d3.mean(metricValues) : null;
  }, [metricValues]);

  const wordCloudWords = useMemo(() => {
    if (!showWordCloud || !activeArticles.length) return [];
    const frequency = new Map();

    activeArticles.forEach((article) => {
      const segments = [
        article.title,
        article.summary,
        article.short_description,
        article.description,
        article.abstract,
        article.subtitle,
        article.content,
        article.body,
        ...(Array.isArray(article.keywords) ? article.keywords : []),
        ...(Array.isArray(article.tags) ? article.tags : []),
        ...(Array.isArray(article.topics) ? article.topics : [])
      ];
      segments.forEach((segment) => {
        if (!segment) return;
        const normalizedSegment = Array.isArray(segment) ? segment.join(" ") : segment;
        normalizedSegment.toString()
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .forEach((token) => {
            if (!token || token.length < 3) return;
            if (STOP_WORDS.has(token)) return;
            frequency.set(token, (frequency.get(token) || 0) + 1);
          });
      });
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, wordCloudMaxWords))
      .map(([text, value]) => ({ text, value }));
  }, [activeArticles, showWordCloud, wordCloudMaxWords]);

  const themeRiverData = useMemo(() => {
    if (!showThemeRiver) {
      return { data: [], categories: [] };
    }
    return buildThemeRiverSeries(activeArticles, streamCategoryLimit);
  }, [activeArticles, showThemeRiver, streamCategoryLimit]);

  const wordCloudDimensions = useMemo(() => {
    if (!showWordCloud) {
      return { width: 0, height: 0 };
    }
    const targetWidth = Math.max(320, Math.min(420, Math.floor((dimensions.width || 960) * 0.35)));
    const targetHeight = Math.max(260, Math.min(360, Math.floor((dimensions.height || 720) * 0.45)));
    return { width: targetWidth, height: targetHeight };
  }, [showWordCloud, dimensions]);

  const wordCloudPanelWidth = showWordCloud ? Math.max(360, wordCloudDimensions.width + 60) : 0;

  const totalLeaves = metricsData?.labels?.length ?? 0;
  const maxKValue = Math.max(3, Math.min(100, totalLeaves > 1 ? totalLeaves - 1 : 3));
  const clusterLabel = treeHighlightTarget?.nodeLabel ?? "All Nodes";
  const wordCloudAvailable = wordCloudWords.length > 0;
  const themeRiverAvailable = themeRiverData.data.length > 0 && themeRiverData.categories.length > 0;

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

  useEffect(() => {
    setSelectedNodeInfo(null);
    setHoveredNodeInfo(null);
  }, [viewDataset, currentDataset, comparisonDataset]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeInfo(null);
    setHoveredNodeInfo(null);
  }, []);

  const ensureProjectionQuality = useCallback(async (key, dataset) => {
    if (projectionQuality?.[key]?.lowDistances && projectionQuality?.[key]?.root) {
      return projectionQuality[key];
    }
    return prepareProjectionQualityBundle(dataset);
  }, [projectionQuality]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentDataset) {
        setMetricsData(null);
        setLoadError("Please run the dataset analysis before exploring neighborhood preservation.");
        return;
      }
      const key = viewDataset === "t2" ? "t2" : "t1";
      const dataset = key === "t2" ? comparisonDataset : currentDataset;
      if (!dataset) {
        setMetricsData(null);
        setLoadError("Comparison dataset is not available for the selected view.");
        return;
      }
      try {
        const pq = await ensureProjectionQuality(key, dataset);
        if (cancelled || !pq) return;

        setProjectionQuality((prev) => {
          const previous = prev ?? {};
          const existing = previous[key] ?? {};
          const needsLow = !existing.lowDistances;
          const needsHigh = !existing.highDistances;
          const needsRoot = !existing.root;
          const needsArticles = !existing.articles || existing.articles.length === 0;
          if (!needsLow && !needsHigh && !needsRoot && !needsArticles) {
            return previous;
          }
          const merged = {
            ...existing,
            ...pq,
            articles: pq.articles && pq.articles.length ? pq.articles : existing.articles ?? []
          };
          return { ...previous, [key]: merged };
        });

        const { jdk, sdk, cpkLow, cpkHigh } = computeNeighborhoodPreservationValues(
          pq.lowDistances,
          pq.highDistances,
          k
        );

        setMetricsData({
          labels: pq.labels,
          root: pq.root,
          jdk,
          sdk,
          cpkLow,
          cpkHigh,
          articles: pq.articles ?? dataset ?? []
        });
        setLoadError(null);
      } catch (error) {
        console.error('Failed to load neighborhood preservation data', error);
        if (!cancelled) {
          setMetricsData(null);
          setLoadError(error?.message || 'Failed to load neighborhood preservation data');
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentDataset, comparisonDataset, viewDataset, k, ensureProjectionQuality, setProjectionQuality]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    if (!metricsData?.root) {
      svg.selectAll("*").remove();
      return;
    }

    const width = Math.max(360, dimensions.width || 0);
    const height = Math.max(360, dimensions.height || 0);

    const values = metricValues;
    const validValues = values.filter(v => Number.isFinite(v));
    let maxV = validValues.length ? Math.max(...validValues) : 1;
    let minV = validValues.length ? Math.min(...validValues) : 0;

    // Handle case when all values are the same (no variation)
    // Expand the domain to show colors better
    if (Math.abs(maxV - minV) < 0.001) {
      // If all values are the same, create an artificial range
      const midValue = minV;
      if (midValue <= 0.5) {
        // If values are low (good preservation), show range from value to worse
        minV = Math.max(0, midValue - 0.1);
        maxV = Math.min(1, midValue + 0.3);
      } else {
        // If values are high (poor preservation), show range from better to value
        minV = Math.max(0, midValue - 0.3);
        maxV = Math.min(1, midValue + 0.1);
      }
    }

    // Import color schemes for legend
    const colorSchemes = {
      viridis: d3.interpolateViridis,
      plasma: d3.interpolatePlasma,
      turbo: d3.interpolateTurbo,
      rainbow: d3.interpolateRainbow,
      spectral: d3.interpolateSpectral,
      coolwarm: d3.interpolateRdBu,
      rdylgn: d3.interpolateRdYlGn,
      inferno: d3.interpolateInferno,
      magma: d3.interpolateMagma,
      cividis: d3.interpolateCividis
    };

    const selectedInterpolator = colorSchemes[colorScheme] || d3.interpolateTurbo;
    const colorScale = d3.scaleSequential(selectedInterpolator).domain([minV, maxV]);

    const datasetKey = viewDataset;
    const highlightLeafSet = treeHighlightTarget?.leafLabels ?? null;

    const handleSelectNode = (node) => {
      const info = createNodeInfo(node, datasetKey);
      if (info) {
        setSelectedNodeInfo(info);
      }
    };

    renderEnhancedPhyloTree({
      svg,
      rootData: metricsData.root,
      width,
      height,
      metricValues: values,
      labels: metricsData.labels ?? [],
      labelToIndex,
      colorScale: null, // Don't pass colorScale, let the function create its own with correct domain
      showLabels,
      showDistances: showBranchLength,
      highlightLeafSet,
      animateTransitions: true,
      colorScheme,  // Use the color scheme selected by user
      nodeSize,
      linkWidth: 1.8,
      onSelectNode: handleSelectNode
    });

    // Add enhanced color scale legend
    const defs = svg.append("defs");
    const gradId = `legend-grad-${metric}`;
    const grad = defs.append("linearGradient").attr("id", gradId);

    // Create gradient with more steps for smoother visualization
    for (let t = 0; t <= 1.00001; t += 0.1) {
      grad.append("stop")
        .attr("offset", `${Math.round(t * 100)}%`)
        .attr("stop-color", colorScale(minV + t * (maxV - minV)));
    }

    const legendX = -(width / 2) + 20;
    const legendY = (height / 2) - 85;

    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`);

    // Background with drop shadow
    legend.append("rect")
      .attr("width", 240)
      .attr("height", 70)
      .attr("rx", 12)
      .attr("fill", "rgba(255,255,255,0.95)")
      .attr("stroke", "rgba(148,163,184,0.4)")
      .attr("stroke-width", 1)
      .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))");

    // Metric name with better styling
    legend.append("text")
      .attr("x", 120)
      .attr("y", 22)
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .attr("text-anchor", "middle")
      .attr("fill", "#1e293b")
      .text(metric === "sdk" ? "SDk - Sequence Difference" :
            metric === "jdk" ? "JDk - Jaccard Distance" :
            metric === "cpk-low" ? "CPk - Tree Centrality" :
            "CPk - High-D Centrality");

    // Gradient bar
    legend.append("rect")
      .attr("x", 20)
      .attr("y", 32)
      .attr("width", 200)
      .attr("height", 14)
      .attr("rx", 3)
      .attr("fill", `url(#${gradId})`)
      .attr("stroke", "rgba(0,0,0,0.2)")
      .attr("stroke-width", 0.5);

    // Value labels with percentage
    legend.append("text")
      .attr("x", 20)
      .attr("y", 58)
      .attr("font-size", 11)
      .attr("font-weight", 500)
      .attr("fill", "#475569")
      .text(`${(minV * 100).toFixed(1)}%`);

    legend.append("text")
      .attr("x", 220)
      .attr("y", 58)
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("font-weight", 500)
      .attr("fill", "#475569")
      .text(`${(maxV * 100).toFixed(1)}%`);

    // Add middle value for reference
    const midV = (minV + maxV) / 2;
    legend.append("text")
      .attr("x", 120)
      .attr("y", 58)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", "#94a3b8")
      .text(`${(midV * 100).toFixed(1)}%`);
  }, [
    metricsData,
    metric,
    metricValues,
    showLabels,
    showBranchLength,
    dimensions,
    viewDataset,
    treeHighlightTarget,
    stableHighlightTarget,
    colorScheme,
    nodeSize,
    labelToIndex,
    createNodeInfo
  ]);

  if (!currentDataset) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          Please load a dataset to analyze neighborhood preservation.
        </Alert>
      </Box>
    );
  }

  const ready = Boolean(metricsData?.root);
  const labelK = `${k}`;

  return (
    <Box h="full" display="flex">
      {/* Sidebar */}
      <Box w="380px" p={4} bg="gray.50" borderRight="1px" borderColor="gray.200" overflowY="auto">
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Neighborhood Preservation</Text>
          <Text fontSize="sm" color="gray.600">
            Analyze JDk (Jaccard) and SDk (Sequence) neighborhood preservation metrics on the NJ tree.
          </Text>
          <Divider />

          <Card>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Dataset</FormLabel>
                  <Select value={viewDataset} onChange={(e) => setViewDataset(e.target.value)} size="sm">
                    <option value="t1">T1</option>
                    {comparisonDataset && <option value="t2">T2</option>}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">Metric</FormLabel>
                  <Select value={metric} onChange={(e) => setMetric(e.target.value)} size="sm">
                    <option value="sdk">SDk (Sequence Difference)</option>
                    <option value="jdk">JDk (Jaccard Distance)</option>
                    <option value="cpk-low">CPk (Centrality, Tree)</option>
                    <option value="cpk-high">CPk (Centrality, High-D)</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">k (Neighbors)</FormLabel>
                  <Slider min={3} max={maxKValue} value={k} onChange={setK} step={1}>
                    <SliderTrack><SliderFilledTrack /></SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <HStack justify="space-between">
                    <Text fontSize="xs">3</Text>
                    <Badge>{labelK}</Badge>
                    <Text fontSize="xs">{maxKValue}</Text>
                  </HStack>
                </FormControl>

                <HStack justify="space-between">
                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0" fontSize="sm">Show Labels</FormLabel>
                    <Switch isChecked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                  </FormControl>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0" fontSize="sm">Branch Lengths</FormLabel>
                    <Switch isChecked={showBranchLength} onChange={(e) => setShowBranchLength(e.target.checked)} />
                  </FormControl>
                </HStack>

                <FormControl>
                  <FormLabel fontSize="sm">Color Scheme</FormLabel>
                  <Select value={colorScheme} onChange={(e) => setColorScheme(e.target.value)} size="sm">
                    <option value="turbo">Turbo</option>
                    <option value="viridis">Viridis</option>
                    <option value="plasma">Plasma</option>
                    <option value="inferno">Inferno</option>
                    <option value="magma">Magma</option>
                    <option value="cividis">Cividis</option>
                    <option value="rainbow">Rainbow</option>
                    <option value="spectral">Spectral</option>
                    <option value="coolwarm">Cool-Warm</option>
                    <option value="rdylgn">Red-Yellow-Green</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">Node Size</FormLabel>
                  <Slider min={3} max={8} step={0.5} value={nodeSize} onChange={setNodeSize}>
                    <SliderTrack><SliderFilledTrack /></SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <HStack justify="space-between">
                    <Text fontSize="xs">3</Text>
                    <Badge>{nodeSize}</Badge>
                    <Text fontSize="xs">8</Text>
                  </HStack>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {ready && (
            <Card>
              <CardHeader pb={2}><Text fontWeight="bold" fontSize="sm">Cluster Focus</Text></CardHeader>
              <CardBody>
                <VStack spacing={3} align="stretch">
                  <Text fontSize="sm" fontWeight="semibold">{clusterLabel}</Text>
                  {selectedNodeInfo && (
                    <Text fontSize="xs" color="gray.600" mt={1}>
                      Click nodes to update Word Cloud & Theme River
                    </Text>
                  )}
                  <Stat size="sm">
                    <StatLabel>Selection Size</StatLabel>
                    <StatNumber>{highlightStats?.count ?? totalLeaves}</StatNumber>
                    <StatHelpText>Leaves in focus</StatHelpText>
                  </Stat>
                  <Stat size="sm">
                    <StatLabel>{metric.toUpperCase()} Mean</StatLabel>
                    <StatNumber>
                      {highlightStats?.mean !== null && highlightStats?.mean !== undefined
                        ? `${(highlightStats.mean * 100).toFixed(1)}%`
                        : meanMetricAll !== null && meanMetricAll !== undefined
                          ? `${(meanMetricAll * 100).toFixed(1)}%`
                          : "--"}
                    </StatNumber>
                    <StatHelpText>{highlightStats ? "Focused subset" : "Dataset average"}</StatHelpText>
                  </Stat>
                  {highlightStats && highlightStats.min !== null && highlightStats.max !== null && (
                    <HStack spacing={3} fontSize="xs" color="gray.600">
                      <Text>min {(highlightStats.min * 100).toFixed(1)}%</Text>
                      <Text>max {(highlightStats.max * 100).toFixed(1)}%</Text>
                    </HStack>
                  )}
                  {selectedNodeInfo && (
                    <Button
                      size="sm"
                      colorScheme="gray"
                      variant="outline"
                      onClick={handleClearSelection}
                      width="full"
                    >
                      Clear Selection
                    </Button>
                  )}
                </VStack>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader pb={2}><Text fontWeight="bold" fontSize="sm">Complementary Views</Text></CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" fontSize="sm">Word Cloud</FormLabel>
                  <Switch isChecked={showWordCloud} onChange={(e) => setShowWordCloud(e.target.checked)} />
                </FormControl>
                {showWordCloud && (
                  <FormControl>
                    <FormLabel fontSize="sm">Max Terms</FormLabel>
                    <Slider min={10} max={80} step={5} value={wordCloudMaxWords} onChange={setWordCloudMaxWords}>
                      <SliderTrack><SliderFilledTrack /></SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <HStack justify="space-between">
                      <Text fontSize="xs">10</Text>
                      <Badge>{wordCloudMaxWords}</Badge>
                      <Text fontSize="xs">80</Text>
                    </HStack>
                  </FormControl>
                )}
                <Divider />
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" fontSize="sm">Theme River</FormLabel>
                  <Switch isChecked={showThemeRiver} onChange={(e) => setShowThemeRiver(e.target.checked)} />
                </FormControl>
                {showThemeRiver && (
                  <FormControl>
                    <FormLabel fontSize="sm">Top Categories</FormLabel>
                    <Slider min={3} max={10} step={1} value={streamCategoryLimit} onChange={setStreamCategoryLimit}>
                      <SliderTrack><SliderFilledTrack /></SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <HStack justify="space-between">
                      <Text fontSize="xs">3</Text>
                      <Badge>{streamCategoryLimit}</Badge>
                      <Text fontSize="xs">10</Text>
                    </HStack>
                  </FormControl>
                )}
              </VStack>
            </CardBody>
          </Card>

        </VStack>
      </Box>

      {/* Main content with tree, word cloud, and theme river */}
      <Box flex={1} display="flex" flexDirection="column" bg={bgColor}>
        <Box flex={1} display="flex" minH={0}>
          <Box ref={containerRef} flex={1} position="relative">
            {!ready && loadError && (
              <Box position="absolute" top="16px" left="50%" transform="translateX(-50%)" maxW="420px" zIndex={2}>
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  <Text fontSize="sm">{loadError}</Text>
                </Alert>
              </Box>
            )}
            {ready ? (
              <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)">
                <VStack spacing={4}>
                  <Spinner size="lg" color="blue.500" />
                  <Text fontSize="sm" color="gray.600">
                    {loadError || "Computing neighborhood preservation metrics..."}
                  </Text>
                </VStack>
              </Box>
            )}
          </Box>
          {showWordCloud && (
            <Box w={`${wordCloudPanelWidth}px`} borderLeft="1px" borderColor="gray.200" p={4} bg="gray.50" overflowY="auto">
              <Text fontSize="sm" fontWeight="bold" mb={3}>Word Cloud</Text>
              {wordCloudAvailable ? (
                <WordCloud words={wordCloudWords} width={wordCloudDimensions.width} height={wordCloudDimensions.height} />
              ) : (
                <Text fontSize="xs" color="gray.500">Not enough textual information for this selection.</Text>
              )}
            </Box>
          )}
        </Box>

        {showThemeRiver && (
          <Box borderTop="1px" borderColor="gray.200" p={4} bg="gray.50">
            <Text fontSize="sm" fontWeight="bold" mb={3}>Theme River</Text>
            {themeRiverAvailable ? (
              <Box w="full" overflowX="auto">
                <ThemeRiver
                  data={themeRiverData.data}
                  categories={themeRiverData.categories}
                  width={dimensions.width ? Math.max(800, dimensions.width - (showWordCloud ? wordCloudPanelWidth + 100 : 100)) : 960}
                  height={220}
                  colorScheme={colorScheme}
                />
              </Box>
            ) : (
              <Text fontSize="xs" color="gray.500">Temporal coverage unavailable for this selection.</Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default NeighborhoodPreservationTreeView;

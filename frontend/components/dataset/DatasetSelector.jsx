"use client";

import {
  Box,
  Button,
  Select,
  Text,
  VStack,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  useToast,
  Spinner,
  Progress,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  useSteps,
  Card,
  CardBody,
  Icon,
  Divider,
} from "@chakra-ui/react";
import * as d3 from "d3";
import { useState, useEffect } from "react";
import { FiDatabase, FiSettings, FiPlay, FiCheck } from "react-icons/fi";
import { usePhylo } from "../../src/context/PhyloContext";
import { prepareProjectionQualityBundle } from "../../src/utils/projectionMetrics";

const DatasetSelector = () => {
  const phyloContext = usePhylo();
  const {
    setCurrentDataset,
    setComparisonDataset,
    currentDataset,
    comparisonDataset,
    setProjectionQuality
  } = phyloContext;

  // Workflow state
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [selectedT1, setSelectedT1] = useState("none");
  const [selectedT2, setSelectedT2] = useState("none");
  const [datasetT1Raw, setDatasetT1Raw] = useState(null);
  const [datasetT2Raw, setDatasetT2Raw] = useState(null);
  const [analysisReady, setAnalysisReady] = useState(false);
  const toast = useToast();

  // Step management
  const steps = [
    { title: 'Select T1', description: 'Choose primary dataset', icon: FiDatabase },
    { title: 'Select T2', description: 'Choose comparison dataset', icon: FiDatabase },
    { title: 'Configure', description: 'Review configuration', icon: FiSettings },
    { title: 'Process', description: 'Run quality analysis', icon: FiPlay }
  ];

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: steps.length,
  });

  const datasetOptions = [
    { value: "none", label: "Select a dataset...", disabled: true },
    { value: "climate_t1", label: "Climate Change News T1 (50 articles)", file: "Climate_Change_News_T1.json" },
    { value: "climate_t2", label: "Climate Change News T2 (53 articles, updates & additions)", file: "Climate_Change_News_T2.json" },
    { value: "t1_full", label: "T1 Dataset (200 news articles)", file: "T1_news_dataset_full.json" },
    { value: "t2_full", label: "T2 Dataset (210 news articles - includes 10 new)", file: "T2_news_dataset_full.json" },
  ];

  const buildLowDimPointsFromTree = (treeStructure, labels) => {
    if (!Array.isArray(labels) || labels.length === 0) {
      return [];
    }

    if (!treeStructure || typeof treeStructure !== "object") {
      return labels.map((_, index) => {
        const angle = (index / labels.length) * 2 * Math.PI;
        return [Math.cos(angle), Math.sin(angle)];
      });
    }

    const hierarchy = d3.hierarchy(treeStructure);
    const cluster = d3.cluster().size([2 * Math.PI, 1]);
    cluster(hierarchy);

    const points = new Array(labels.length).fill(null);
    const labelToIndex = new Map();
    labels.forEach((label, index) => {
      labelToIndex.set(label, index);
    });

    hierarchy.leaves().forEach((leaf) => {
      const rawLabel = leaf.data?.id ?? leaf.data?.name ?? leaf.data?.label ?? leaf.data?.displayName;
      const normalizedLabel = typeof rawLabel === "string" ? rawLabel : String(rawLabel ?? "");
      const index = labelToIndex.has(normalizedLabel) ? labelToIndex.get(normalizedLabel) : null;
      const angle = leaf.x - Math.PI / 2;
      const radius = Math.max(0, leaf.y);
      const point = [Math.cos(angle) * radius, Math.sin(angle) * radius];

      if (index !== null && index !== undefined) {
        points[index] = point;
      }
    });

    return points.map((point, index) => {
      if (point) return point;
      const angle = (index / labels.length) * 2 * Math.PI;
      return [Math.cos(angle), Math.sin(angle)];
    });
  };

  const loadDataset = async (filename) => {
    try {
      const response = await fetch(`/datasets/json/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error loading dataset:", error);
      toast({
        title: "Error Loading Dataset",
        description: `Failed to load ${filename}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return null;
    }
  };

  const handleDatasetSelection = async (type, value) => {
    if (value === "none") return;

    setLoading(true);

    const selectedOption = datasetOptions.find(opt => opt.value === value);
    if (!selectedOption) {
      setLoading(false);
      return;
    }

    const data = await loadDataset(selectedOption.file);

    if (data) {
      if (type === "primary") {
        setDatasetT1Raw(data);
        setSelectedT1(value);
        toast({
          title: "T1 Dataset Loaded",
          description: `Loaded ${data.length} articles`,
          status: "success",
          duration: 2000,
          isClosable: true,
        });
        // Advance to step 2 (Select T2)
        setActiveStep(1);
      } else {
        setDatasetT2Raw(data);
        setSelectedT2(value);
        toast({
          title: "T2 Dataset Loaded",
          description: `Loaded ${data.length} articles`,
          status: "success",
          duration: 2000,
          isClosable: true,
        });
        // Advance to step 3 (Configure)
        setActiveStep(2);
      }
    }

    setLoading(false);
  };

  const startAnalysis = async () => {
    if (!datasetT1Raw || !datasetT2Raw) {
      toast({
        title: "Missing Datasets",
        description: "Please select both T1 and T2 datasets first",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    setActiveStep(3); // Move to "Process" step
    setProcessingStep("Initializing analysis...");

    try {
      // Step 1: Set datasets in context
      setProcessingStep("Setting up datasets...");
      setCurrentDataset(datasetT1Raw);
      setComparisonDataset(datasetT2Raw);

      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause for UX

      // Step 2: Generate phylogenetic tree from datasets
      setProcessingStep("Generating phylogenetic tree...");

      // Extract text content from datasets for analysis
      const textsT1 = datasetT1Raw.map(item => item.content || item.text || JSON.stringify(item));
      const textsT2 = datasetT2Raw.map(item => item.content || item.text || JSON.stringify(item));

      // Combine datasets for tree generation
      const allTexts = [...textsT1, ...textsT2];
      const labels = [
        ...textsT1.map((_, i) => `T1-${i+1}`),
        ...textsT2.map((_, i) => `T2-${i+1}`)
      ];

      const response = await fetch('http://localhost:4000/api/phylo/generate-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: allTexts,
          labels: labels
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process datasets');
      }

      setProcessingStep("Processing phylogenetic data...");
      const result = await response.json();

      // Create projection data from the phylogenetic analysis results
      if (result.success && Array.isArray(result.distance_matrix)) {
        if (phyloContext.loadProjectionData) {
          setProcessingStep("Creating projection visualization...");

          const combinedLabels = Array.isArray(result.enhanced_labels) && result.enhanced_labels.length
            ? result.enhanced_labels
            : labels;

          const highDimPoints = result.distance_matrix.map((row) =>
            Array.isArray(row) ? row.map((value) => Number.isFinite(value) ? value : 0) : []
          );

          const lowDimPoints = buildLowDimPointsFromTree(result.tree_structure, combinedLabels);

          await phyloContext.loadProjectionData({
            highDimPoints,
            lowDimPoints,
            groups: combinedLabels.map((_, index) => index < datasetT1Raw.length ? 0 : 1),
            labels: combinedLabels
          });
        }
      }

      // Precompute neighborhood preservation data for complementary views
      try {
        setProcessingStep("Computing neighborhood metrics for T1...");
        const pqT1 = await prepareProjectionQualityBundle(datasetT1Raw);
        if (pqT1) {
          setProjectionQuality((prev) => ({
            ...(prev ?? {}),
            t1: pqT1
          }));
        }

        if (datasetT2Raw) {
          setProcessingStep("Computing neighborhood metrics for T2...");
          const pqT2 = await prepareProjectionQualityBundle(datasetT2Raw);
          if (pqT2) {
            setProjectionQuality((prev) => ({
              ...(prev ?? {}),
              t2: pqT2
            }));
          }
        }
      } catch (metricsError) {
        console.error("Error computing neighborhood metrics:", metricsError);
        toast({
          title: "Neighborhood metrics unavailable",
          description: metricsError.message,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

      setAnalysisReady(true);
      setProcessingStep("");

      toast({
        title: "Analysis Complete!",
        description: "Quality analysis data is now available in all visualization tabs",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

    } catch (error) {
      console.error("Error processing datasets:", error);
      setProcessingStep("");
      toast({
        title: "Analysis Failed",
        description: "Failed to process datasets for quality analysis",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={6} bg="white" borderRadius="lg" shadow="sm" border="1px solid" borderColor="gray.200">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <VStack spacing={2} textAlign="center">
          <Text fontSize="xl" fontWeight="bold" color="blue.600">
            Dataset Configuration Wizard
          </Text>
          <Text fontSize="sm" color="gray.600">
            Follow the steps below to configure datasets for phylogenetic quality analysis
          </Text>
        </VStack>

        {/* Progress Stepper */}
        <Stepper index={activeStep} colorScheme="blue" size="sm">
          {steps.map((step, index) => (
            <Step key={index}>
              <StepIndicator>
                <StepStatus
                  complete={<Icon as={FiCheck} />}
                  incomplete={<StepNumber />}
                  active={<Icon as={step.icon} />}
                />
              </StepIndicator>
              <Box flexShrink="0" ml={2}>
                <StepTitle>{step.title}</StepTitle>
                <StepDescription>{step.description}</StepDescription>
              </Box>
              <StepSeparator />
            </Step>
          ))}
        </Stepper>

        {/* Content based on active step */}
        {activeStep === 0 && (
          <Card variant="outline">
            <CardBody>
              <VStack spacing={4} align="stretch">
              <HStack>
                <Icon as={FiDatabase} color="blue.500" />
                <Text fontSize="md" fontWeight="semibold">Select Primary Dataset (T1)</Text>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                Choose the primary dataset that will be used as the baseline for comparison analysis.
              </Text>
              <Text fontSize="xs" color="teal.600">
                Recommended: Climate Change News T1 (curated Kaggle sample)
              </Text>
                <Select
                  value={selectedT1}
                  onChange={(e) => handleDatasetSelection("primary", e.target.value)}
                  disabled={loading}
                  bg="gray.50"
                  placeholder="Select a dataset..."
                >
                  {datasetOptions.filter(opt => !opt.disabled).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {datasetT1Raw && (
                  <Badge colorScheme="green" fontSize="sm" alignSelf="start">
                    ✓ Loaded {datasetT1Raw.length} articles
                  </Badge>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {activeStep === 1 && (
          <Card variant="outline">
            <CardBody>
              <VStack spacing={4} align="stretch">
              <HStack>
                <Icon as={FiDatabase} color="orange.500" />
                <Text fontSize="md" fontWeight="semibold">Select Comparison Dataset (T2)</Text>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                Choose the comparison dataset to analyze differences and quality metrics.
              </Text>
              <Text fontSize="xs" color="teal.600">
                Recommended: Climate Change News T2 (updates & additions)
              </Text>
                <Select
                  value={selectedT2}
                  onChange={(e) => handleDatasetSelection("comparison", e.target.value)}
                  disabled={loading}
                  bg="gray.50"
                  placeholder="Select a dataset..."
                >
                  {datasetOptions.filter(opt => !opt.disabled).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {datasetT2Raw && (
                  <Badge colorScheme="orange" fontSize="sm" alignSelf="start">
                    ✓ Loaded {datasetT2Raw.length} articles
                  </Badge>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {activeStep === 2 && (
          <Card variant="outline">
            <CardBody>
              <VStack spacing={4} align="stretch">
                <HStack>
                  <Icon as={FiSettings} color="green.500" />
                  <Text fontSize="md" fontWeight="semibold">Review Configuration</Text>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  Confirm your dataset selection before running the analysis.
                </Text>

                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between" p={3} bg="blue.50" borderRadius="md">
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" fontWeight="semibold" color="blue.700">Primary Dataset (T1)</Text>
                      <Text fontSize="xs" color="blue.600">
                        {datasetOptions.find(opt => opt.value === selectedT1)?.label}
                      </Text>
                    </VStack>
                    <Badge colorScheme="blue">{datasetT1Raw?.length} articles</Badge>
                  </HStack>

                  <HStack justify="space-between" p={3} bg="orange.50" borderRadius="md">
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm" fontWeight="semibold" color="orange.700">Comparison Dataset (T2)</Text>
                      <Text fontSize="xs" color="orange.600">
                        {datasetOptions.find(opt => opt.value === selectedT2)?.label}
                      </Text>
                    </VStack>
                    <Badge colorScheme="orange">{datasetT2Raw?.length} articles</Badge>
                  </HStack>
                </VStack>

                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <Text fontSize="sm">
                      This configuration will enable quality analysis features across all visualization tabs.
                      {datasetT2Raw && datasetT1Raw && datasetT2Raw.length !== datasetT1Raw.length && (
                        <>
                          <br />
                          <strong>Analysis type:</strong> {datasetT2Raw.length > datasetT1Raw.length ? 'Data addition' : 'Data removal'} scenario
                        </>
                      )}
                    </Text>
                  </Box>
                </Alert>

                <Button
                  colorScheme="green"
                  onClick={startAnalysis}
                  disabled={!datasetT1Raw || !datasetT2Raw || loading}
                  size="lg"
                  leftIcon={<Icon as={FiPlay} />}
                >
                  Start Quality Analysis
                </Button>
              </VStack>
            </CardBody>
          </Card>
        )}

        {activeStep === 3 && (
          <Card variant="outline">
            <CardBody>
              <VStack spacing={4} align="stretch">
                <HStack>
                  <Icon as={loading ? Spinner : analysisReady ? FiCheck : FiPlay}
                        color={analysisReady ? "green.500" : "blue.500"} />
                  <Text fontSize="md" fontWeight="semibold">
                    {analysisReady ? "Analysis Complete" : "Processing Analysis"}
                  </Text>
                </HStack>

                {loading && (
                  <>
                    <Progress colorScheme="blue" size="sm" isIndeterminate />
                    <Text fontSize="sm" color="gray.600" textAlign="center">
                      {processingStep}
                    </Text>
                  </>
                )}

                {analysisReady && (
                  <Alert status="success" borderRadius="md">
                    <AlertIcon />
                    <Box>
                      <Text fontSize="sm">
                        <strong>Analysis completed successfully!</strong>
                        <br />
                        You can now explore the quality metrics in the following tabs:
                        <br />
                        • Neighborhood Preservation - k-NN preservation with Voronoi overlays
                        <br />
                        • Quality Inspector - Interactive point analysis
                        <br />
                        • Aggregated Errors - Statistical error overview
                        <br />
                        • Missing Neighbors - Global neighbor analysis
                        <br />
                        • Compare Projections - Method comparison
                      </Text>
                    </Box>
                  </Alert>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Loading overlay */}
        {loading && (
          <Box textAlign="center" py={2}>
            <Spinner size="sm" color="blue.500" mr={2} />
            <Text fontSize="sm" color="gray.600" display="inline">
              {processingStep || "Loading..."}
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default DatasetSelector;

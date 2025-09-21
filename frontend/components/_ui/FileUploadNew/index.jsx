import { useEffect, useRef, useState } from "react";
import {
  Button,
  Flex,
  Heading,
  HStack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
  Text,
  Box,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Link,
  Icon,
  Tooltip,
  useToast,
  Code,
  Collapse,
  IconButton,
} from "@chakra-ui/react";
import {
  BsArrowBarUp,
  BsFiletypeCsv,
  BsFiletypeJson,
  BsDownload,
  BsInfoCircle,
  BsChevronDown,
  BsChevronUp,
} from "react-icons/bs";
import { ImMagicWand } from "react-icons/im";
import { FaKaggle } from "react-icons/fa";
import { usePhyloCtx } from "../../../contexts/PhyloContext";

const getApiUrl = () => {
  // Use the configured API URL from environment variables
  // Next.js automatically loads the right .env file based on NODE_ENV
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6001";
  // Ensure URL ends with slash for consistency
  return apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
};

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Sample datasets configuration
const SAMPLE_DATASETS = [
  {
    id: "news-category",
    name: "News Category Dataset",
    description: "Sample news headlines from HuffPost",
    source: "Kaggle",
    sourceUrl: "https://www.kaggle.com/datasets/rmisra/news-category-dataset",
    localPath: "/datasets/json/News_Category_Dataset_sample.json",
    format: "json",
    size: "1.7 KB",
    records: "5",
    columns: ["category", "headline", "short_description", "date", "link"],
    icon: BsFiletypeJson,
  },
  {
    id: "bbc-news",
    name: "BBC News Dataset",
    description: "Sample BBC news articles from 5 categories",
    source: "Kaggle",
    sourceUrl: "https://www.kaggle.com/datasets/gpreda/bbc-news",
    localPath: "/datasets/csv/bbc_news_sample.csv",
    format: "csv",
    size: "2.3 KB",
    records: "5",
    columns: ["title", "description", "content", "pubDate", "category"],
    icon: BsFiletypeCsv,
  },
  {
    id: "fake-news",
    name: "FakeNewsNet Dataset",
    description: "Sample fake/real news dataset",
    source: "Kaggle",
    sourceUrl: "https://www.kaggle.com/datasets/algord/fake-news",
    localPath: "/datasets/csv/fake_news_sample.csv",
    format: "csv",
    size: "1.8 KB",
    records: "5",
    columns: ["id", "title", "content", "date", "real"],
    icon: BsFiletypeCsv,
  },
];

export default function FileUploadNew({ onClose }) {
  const {
    setVisDataPhylo,
    setVisDataWords,
    setVisDataTime,
    setVisDataObj,
    setVisDataLoc,
    selectedFilePipe,
    setSelectedFilePipe,
  } = usePhyloCtx();

  const [isSelected, setIsSelected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const inputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (selectedFilePipe) {
      setIsSelected(true);
      setSelectedSample(null);
    }
  }, [selectedFilePipe]);

  const changeHandler = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'json'].includes(fileExtension)) {
        toast({
          title: "Invalid file format",
          description: "Please select a CSV or JSON file",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return;
      }
      setSelectedFilePipe(file);
      setSelectedSample(null);
      setStatusMsg("");
      setIsDone(false);
    }
  };

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleSampleSelection = async (dataset) => {
    try {
      setIsLoading(true);
      setStatusMsg("Downloading sample dataset...");

      // Fetch the sample file
      const response = await fetch(dataset.localPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${dataset.name}`);
      }

      const blob = await response.blob();
      const file = new File([blob], dataset.localPath.split('/').pop(), {
        type: dataset.format === 'json' ? 'application/json' : 'text/csv'
      });

      setSelectedFilePipe(file);
      setSelectedSample(dataset);
      setIsSelected(true);
      setStatusMsg("");
      setIsDone(false);

      toast({
        title: "Sample dataset loaded",
        description: `${dataset.name} is ready to process`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error loading sample",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setStatusMsg("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmission = () => {
    if (!selectedFilePipe) {
      toast({
        title: "No file selected",
        description: "Please select a file to process",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setStatusMsg("Processing file...");
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFilePipe);

    // Determine endpoint based on file type
    const fileExtension = selectedFilePipe.name.split('.').pop().toLowerCase();
    const endpoint = fileExtension === 'json' ? 'upload/json' : 'upload/files';

    fetch(`${getApiUrl()}${endpoint}`, {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error?.message || "Upload failed");
        }
        return result;
      })
      .then((result) => {
        const data = result.data || result;
        setVisDataPhylo(data.phyloNewickData);
        setVisDataWords(data.wordcloudData);
        setVisDataTime(data.timevisData);
        setVisDataLoc(data.locationData);
        setVisDataObj(data.objData);
        setStatusMsg("Processing complete!");
        setIsDone(true);
        setIsLoading(false);

        toast({
          title: "Success!",
          description: "Data has been processed and visualizations are ready",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      })
      .catch((error) => {
        setStatusMsg(`Error: ${error.message}`);
        setIsLoading(false);
        toast({
          title: "Processing failed",
          description: error.message,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      });
  };

  const getFileIcon = () => {
    if (!selectedFilePipe) return null;
    const ext = selectedFilePipe.name.split('.').pop().toLowerCase();
    return ext === 'json' ? <BsFiletypeJson /> : <BsFiletypeCsv />;
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Header Section */}
      <Box>
        <Flex w="full" justifyContent="space-between" align="center" mb={2}>
          <Heading size="md">Data Input Pipeline</Heading>
          <Tooltip label="Show format information">
            <IconButton
              icon={showFormatInfo ? <BsChevronUp /> : <BsChevronDown />}
              size="sm"
              variant="ghost"
              onClick={() => setShowFormatInfo(!showFormatInfo)}
              aria-label="Toggle format info"
            />
          </Tooltip>
        </Flex>
        <Text fontSize="sm" color="gray.600">
          Upload CSV or JSON files to create phylogenetic trees and visualizations
        </Text>
      </Box>

      {/* Format Information */}
      <Collapse in={showFormatInfo}>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Required Data Format</AlertTitle>
            <AlertDescription mt={2}>
              <VStack align="start" spacing={3}>
                <Box>
                  <Text fontWeight="bold" mb={1}>CSV Format:</Text>
                  <Code display="block" p={2} borderRadius="md" fontSize="xs">
                    {`id,title,content,date,category
1,"Article Title","Article content text here...","2024-01-01","Technology"
2,"Another Title","More content text...","2024-01-02","Science"`}
                  </Code>
                  <Text fontSize="xs" mt={1}>Required: id, title, content. Optional: date, category, location</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold" mb={1}>JSON Format:</Text>
                  <Code display="block" p={2} borderRadius="md" fontSize="xs">
                    {`[
  {
    "id": 1,
    "title": "Article Title",
    "content": "Article content text here...",
    "date": "2024-01-01",
    "category": "Technology"
  }
]`}
                  </Code>
                  <Text fontSize="xs" mt={1}>Array of objects with same fields as CSV</Text>
                </Box>
              </VStack>
            </AlertDescription>
          </Box>
        </Alert>
      </Collapse>

      {/* Sample Datasets Section */}
      <Box>
        <Heading size="sm" mb={3}>Sample Datasets</Heading>
        <VStack spacing={3}>
          {SAMPLE_DATASETS.map((dataset) => (
            <Box
              key={dataset.id}
              p={4}
              borderWidth={1}
              borderRadius="md"
              borderColor={selectedSample?.id === dataset.id ? "blue.500" : "gray.200"}
              bg={selectedSample?.id === dataset.id ? "blue.50" : "white"}
              w="full"
              cursor="pointer"
              onClick={() => handleSampleSelection(dataset)}
              _hover={{ borderColor: "blue.400", bg: "gray.50" }}
              transition="all 0.2s"
            >
              <Flex justify="space-between" align="start">
                <HStack spacing={3} flex={1}>
                  <Icon as={dataset.icon} boxSize={6} color="gray.600" />
                  <Box flex={1}>
                    <HStack>
                      <Text fontWeight="bold">{dataset.name}</Text>
                      <Badge colorScheme={dataset.format === 'json' ? 'purple' : 'green'}>
                        {dataset.format.toUpperCase()}
                      </Badge>
                    </HStack>
                    <Text fontSize="sm" color="gray.600">{dataset.description}</Text>
                    <HStack spacing={4} mt={1}>
                      <Text fontSize="xs" color="gray.500">Size: {dataset.size}</Text>
                      <Text fontSize="xs" color="gray.500">Records: {dataset.records}</Text>
                      <Link
                        href={dataset.sourceUrl}
                        isExternal
                        fontSize="xs"
                        color="blue.500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HStack spacing={1}>
                          <FaKaggle />
                          <Text>View on Kaggle</Text>
                        </HStack>
                      </Link>
                    </HStack>
                  </Box>
                </HStack>
                <Button
                  size="sm"
                  leftIcon={<BsDownload />}
                  colorScheme="blue"
                  variant={selectedSample?.id === dataset.id ? "solid" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSampleSelection(dataset);
                  }}
                  isLoading={isLoading && selectedSample?.id === dataset.id}
                >
                  {selectedSample?.id === dataset.id ? "Selected" : "Use Sample"}
                </Button>
              </Flex>
            </Box>
          ))}
        </VStack>
      </Box>

      <Divider />

      {/* File Upload Section */}
      <Box>
        <Heading size="sm" mb={3}>Upload Your Data</Heading>
        <VStack
          border="2px"
          borderStyle="dashed"
          borderColor="gray.300"
          p={5}
          rounded="md"
          spacing={4}
          bg="gray.50"
        >
          {/* File Status Table */}
          <Box w="full" overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>File Name</Th>
                  <Th textAlign="center">Format</Th>
                  <Th textAlign="center">Size</Th>
                  <Th textAlign="center">Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isSelected ? (
                  <Tr>
                    <Td>
                      <HStack>
                        {getFileIcon()}
                        <Text>{selectedFilePipe?.name}</Text>
                      </HStack>
                    </Td>
                    <Td textAlign="center">
                      <Badge colorScheme={selectedFilePipe?.name.endsWith('.json') ? 'purple' : 'green'}>
                        {selectedFilePipe?.name.split('.').pop().toUpperCase()}
                      </Badge>
                    </Td>
                    <Td textAlign="center">{formatBytes(selectedFilePipe?.size)}</Td>
                    <Td textAlign="center">
                      {statusMsg && (
                        <Badge
                          colorScheme={
                            statusMsg.includes("Error") ? "red" :
                            statusMsg.includes("complete") ? "green" :
                            "blue"
                          }
                        >
                          {statusMsg}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Button
                        leftIcon={<ImMagicWand />}
                        colorScheme="green"
                        size="sm"
                        isDisabled={!isDone}
                        onClick={onClose}
                      >
                        Show Visualizations
                      </Button>
                    </Td>
                  </Tr>
                ) : (
                  <Tr>
                    <Td colSpan={5} textAlign="center" color="gray.500">
                      Select a file or choose a sample dataset to begin
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>

          {/* Action Buttons */}
          <HStack spacing={4}>
            <Button
              onClick={handleUploadClick}
              size="md"
              variant="outline"
              colorScheme="gray"
              leftIcon={selectedFilePipe && !selectedSample ? getFileIcon() : <BsInfoCircle />}
            >
              {selectedFilePipe && !selectedSample
                ? `${selectedFilePipe.name.substring(0, 30)}${selectedFilePipe.name.length > 30 ? '...' : ''}`
                : "Select Local File (.csv or .json)"}
            </Button>

            <input
              type="file"
              ref={inputRef}
              onChange={changeHandler}
              accept=".csv,.json"
              style={{ display: "none" }}
            />

            <Button
              leftIcon={<BsArrowBarUp />}
              onClick={handleSubmission}
              colorScheme="blue"
              size="md"
              isDisabled={!isSelected || isDone}
              isLoading={isLoading}
              loadingText="Processing..."
            >
              Run NLP Pipeline
            </Button>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
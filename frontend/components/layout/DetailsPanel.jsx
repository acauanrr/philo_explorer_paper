"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Image,
  Link,
  Spinner,
  Alert,
  AlertIcon,
  Badge,
  Divider,
  HStack,
  Icon,
  Button,
} from "@chakra-ui/react";
import { ExternalLinkIcon, SearchIcon } from "@chakra-ui/icons";
import { usePhyloCtx } from "@/contexts/PhyloContext";

const DetailsPanel = ({ colorsBar, onLocationData }) => {
  const { unifiedSelection } = usePhyloCtx();
  const [searchData, setSearchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("[DetailsPanel] unifiedSelection changed:", unifiedSelection);
    if (unifiedSelection?.nodeName) {
      console.log("[DetailsPanel] Fetching details for node:", unifiedSelection.nodeName);
      fetchNodeDetails(unifiedSelection.nodeName);
    } else {
      console.log("[DetailsPanel] No node selected, clearing data");
      setSearchData(null);
      setError(null);
      // Clear location data when no selection
      if (onLocationData) {
        onLocationData(null);
      }
    }
  }, [unifiedSelection, onLocationData]);

  // Extract meaningful search query from node name
  const extractSearchQuery = (nodeName) => {
    if (!nodeName) return "";

    // Check if this looks like a news node (CATEGORY_NUMBER_Title format)
    const newsPattern = /^[A-Z_&\s]+_\d+_(.+)$/;
    const match = nodeName.match(newsPattern);

    if (match) {
      // Extract the title part and clean it up
      const title = match[1]
        .replace(/_/g, ' ')              // Replace underscores with spaces
        .replace(/\.\.\.$/, '')          // Remove trailing ellipsis
        .replace(/\s+/g, ' ')            // Normalize whitespace
        .trim();                         // Remove leading/trailing whitespace

      return title;
    }

    // Fallback: use the original cleaning logic for non-news nodes
    return cleanNodeName(nodeName);
  };

  const fetchNodeDetails = async (nodeName) => {
    setLoading(true);
    setError(null);

    try {
      // Extract the meaningful search query from the node name
      const searchQuery = extractSearchQuery(nodeName);
      console.log("[DetailsPanel] Extracted search query:", searchQuery, "from node:", nodeName);

      // Use the backend API endpoint instead of direct ML service call
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6001";
      console.log("[DetailsPanel] Using API URL:", apiUrl);
      console.log("[DetailsPanel] Environment:", process.env.NODE_ENV);
      const requestPayload = {
        query: searchQuery,
        node_name: nodeName,  // Keep original for context
        node_type: nodeName.includes("_") && nodeName.match(/^[A-Z]+/) ? "news" : "general",
      };
      console.log("[DetailsPanel] Making API call to:", `${apiUrl}/api/phylo/search`);
      console.log("[DetailsPanel] Request payload:", requestPayload);

      const response = await fetch(`${apiUrl}/api/phylo/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch node information");
      }

      const result = await response.json();
      console.log("[DetailsPanel] API response:", result);

      if (result.success && result.data) {
        setSearchData(result.data);

        // Pass location data to parent component
        const hasLocationData = (
          (result.data.geo_data && result.data.geo_data.length > 0) ||
          (result.data.locations && result.data.locations.length > 0)
        );

        console.log("[DetailsPanel] Has location data:", hasLocationData);
        console.log("[DetailsPanel] geo_data:", result.data.geo_data);
        console.log("[DetailsPanel] locations:", result.data.locations);

        if (onLocationData && hasLocationData) {
          const locationDataToPass = {
            locations: result.data.locations || [],
            geo_data: result.data.geo_data || []
          };
          console.log("[DetailsPanel] Passing location data to parent:", locationDataToPass);
          onLocationData(locationDataToPass);
        } else if (onLocationData) {
          console.log("[DetailsPanel] No location data, clearing location map");
          onLocationData(null);
        }
      } else {
        throw new Error(result.error || "No data received");
      }
    } catch (err) {
      console.error("Error fetching node details:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cleanNodeName = (name) => {
    if (!name) return "";
    // For news nodes, extract just the headline
    if (name.includes("_") && name.match(/^[A-Z]/)) {
      const parts = name.split("_");
      if (parts.length > 2) {
        // Return the headline part, cleaned up
        return parts.slice(2).join(" ").replace(/\.\.\.$/, "");
      }
    }
    // Clean up node name for display
    const cleaned = name
      .replace(/_cluster\d*$/, "")
      .replace(/_mixed$/, " (mixed)")
      .replace(/_/g, " ");
    return cleaned;
  };

  return (
    <VStack h="full" spacing={0} bg="white" borderRadius="md" shadow="sm">
      <Heading
        size="sm"
        w="full"
        py={2}
        color="white"
        px={3}
        bgGradient={`linear(to-l, ${colorsBar[0]}, ${colorsBar[1]})`}
        display="flex"
        alignItems="center"
      >
        <Icon as={SearchIcon} mr={2} />
        Details
      </Heading>

      <Box flex="1" overflowY="auto" p={3} w="full">
        {!unifiedSelection?.nodeName ? (
          <Text fontSize="sm" color="gray.600">
            Select a node in the tree to view details
          </Text>
        ) : loading ? (
          <VStack spacing={3} py={5}>
            <Spinner size="md" color="blue.500" />
            <Text fontSize="sm" color="gray.600">
              Searching for information...
            </Text>
          </VStack>
        ) : error ? (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">{error}</Text>
          </Alert>
        ) : searchData ? (
          <VStack spacing={4} align="stretch">
            {/* Main Article Section */}
            <Box>
              {/* Category Badge */}
              {searchData.category && (
                <Badge colorScheme="purple" fontSize="xs" mb={2}>
                  {searchData.category}
                </Badge>
              )}

              {/* Main Title as hyperlink */}
              <Link
                href={searchData.source_url || searchData.wikipedia?.url}
                isExternal
                fontSize="lg"
                fontWeight="bold"
                color="blue.600"
                _hover={{ color: "blue.800", textDecoration: "underline" }}
                noOfLines={2}
                lineHeight="1.3"
              >
                {searchData.title || searchData.headline || cleanNodeName(searchData.node_name)}
                <ExternalLinkIcon mx="2px" boxSize={4} />
              </Link>

              {/* Publication Date and Source */}
              <HStack spacing={2} mt={2}>
                {searchData.publication_date && (
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">
                    {new Date(searchData.publication_date).toLocaleDateString()}
                  </Text>
                )}
                {(searchData.wikipedia?.title || searchData.source_url) && (
                  <>
                    {searchData.publication_date && <Text fontSize="xs" color="gray.400">•</Text>}
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      {searchData.wikipedia?.title ? 'Wikipedia' : 'Web Source'}
                    </Text>
                  </>
                )}
              </HStack>
            </Box>

            {/* Image - Only display when available */}
            {searchData.image_url && (
              <Box>
                <Image
                  src={searchData.image_url}
                  alt={searchData.title || searchData.node_name}
                  borderRadius="lg"
                  maxH="200px"
                  w="full"
                  objectFit="cover"
                  shadow="sm"
                  fallback={
                    <Box
                      bg="gray.100"
                      h="200px"
                      borderRadius="lg"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="sm" color="gray.500" textAlign="center">
                        Image not available
                      </Text>
                    </Box>
                  }
                />
              </Box>
            )}

            {/* Summary */}
            {searchData.summary && (
              <Box
                p={3}
                bg="gray.50"
                borderRadius="lg"
                borderLeftWidth="4px"
                borderLeftColor="blue.400"
              >
                <Text fontSize="xs" color="gray.500" fontWeight="bold" mb={2} textTransform="uppercase">
                  Summary
                </Text>
                <Text fontSize="sm" color="gray.700" lineHeight="1.5">
                  {searchData.summary}
                </Text>
              </Box>
            )}

            {/* Wikipedia Info */}
            {searchData.wikipedia?.title && (
              <Box>
                <HStack spacing={2} mb={1}>
                  <Badge colorScheme="blue" fontSize="xs">
                    Wikipedia
                  </Badge>
                </HStack>
                <Text fontSize="sm" fontWeight="medium" mb={1}>
                  {searchData.wikipedia.title}
                </Text>
                {searchData.wikipedia.url && (
                  <Link
                    href={searchData.wikipedia.url}
                    isExternal
                    color="blue.500"
                    fontSize="xs"
                    display="flex"
                    alignItems="center"
                  >
                    View on Wikipedia <ExternalLinkIcon mx="2px" />
                  </Link>
                )}
              </Box>
            )}

            <Divider />

            {/* Related Articles - Enhanced Display */}
            {(searchData.web_results || searchData.enhanced_results) && (
              <Box>
                <Text fontSize="sm" color="gray.700" fontWeight="bold" mb={3}>
                  Related Articles
                </Text>
                <VStack spacing={3} align="stretch">
                  {/* Display web_results first (main related articles) */}
                  {(searchData.web_results || []).slice(1, 4).map((result, idx) => (
                    <Box
                      key={`web-${idx}`}
                      p={3}
                      borderWidth="1px"
                      borderRadius="lg"
                      borderColor="gray.200"
                      bg="gray.50"
                      _hover={{ borderColor: "blue.400", bg: "blue.50", shadow: "md" }}
                      transition="all 0.3s"
                    >
                      <Link
                        href={result.url}
                        isExternal
                        fontSize="sm"
                        fontWeight="semibold"
                        color="blue.700"
                        _hover={{ color: "blue.900" }}
                        noOfLines={2}
                        lineHeight="1.4"
                      >
                        {result.title}
                        <ExternalLinkIcon mx="2px" boxSize={3} />
                      </Link>

                      {/* Date and Source */}
                      <HStack spacing={2} mt={2}>
                        {result.publication_date && (
                          <Text fontSize="xs" color="gray.500" fontWeight="medium">
                            {new Date(result.publication_date).toLocaleDateString()}
                          </Text>
                        )}
                        {result.source && (
                          <>
                            {result.publication_date && <Text fontSize="xs" color="gray.400">•</Text>}
                            <Badge size="sm" colorScheme="blue" fontSize="xs">
                              {result.source}
                            </Badge>
                          </>
                        )}
                      </HStack>

                      {/* Summary/Snippet */}
                      {(result.summary || result.snippet) && (
                        <Text fontSize="xs" color="gray.600" noOfLines={3} mt={2} lineHeight="1.3">
                          {result.summary || result.snippet}
                        </Text>
                      )}
                    </Box>
                  ))}

                  {/* If we need more articles, show enhanced_results */}
                  {searchData.enhanced_results && (searchData.web_results || []).length < 4 && (
                    <>
                      {searchData.enhanced_results.slice(0, 4 - (searchData.web_results || []).length + 1).map((result, idx) => (
                        <Box
                          key={`enhanced-${idx}`}
                          p={3}
                          borderWidth="1px"
                          borderRadius="lg"
                          borderColor="purple.200"
                          bg="purple.50"
                          _hover={{ borderColor: "purple.400", bg: "purple.100", shadow: "md" }}
                          transition="all 0.3s"
                        >
                          <HStack spacing={2} mb={1}>
                            <Badge
                              size="sm"
                              colorScheme={result.type === 'news' ? 'red' : 'green'}
                              fontSize="xs"
                            >
                              {result.type === 'news' ? 'NEWS' : 'ACADEMIC'}
                            </Badge>
                          </HStack>

                          <Link
                            href={result.url}
                            isExternal
                            fontSize="sm"
                            fontWeight="semibold"
                            color="purple.700"
                            _hover={{ color: "purple.900" }}
                            noOfLines={2}
                            lineHeight="1.4"
                          >
                            {result.title}
                            <ExternalLinkIcon mx="2px" boxSize={3} />
                          </Link>

                          <HStack spacing={2} mt={2}>
                            {result.publication_date && (
                              <Text fontSize="xs" color="gray.500" fontWeight="medium">
                                {new Date(result.publication_date).toLocaleDateString()}
                              </Text>
                            )}
                            {result.source && (
                              <>
                                {result.publication_date && <Text fontSize="xs" color="gray.400">•</Text>}
                                <Text fontSize="xs" color="gray.500" fontWeight="medium">
                                  {result.source}
                                </Text>
                              </>
                            )}
                          </HStack>

                          {result.snippet && (
                            <Text fontSize="xs" color="gray.600" noOfLines={2} mt={2} lineHeight="1.3">
                              {result.snippet}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </>
                  )}
                </VStack>
              </Box>
            )}

            {/* Source URL */}
            {searchData.source_url && !searchData.wikipedia?.url && (
              <Box>
                <Button
                  as={Link}
                  href={searchData.source_url}
                  isExternal
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  rightIcon={<ExternalLinkIcon />}
                  w="full"
                >
                  View Source
                </Button>
              </Box>
            )}
          </VStack>
        ) : null}
      </Box>
    </VStack>
  );
};

export default DetailsPanel;
"use client";

import { useState } from "react";
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { PhyloProvider } from "../src/context/PhyloContext";
import AggregatedErrorTreeView from "../src/components/quality/AggregatedErrorTreeView";
import MissingNeighborsTreeView from "../src/components/quality/MissingNeighborsTreeView";
import NeighborhoodPreservationTreeView from "../src/components/quality/NeighborhoodPreservationTreeView";
import DatasetSelector from "../components/dataset/DatasetSelector";
import { MainNavigation, NavigationTabPanel } from "../components/navigation/MainNavigation";
import { AppHeader } from "../components/layout/AppHeader";

function HomeContent() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Grid
      h="100vh"
      templateRows="auto 1fr"
      templateColumns="1fr"
      gap={0}
      bg="white"
      overflow="hidden"
    >
      {/* Header */}
      <GridItem>
        <AppHeader activeTab={activeTab} />
      </GridItem>

      {/* Main Content with Navigation */}
      <GridItem h="full" overflow="hidden">
        <MainNavigation
          activeTab={activeTab}
          onChange={(index) => setActiveTab(index)}
        >
          {/* Data Input Tab */}
          <NavigationTabPanel>
            <Box h="full" overflow="auto" p={4}>
              <Box maxW="1000px" mx="auto" py={4}>
                <VStack spacing={6}>
                  <VStack spacing={2} textAlign="center">
                    <Heading size="lg" color="blue.600">
                      Dataset Configuration
                    </Heading>
                    <Text fontSize="md" color="gray.600">
                      Configure your datasets using the step-by-step wizard below.
                      This improved flow prevents premature processing and gives you full control over when to start the analysis.
                    </Text>
                  </VStack>
                  <Box w="full">
                    <DatasetSelector />
                  </Box>
                </VStack>
              </Box>
            </Box>
          </NavigationTabPanel>

          {/* Neighborhood Preservation Tab */}
          <NavigationTabPanel>
            <NeighborhoodPreservationTreeView />
          </NavigationTabPanel>

          {/* Aggregated Errors Tab */}
          <NavigationTabPanel>
            <AggregatedErrorTreeView />
          </NavigationTabPanel>

          {/* Missing Neighbors Tab */}
          <NavigationTabPanel>
            <MissingNeighborsTreeView />
          </NavigationTabPanel>
        </MainNavigation>
      </GridItem>
    </Grid>
  );
}

export default function Home() {
  return (
    <PhyloProvider>
      <HomeContent />
    </PhyloProvider>
  );
}

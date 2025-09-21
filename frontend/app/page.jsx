"use client";

import { useState } from "react";
import {
  Box,
  Grid,
  GridItem,
  HStack,
  Heading,
  Text,
  Tooltip,
  VStack,
  useBreakpointValue,
  useColorModeValue,
} from "@chakra-ui/react";
import { TbArrowsMinimize, TbArrowsMaximize } from "react-icons/tb";
import Navbar from "../components/layout/Navbar";
import PhyloExplorer from "../components/visualizations/PhyloExplorer";
import EnhancedPhyloExplorer from "../components/visualizations/PhyloExplorer/EnhancedPhyloExplorer";
import WordCloudVis from "../components/visualizations/WordCloudVis";
import DetailsPanel from "../components/layout/DetailsPanel";
import ThemeRiver from "../components/visualizations/ThemeRiver";

export default function Home() {
  const colorsBar = ["#184282", "#18294C", "gray.200"];
  const [show, setShow] = useState(true);
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const toggleShow = () => setShow(!show);

  // Responsive values
  const sidebarWidth = useBreakpointValue({ base: "100%", md: "15%" });
  const rightPanelWidth = useBreakpointValue({ base: "100%", md: "20%" });
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Grid
      h="100vh"
      templateRows={show ? "auto 1fr auto" : "1fr"}
      templateColumns={
        show && !isMobile
          ? `${sidebarWidth} 1fr ${rightPanelWidth}`
          : "1fr"
      }
      gap={show && !isMobile ? 1 : 0}
      bg="white"
      overflow="hidden"
    >
      {/* -------- NAVBAR MENU -------- */}
      <GridItem
        colSpan={show && !isMobile ? 1 : 3}
        colStart={show && !isMobile ? 1 : 1}
        borderBottom="1px"
        borderRight={show && !isMobile ? "2px" : "0"}
        borderColor={borderColor}
        display={show ? "block" : "none"}
      >
        <Navbar />
      </GridItem>

      {/* -------- DETAILS SIDEBAR -------- */}
      {show && !isMobile && (
        <GridItem
          rowSpan={2}
          rowStart={2}
          h="full"
          borderRight="1px"
          borderColor={borderColor}
          overflow="hidden"
          bg="gray.50"
        >
          <DetailsPanel colorsBar={colorsBar} />
        </GridItem>
      )}

      {/* -------- MAIN : PHYLO VIS -------- */}
      <GridItem
        colSpan={isMobile || !show ? 3 : 1}
        rowSpan={show && !isMobile ? 2 : 1}
        rowStart={show && !isMobile ? 1 : 1}
        h="full"
        overflow="hidden"
      >
        <VStack h="full" spacing={0}>
          <HStack
            w="full"
            h="6"
            px={2}
            bgGradient={`linear(to-l, ${colorsBar[0]}, ${colorsBar[1]})`}
            justifyContent="space-between"
            flexShrink={0}
          >
            <Heading fontSize="sm" fontWeight="semibold" color="white">
              Phylogenetic Tree Explorer
            </Heading>
            <Tooltip
              label={show ? "Full Screen" : "Exit Full Screen"}
              placement="top-start"
              fontSize="xs"
            >
              <Box
                color="white"
                onClick={toggleShow}
                cursor="pointer"
                _hover={{ color: "gray.300" }}
              >
                {show ? <TbArrowsMaximize /> : <TbArrowsMinimize />}
              </Box>
            </Tooltip>
          </HStack>
          <Box flex="1" w="full" h="full" overflow="hidden">
            <EnhancedPhyloExplorer show={show} />
          </Box>
        </VStack>
      </GridItem>

      {/* -------- RIGHT PANEL: WORDCLOUD -------- */}
      {show && !isMobile && (
        <GridItem
          colSpan={1}
          colStart={3}
          rowSpan={3}
          rowStart={1}
          h="full"
          borderLeft="1px"
          borderColor={borderColor}
          overflow="hidden"
          bg="gray.50"
        >
          <VStack h="full" spacing={0}>
            <Box w="full" flex="1" overflow="hidden">
              <Heading
                as="h4"
                size="sm"
                w="full"
                h="8"
                color="white"
                px={3}
                bgGradient={`linear(to-l, ${colorsBar[0]}, ${colorsBar[1]})`}
                display="flex"
                alignItems="center"
                fontSize="sm"
                fontWeight="semibold"
              >
                Word Cloud
              </Heading>
              <Box h="calc(100% - 2rem)" overflow="hidden">
                <WordCloudVis />
              </Box>
            </Box>
          </VStack>
        </GridItem>
      )}

      {/* -------- THEME RIVER -------- */}
      {show && (
        <GridItem
          colSpan={3}
          h={isMobile ? "180px" : "150px"}
          borderTop="1px"
          borderColor={borderColor}
          overflow="hidden"
        >
          <VStack h="full" spacing={0}>
            <Box
              w="full"
              h="6"
              color="white"
              px={2}
              bgGradient={`linear(to-l, ${colorsBar[0]}, ${colorsBar[1]})`}
              display="flex"
              alignItems="center"
            >
              <Heading fontSize="sm" fontWeight="semibold">
                Theme River
              </Heading>
            </Box>
            <Box flex="1" w="full" overflow="hidden">
              <ThemeRiver />
            </Box>
          </VStack>
        </GridItem>
      )}
    </Grid>
  );
}
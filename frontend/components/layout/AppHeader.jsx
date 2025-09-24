"use client";

import React from 'react';
import {
  HStack,
  Heading,
  Text,
  Badge,
  useColorModeValue,
  Divider,
  Box,
} from '@chakra-ui/react';
import { useCurrentTab } from '../navigation/MainNavigation';

export function AppHeader({ activeTab }) {
  const currentTab = useCurrentTab(activeTab);
  const colorsBar = ["#184282", "#18294C"];
  const textColor = useColorModeValue("white", "white");
  const badgeColor = useColorModeValue("whiteAlpha.300", "whiteAlpha.300");

  return (
    <HStack
      w="full"
      h="16"
      px={6}
      bgGradient={`linear(to-r, ${colorsBar[0]}, ${colorsBar[1]})`}
      justifyContent="space-between"
      alignItems="center"
      flexShrink={0}
      borderBottom="1px solid"
      borderColor="whiteAlpha.200"
    >
      {/* Main Title */}
      <Box flex="1">
        <Heading
          fontSize="xl"
          fontWeight="bold"
          color={textColor}
          lineHeight="1.2"
        >
          Phylo Explorer
        </Heading>
        <Text
          fontSize="sm"
          color="whiteAlpha.800"
          fontWeight="medium"
          mt="1"
        >
          Phylogenetic Tree Analysis System
        </Text>
      </Box>

      <Divider orientation="vertical" h="8" borderColor="whiteAlpha.300" />

      {/* Current Tab Info */}
      <Box textAlign="right">
        <HStack spacing={2} alignItems="center">
          <Badge
            colorScheme="whiteAlpha"
            variant="solid"
            bg={badgeColor}
            color="white"
            px={3}
            py={1}
            borderRadius="md"
            fontSize="xs"
            fontWeight="semibold"
          >
            {currentTab.label}
          </Badge>
        </HStack>
        <Text
          fontSize="xs"
          color="whiteAlpha.700"
          fontWeight="medium"
          mt="1"
        >
          {currentTab.description}
        </Text>
      </Box>
    </HStack>
  );
}
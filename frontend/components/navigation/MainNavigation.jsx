"use client";

import React from 'react';
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  Icon,
  HStack,
  Text,
} from '@chakra-ui/react';
import {
  FiDatabase,
  FiSearch,
  FiBarChart,
  FiGitBranch,
  FiLayers,
} from 'react-icons/fi';

// Tab configuration with icons and descriptions
export const MAIN_NAVIGATION_TABS = [
  {
    id: 'data-input',
    label: 'Data Input',
    icon: FiDatabase,
    description: 'Dataset Configuration',
    color: 'blue.600',
  },
  {
    id: 'quality-inspector',
    label: 'Quality Inspector',
    icon: FiSearch,
    description: 'Interactive Tree Quality Analysis',
    color: 'purple.600',
  },
  {
    id: 'aggregated-errors',
    label: 'Aggregated Errors',
    icon: FiBarChart,
    description: 'Statistical Error Analysis',
    color: 'orange.600',
  },
  {
    id: 'missing-neighbors',
    label: 'Missing Neighbors',
    icon: FiGitBranch,
    description: 'Global Missing Neighbors Analysis',
    color: 'green.600',
  },
  {
    id: 'compare-projections',
    label: 'Compare Projections',
    icon: FiLayers,
    description: 'Projection Method Comparison',
    color: 'red.600',
  },
];

export function MainNavigation({ activeTab, onChange, children }) {
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const tabBg = useColorModeValue("gray.50", "gray.800");
  const tabHoverBg = useColorModeValue("white", "gray.700");

  return (
    <Tabs
      index={activeTab}
      onChange={onChange}
      h="full"
      display="flex"
      flexDirection="column"
      variant="line"
      colorScheme="blue"
    >
      <TabList
        bg={tabBg}
        borderBottom="2px solid"
        borderColor={borderColor}
        px={4}
        py={2}
        overflowX="auto"
        flexShrink={0}
      >
        {MAIN_NAVIGATION_TABS.map((tab, index) => (
          <Tab
            key={tab.id}
            _hover={{ bg: tabHoverBg }}
            _selected={{
              color: tab.color,
              borderColor: tab.color,
              bg: "white",
              fontWeight: "600",
            }}
            whiteSpace="nowrap"
            minW="fit-content"
            px={4}
            py={3}
            mx={1}
          >
            <HStack spacing={2}>
              <Icon as={tab.icon} boxSize={4} />
              <Text fontSize="sm" fontWeight="medium">
                {tab.label}
              </Text>
            </HStack>
          </Tab>
        ))}
      </TabList>

      <TabPanels flex="1" overflow="hidden" h="full">
        {children}
      </TabPanels>
    </Tabs>
  );
}

export function NavigationTabPanel({ children, ...props }) {
  return (
    <TabPanel h="full" p={0} {...props}>
      {children}
    </TabPanel>
  );
}

// Hook to get current tab info
export function useCurrentTab(activeTab) {
  return MAIN_NAVIGATION_TABS[activeTab] || MAIN_NAVIGATION_TABS[0];
}
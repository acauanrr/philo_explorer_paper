"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const PhyloContext = createContext({});

import initialData from "../public/datasets/initial-data.json";

export const PhyloContextProvider = ({ children }) => {
  const [visDataPhylo, setVisDataPhylo] = useState(null);
  const [visDataWords, setVisDataWords] = useState(initialData.wordcloudData);
  const [visDataTime, setVisDataTime] = useState(initialData.timevisData);
  const [visDataLoc, setVisDataLoc] = useState(initialData.locationData);
  const [visDataObj, setVisDataObj] = useState(initialData.objData);
  const [selectedFilePipe, setSelectedFilePipe] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

  // Unified selection state
  const [unifiedSelection, setUnifiedSelection] = useState({
    nodeId: null,
    nodeName: null,
    theme: null,
    source: null // 'phylo', 'wordcloud', 'timeline'
  });

  // Load news.txt by default when the app starts
  useEffect(() => {
    const loadNewsDataset = async () => {
      try {
        const response = await fetch('/datasets/newicks/news.txt');
        if (response.ok) {
          const content = await response.text();
          setVisDataPhylo(content);

          // Set news word cloud data
          const newsWordCloudData = [
            { word: "POLITICS", qtd: 32 },
            { word: "ENTERTAINMENT", qtd: 16 },
            { word: "WELLNESS", qtd: 17 },
            { word: "TRAVEL", qtd: 9 },
            { word: "STYLE", qtd: 9 },
            { word: "PARENTING", qtd: 8 },
            { word: "FOOD", qtd: 6 },
            { word: "BUSINESS", qtd: 16 },
            { word: "QUEER", qtd: 4 },
            { word: "SPORTS", qtd: 5 },
            { word: "BLACK", qtd: 4 },
            { word: "SCIENCE", qtd: 4 },
            { word: "TECH", qtd: 2 },
            { word: "MONEY", qtd: 4 },
            { word: "WEDDINGS", qtd: 3 },
            { word: "DIVORCE", qtd: 3 },
            { word: "CRIME", qtd: 3 },
            { word: "MEDIA", qtd: 3 },
            { word: "WEIRD", qtd: 2 },
            { word: "GREEN", qtd: 2 },
            { word: "RELIGION", qtd: 2 },
            { word: "WORLDPOST", qtd: 5 },
            { word: "WORLD", qtd: 2 },
            { word: "IMPACT", qtd: 3 },
            { word: "ARTS", qtd: 2 },
            { word: "CULTURE", qtd: 2 },
            { word: "COMEDY", qtd: 2 },
            { word: "FIFTY", qtd: 2 },
            { word: "COLLEGE", qtd: 2 },
            { word: "EDUCATION", qtd: 2 },
            { word: "ENVIRONMENT", qtd: 2 },
            { word: "GOOD", qtd: 2 },
            { word: "HOME", qtd: 2 },
            { word: "LATINO", qtd: 2 },
            { word: "TASTE", qtd: 2 },
            { word: "THE", qtd: 2 },
            { word: "U.S.", qtd: 2 },
            { word: "WOMEN", qtd: 2 }
          ];
          setVisDataWords(newsWordCloudData);
        }
      } catch (error) {
        console.error("Error loading news dataset:", error);
        // Fall back to initial data if news.txt fails to load
        setVisDataPhylo(initialData.phyloNewickData);
      } finally {
        setIsLoadingInitialData(false);
      }
    };

    loadNewsDataset();
  }, []);

  // Helper function to extract theme from node name
  const extractThemeFromNodeName = (nodeName) => {
    if (!nodeName) return null;
    // Extract the first part before underscore or use full name
    return nodeName.split('_')[0] || nodeName;
  };

  // Unified selection handler
  const handleUnifiedSelection = useCallback((selection) => {
    const { nodeId, nodeName, theme, source, clear } = selection;

    if (clear) {
      setUnifiedSelection({
        nodeId: null,
        nodeName: null,
        theme: null,
        source: null
      });
      setSelectedNode(null);
      setSelectedTheme(null);
      return;
    }

    // Determine theme from node name if not provided
    const selectedThemeValue = theme || extractThemeFromNodeName(nodeName);

    setUnifiedSelection({
      nodeId: nodeId || null,
      nodeName: nodeName || null,
      theme: selectedThemeValue,
      source: source || 'unknown'
    });

    // Update legacy states for backward compatibility
    if (nodeName) setSelectedNode({ name: nodeName, id: nodeId });
    if (selectedThemeValue) setSelectedTheme(selectedThemeValue);
  }, []);

  return (
    <PhyloContext.Provider
      value={{
        visDataPhylo,
        setVisDataPhylo,
        visDataWords,
        setVisDataWords,
        visDataTime,
        setVisDataTime,
        visDataLoc,
        visDataObj,
        setVisDataObj,
        setVisDataLoc,
        selectedFilePipe,
        setSelectedFilePipe,
        selectedNode,
        setSelectedNode,
        selectedTheme,
        setSelectedTheme,
        // Unified selection
        unifiedSelection,
        handleUnifiedSelection,
        extractThemeFromNodeName,
        isLoadingInitialData,
      }}
    >
      {children}
    </PhyloContext.Provider>
  );
};

export const usePhyloCtx = () => useContext(PhyloContext);

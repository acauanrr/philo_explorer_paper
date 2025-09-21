"use client";

import { PhyloContextProvider } from "@/contexts/PhyloContext";
import { ChakraProvider } from "@chakra-ui/react";

export function Providers({ children }) {
  return (
    <PhyloContextProvider>
      <ChakraProvider>{children}</ChakraProvider>
    </PhyloContextProvider>
  );
}

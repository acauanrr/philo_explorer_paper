"use client";

import { PhyloProvider } from "../src/context/PhyloContext";
import { ChakraProvider } from "@chakra-ui/react";

export function Providers({ children }) {
  return (
    <PhyloProvider>
      <ChakraProvider>{children}</ChakraProvider>
    </PhyloProvider>
  );
}

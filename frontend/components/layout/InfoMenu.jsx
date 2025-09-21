import {
  Box,
  Button,
  Heading,
  HStack,
  Image,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { MdInfo } from "react-icons/md";

export default function InfoMenu() {
  return (
    <Popover>
      {() => (
        <>
          <Box display="inline-block" w="full">
            <PopoverTrigger>
              <Button
                leftIcon={<MdInfo size={16} />}
                fontSize="xs"
                size="sm"
                variant="outline"
                colorScheme="gray"
                w="full"
                _hover={{
                  bg: "gray.50",
                  borderColor: "gray.400",
                }}
              >
                Info
              </Button>
            </PopoverTrigger>
          </Box>

          <Portal>
            <PopoverContent fontSize="sm">
              <PopoverArrow />
              <PopoverBody>
                <VStack justifyContent="flex-start" alignItems="start">
                  <Box>
                    <Heading size="xs" color="darkblue">
                      Version:
                    </Heading>
                    <Text fontSize="2xs">2.0 - Date 15/07/2023</Text>
                  </Box>
                  <Box>
                    <Heading size="xs" color="darkblue">
                      Reference:
                    </Heading>
                    <Text fontSize="2xs">
                      RIBEIRO, Acauan Cardoso. Visualização de mudanças em
                      coleções de textos por árvores de similaridade. 2017. 1
                      recurso online (95 p.) Dissertação (mestrado) -
                      Universidade Estadual de Campinas, Instituto de
                      Computação, Campinas, SP. Disponível em:{" "}
                      <a
                        href="https://doi.org/10.47749/T/UNICAMP.2017.983860"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        https://doi.org/10.47749/T/UNICAMP.2017.983860
                      </a>
                      .
                    </Text>
                  </Box>
                  <Box>
                    <Heading size="xs" color="darkblue">
                      Authors:
                    </Heading>
                    <VStack alignItems="flex-start" spacing={1} pt={1}>
                      <HStack justifyContent="space-between">
                        <Text fontSize="2xs">
                          Msc. Acauan C. Ribeiro - [UFRR - Brazil]
                        </Text>
                        <Tooltip label="Lattes" fontSize="xs" placement="top">
                          <a
                            href="http://lattes.cnpq.br/9665841057923003"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Image
                              src={`/icons/lattes.png`}
                              alt="lt"
                              w={4}
                            />
                          </a>
                        </Tooltip>
                      </HStack>
                      <HStack justifyContent="space-between">
                        <Text fontSize="2xs">
                          PhD. Guilherme P. Telles - [Unicamp - Brazil]
                        </Text>
                        <Tooltip label="Lattes" fontSize="xs" placement="top">
                          <a
                            href="http://lattes.cnpq.br/9783560852644016"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Image
                              src={`/icons/lattes.png`}
                              alt="lt"
                              w={4}
                            />
                          </a>
                        </Tooltip>
                      </HStack>
                      <HStack justifyContent="space-between">
                        <Text fontSize="2xs">
                          PhD. Rosane Minghim - [UCC - Ireland]
                        </Text>
                        <Tooltip label="Lattes" fontSize="xs" placement="top">
                          <a
                            href="http://lattes.cnpq.br/5138799833042314"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Image
                              src={`/icons/lattes.png`}
                              alt="lt"
                              w={4}
                            />
                          </a>
                        </Tooltip>
                      </HStack>
                    </VStack>
                  </Box>
                </VStack>
              </PopoverBody>
            </PopoverContent>
          </Portal>
        </>
      )}
    </Popover>
  );
}

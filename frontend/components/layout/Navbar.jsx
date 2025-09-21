import {
  Box,
  useColorModeValue,
  useDisclosure,
  IconButton,
  Button,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  Image,
  VStack,
  DrawerCloseButton,
} from "@chakra-ui/react";
import Logo from "../_ui/Logo";
import { FiMenu } from "react-icons/fi";
import InfoMenu from "./InfoMenu";
import FileUploadNew from "../_ui/FileUploadNew";

// Sample files removed - now handled in FileUploadNew component

export default function Navbar() {
  const bg = useColorModeValue("gray.50", "gray.800");
  const navbarMobile = useDisclosure();
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box
      as="header"
      bg={bg}
      w="full"
      h="full"
      px={{
        base: 2,
        md: 3,
      }}
      py={3}
    >
      <VStack spacing={3} align="center" h="full" justify="center">
        {/* Logo Section */}
        <Box>
          <Logo
            src={`/images/logo/logo-phylo.png`}
            w={32}
          />
        </Box>

        {/* Buttons Section */}
        <VStack spacing={2} w="full" px={2}>
          <Button
            leftIcon={
              <Image
                src={`/icons/database.png`}
                alt="db"
                w={4}
              />
            }
            fontSize="xs"
            size="sm"
            variant="outline"
            colorScheme="blue"
            onClick={onOpen}
            w="full"
            _hover={{
              bg: "blue.50",
              borderColor: "blue.400",
            }}
          >
            Add Dataset
          </Button>

          <InfoMenu />
        </VStack>

        {/* Mobile Menu Button */}
        <Box
          display={{
            base: "inline-flex",
            md: "none",
          }}
          position="absolute"
          top={4}
          left={4}
        >
          <IconButton
            aria-label="Menu"
            onClick={navbarMobile.onOpen}
            icon={<FiMenu />}
            size="sm"
            variant="ghost"
          />
        </Box>
      </VStack>
      <Drawer placement="bottom" onClose={onClose} isOpen={isOpen} size="2xl">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" py={1}>
            Data Input Pipeline
          </DrawerHeader>
          <DrawerBody>
            <Box py={4}>
              <FileUploadNew onClose={onClose} />
            </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

import { Flex, Icon, useColorModeValue } from "@chakra-ui/react";

export default function NavItem(props) {
  const { icon, children, main, ...rest } = props;
  const color = useColorModeValue("gray.600", "gray.300");
  return (
    <Flex
      align="center"
      px="2"
      py="3"
      cursor="pointer"
      color="inherit"
      _dark={{ color: "gray.400" }}
      _hover={{
        bg: "gray.100",
        _dark: { bg: "gray.900" },
        color: "gray.900",
      }}
      role="group"
      fontWeight={main ? "semibold" : "normal"}
      fontSize={main ? "sm" : "xs"}
      transition=".15s ease"
      {...rest}
    >
      {icon && (
        <Icon
          mx="2"
          boxSize="4"
          _groupHover={{
            color: color,
          }}
          as={icon}
        />
      )}
      {children}
    </Flex>
  );
}

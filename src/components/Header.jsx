import { Flex, Heading, Spacer } from '@chakra-ui/react'
import Select from './Select'
import '../styles/styles.css'

const Header = () => {
  return (
    <Flex h="45px" p={0} color="white" alignItems="center" gap={4}>
      <Heading size="2xl">Ruminant</Heading>
      <Spacer />
      <Flex width="256px">
        <Spacer />
        <Select />
      </Flex>
      <hr />
    </Flex>
  )
}

export default Header

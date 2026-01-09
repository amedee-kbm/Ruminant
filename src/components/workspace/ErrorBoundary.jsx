import React from 'react'
import { Box, Text, Button } from '@chakra-ui/react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={6} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
          <Text fontSize="lg" fontWeight="bold" color="red.600" mb={2}>
            Something went wrong
          </Text>
          <Text fontSize="sm" color="red.700" mb={4} fontFamily="mono">
            {this.state.error && this.state.error.toString()}
          </Text>
          {this.state.errorInfo && (
            <Box mb={4}>
              <Text fontSize="xs" fontWeight="bold" mb={2}>
                Component Stack:
              </Text>
              <Text fontSize="xs" fontFamily="mono" whiteSpace="pre-wrap">
                {this.state.errorInfo.componentStack}
              </Text>
            </Box>
          )}
          <Button
            size="sm"
            colorScheme="red"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null })
              window.location.reload()
            }}
          >
            Reload Page
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary


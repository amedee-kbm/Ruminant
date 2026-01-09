import { useState, useEffect } from 'react'
import { Box, Heading, Text, Stack, Button, Separator, Tabs, Textarea } from '@chakra-ui/react'

const RightPane = ({
  scheme,
  currentChapterId,
  questions = [],
  reflections = [],
  surveyNotes = '',
  onAddQuestion,
  onEditSurveyNotes,
  onGenerateSummary,
}) => {
  const [isEditingSurvey, setIsEditingSurvey] = useState(false)
  const [surveyText, setSurveyText] = useState(surveyNotes)

  useEffect(() => {
    setSurveyText(surveyNotes)
    setIsEditingSurvey(false)
  }, [surveyNotes, currentChapterId])
  return (
    <Box
      width="360px"
      borderLeft={scheme.rightPaneBorder}
      bg={scheme.rightPaneBg}
      backdropFilter="blur(6px)"
      px={5}
      py={6}
      overflowY="auto"
    >
      <Tabs.Root defaultValue="survey" variant="enclosed" colorScheme="green">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="survey">Survey</Tabs.Trigger>
          <Tabs.Trigger value="question">Question</Tabs.Trigger>
          <Tabs.Trigger value="recite">Recite</Tabs.Trigger>
          <Tabs.Trigger value="review">Review</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="survey">
          <Heading size="xs" textTransform="uppercase" opacity={0.6} color={scheme.primaryText}>
            Survey prompts
          </Heading>
          {isEditingSurvey ? (
            <>
              <Textarea
                mt={3}
                value={surveyText}
                onChange={(e) => setSurveyText(e.target.value)}
                placeholder="Enter your survey notes..."
                minHeight="120px"
                bg={scheme.reciteBg}
                border={scheme.reciteBorder}
                color={scheme.primaryText}
                _placeholder={{ color: scheme.placeholderText }}
              />
              <Stack direction="row" spacing={2} mt={3}>
                <Button
                  size="sm"
                  variant="outline"
                  flex="1"
                  color={scheme.primaryText}
                  onClick={() => {
                    setIsEditingSurvey(false)
                    setSurveyText(surveyNotes)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  flex="1"
                  bg={scheme.accent}
                  _hover={{ bg: scheme.accentHover }}
                  color={scheme.id === 'clean' ? 'white' : 'black'}
                  onClick={() => {
                    onEditSurveyNotes?.(surveyText)
                    setIsEditingSurvey(false)
                  }}
                >
                  Save
                </Button>
              </Stack>
            </>
          ) : (
            <>
              <Text
                mt={3}
                fontSize="sm"
                lineHeight="tall"
                color={scheme.primaryText}
                whiteSpace="pre-line"
              >
                {surveyNotes || 'No survey notes yet. Click "Edit survey notes" to add some.'}
              </Text>
              <Button
                mt={4}
                size="sm"
                variant="outline"
                width="100%"
                color={scheme.primaryText}
                onClick={() => setIsEditingSurvey(true)}
              >
                {surveyNotes ? 'Edit survey notes' : 'Add survey notes'}
              </Button>
            </>
          )}
        </Tabs.Content>
        <Tabs.Content value="question">
          <Heading size="xs" textTransform="uppercase" opacity={0.6} color={scheme.primaryText}>
            Active questions
          </Heading>
          <Stack spacing={3} mt={3}>
            {questions && questions.length > 0 ? (
              questions.map((q) => (
                <Box
                  key={q.id}
                  border={scheme.chapterBorder || '1px solid rgba(255,255,255,0.15)'}
                  borderRadius="md"
                  p={3}
                >
                  <Text fontWeight="semibold" fontSize="sm" color={scheme.primaryText}>
                    {q.question_text}
                  </Text>
                  <Text fontSize="xs" opacity={0.7} color={scheme.primaryText} mt={1}>
                    {q.highlight_text
                      ? `Added from highlight: "${q.highlight_text.substring(0, 50)}..."`
                      : q.source === 'manual'
                        ? 'Added manually'
                        : 'Prepared before reading'}
                  </Text>
                </Box>
              ))
            ) : (
              <Text fontSize="sm" color={scheme.placeholderText} opacity={0.7}>
                No questions yet. Add one below.
              </Text>
            )}
          </Stack>
          <Button
            mt={4}
            size="sm"
            colorScheme="green"
            width="100%"
            onClick={() => {
              const questionText = prompt('Enter your question:')
              if (questionText && questionText.trim()) {
                onAddQuestion?.(questionText.trim())
              }
            }}
          >
            Add question
          </Button>
        </Tabs.Content>
        <Tabs.Content value="recite">
          <Heading size="xs" textTransform="uppercase" opacity={0.6} color={scheme.primaryText}>
            Recite
          </Heading>
          <Text fontSize="sm" mt={3} opacity={0.8} color={scheme.primaryText}>
            Without peeking back, summarize what you just read.
          </Text>
          <Box
            mt={3}
            p={3}
            borderRadius="md"
            border={scheme.reciteBorder}
            bg={scheme.reciteBg}
            minHeight="120px"
          >
            <Text fontSize="sm" color={scheme.primaryText} whiteSpace="pre-line">
              {reflections && reflections.length > 0
                ? reflections.map((r) => r.reflection_text).join('\n\n')
                : 'Your recitation will appear here. Use "Add Reflection" to record your thoughts.'}
            </Text>
          </Box>
          <Button mt={4} size="sm" variant="outline" width="100%" color={scheme.primaryText}>
            Continue reciting
          </Button>
        </Tabs.Content>
        <Tabs.Content value="review">
          <Heading size="xs" textTransform="uppercase" opacity={0.6} color={scheme.primaryText}>
            Review
          </Heading>
          <Text fontSize="sm" mt={3} color={scheme.primaryText} whiteSpace="pre-line">
            {questions && questions.length > 0
              ? `• ${questions.length} question${questions.length !== 1 ? 's' : ''} recorded\n`
              : '• No questions yet\n'}
            {reflections && reflections.length > 0
              ? `• ${reflections.length} reflection${reflections.length !== 1 ? 's' : ''} recorded`
              : '• No reflections yet'}
          </Text>
          <Separator my={4} borderColor={scheme.reviewSeparator} borderWidth="1px" />
          <Button width="100%" colorScheme="green" size="sm" onClick={onGenerateSummary}>
            Generate summary
          </Button>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

export default RightPane

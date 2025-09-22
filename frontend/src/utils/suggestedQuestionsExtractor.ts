/**
 * Utility function to extract suggested questions from a response text
 * @param responseText - The full response text that may contain a "Suggested Questions" section
 * @returns Object containing the main content and extracted questions
 */
export interface ExtractedContent {
  mainContent: string
  suggestedQuestions: string[]
  hasSuggestedQuestions: boolean
}

export function extractSuggestedQuestions(responseText: string): ExtractedContent {
  if (!responseText || typeof responseText !== 'string') {
    return {
      mainContent: responseText || '',
      suggestedQuestions: [],
      hasSuggestedQuestions: false
    }
  }

  // Look for "Suggested Questions" section (case insensitive)
  const suggestedQuestionsRegex = /(?:^|\n)\s*(?:##\s*)?Suggested Questions?\s*:?\s*(?:\n|$)/i
  const match = responseText.match(suggestedQuestionsRegex)
  
  if (!match) {
    return {
      mainContent: responseText,
      suggestedQuestions: [],
      hasSuggestedQuestions: false
    }
  }

  // Split the content at the "Suggested Questions" section
  const parts = responseText.split(suggestedQuestionsRegex)
  
  if (parts.length < 2) {
    return {
      mainContent: responseText,
      suggestedQuestions: [],
      hasSuggestedQuestions: false
    }
  }

  const mainContent = parts[0].trim()
  const suggestedQuestionsSection = parts.slice(1).join('').trim()

  // Extract individual questions from the suggested questions section
  const questions = extractQuestionsFromSection(suggestedQuestionsSection)

  return {
    mainContent,
    suggestedQuestions: questions,
    hasSuggestedQuestions: questions.length > 0
  }
}

/**
 * Extract individual questions from the suggested questions section
 * @param section - The text containing the suggested questions
 * @returns Array of individual questions
 */
function extractQuestionsFromSection(section: string): string[] {
  if (!section) {
    return []
  }

  const questions: string[] = []
  
  // Split by common list patterns and line breaks
  const lines = section.split(/\n+/).filter(line => line.trim())
  
  for (const line of lines) {
    // Remove common list markers and clean up the question
    let question = line
      .replace(/^[-*•]\s*/, '')           // Remove bullet points
      .replace(/^\d+[.)]\s*/, '')         // Remove numbered lists
      .replace(/^-\s*/, '')               // Remove dashes
      .replace(/^\*\s*/, '')              // Remove asterisks
      .trim()

    // Skip header lines (lines that start with # or contain "Suggested Questions")
    if (question.startsWith('#') || question.toLowerCase().includes('suggested questions')) {
      continue
    }

    // Skip empty lines or very short content
    if (question && question.length > 10) {
      // Remove trailing question marks and clean up
      question = question.replace(/[?]+$/, '').trim()
      
      // Add back a question mark if it doesn't end with punctuation
      if (question && !/[.!?]$/.test(question)) {
        question += '?'
      }
      
      questions.push(question)
    }
  }

  // Filter out duplicates and limit to reasonable number
  const uniqueQuestions = Array.from(new Set(questions))
    .filter(q => q.length > 5 && q.length < 200) // Reasonable length
    .slice(0, 5) // Limit to 5 questions max

  return uniqueQuestions
}

/**
 * Remove the "Suggested Questions" section from a response text
 * @param responseText - The full response text
 * @returns The response text without the suggested questions section
 */
export function removeSuggestedQuestionsSection(responseText: string): string {
  const extracted = extractSuggestedQuestions(responseText)
  return extracted.mainContent
}

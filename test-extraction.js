// Test the extraction function with the provided example
const testText = `Some explanation content here.

Suggested Questions:
How do I find the recursive formula for arithmetic or geometric sequences?
Can you help me solve word problems using these sequences?
How do I tell if a sequence is neither arithmetic nor geometric?`;

// Simulate the extraction function
function extractSuggestedQuestions(responseText) {
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
  
  console.log('Regex match:', match)
  
  if (!match) {
    return {
      mainContent: responseText,
      suggestedQuestions: [],
      hasSuggestedQuestions: false
    }
  }

  // Split the content at the "Suggested Questions" section
  const parts = responseText.split(suggestedQuestionsRegex)
  
  console.log('Parts:', parts)
  
  if (parts.length < 2) {
    return {
      mainContent: responseText,
      suggestedQuestions: [],
      hasSuggestedQuestions: false
    }
  }

  const mainContent = parts[0].trim()
  const suggestedQuestionsSection = parts.slice(1).join('').trim()

  console.log('Main content:', mainContent)
  console.log('Questions section:', suggestedQuestionsSection)

  // Extract individual questions from the suggested questions section
  const questions = extractQuestionsFromSection(suggestedQuestionsSection)

  console.log('Extracted questions:', questions)

  return {
    mainContent,
    suggestedQuestions: questions,
    hasSuggestedQuestions: questions.length > 0
  }
}

function extractQuestionsFromSection(section) {
  if (!section) {
    return []
  }

  const questions = []
  
  // Split by common list patterns and line breaks
  const lines = section.split(/\n+/).filter(line => line.trim())
  
  console.log('Lines from section:', lines)
  
  for (const line of lines) {
    // Remove common list markers and clean up the question
    let question = line
      .replace(/^[-*•]\s*/, '')           // Remove bullet points
      .replace(/^\d+[.)]\s*/, '')         // Remove numbered lists
      .replace(/^-\s*/, '')               // Remove dashes
      .replace(/^\*\s*/, '')              // Remove asterisks
      .trim()

    console.log('Processing line:', line, '-> cleaned:', question)

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

// Test the function
const result = extractSuggestedQuestions(testText)
console.log('\nFinal result:', JSON.stringify(result, null, 2))

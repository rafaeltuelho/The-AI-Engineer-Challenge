import React from 'react'
import { MessageCircle } from 'lucide-react'
import './SuggestedQuestions.css'

interface SuggestedQuestionsProps {
  questions: string[]
  onQuestionClick: (question: string) => void
  isVisible: boolean
}

const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({ 
  questions, 
  onQuestionClick, 
  isVisible 
}) => {
  if (!isVisible || questions.length === 0) {
    return null
  }

  // Different light background colors for each question badge
  const getBadgeColor = (index: number): string => {
    const colors = [
      'rgba(59, 130, 246, 0.15)',   // Blue
      'rgba(34, 197, 94, 0.15)',    // Green
      'rgba(168, 85, 247, 0.15)',   // Purple
      'rgba(245, 158, 11, 0.15)',   // Yellow
      'rgba(236, 72, 153, 0.15)',   // Pink
      'rgba(14, 165, 233, 0.15)'    // Sky blue
    ]
    return colors[index % colors.length]
  }

  const getBorderColor = (index: number): string => {
    const colors = [
      'rgba(59, 130, 246, 0.3)',    // Blue
      'rgba(34, 197, 94, 0.3)',     // Green
      'rgba(168, 85, 247, 0.3)',    // Purple
      'rgba(245, 158, 11, 0.3)',    // Yellow
      'rgba(236, 72, 153, 0.3)',    // Pink
      'rgba(14, 165, 233, 0.3)'     // Sky blue
    ]
    return colors[index % colors.length]
  }

  const getTextColor = (index: number): string => {
    const colors = [
      'rgb(59, 130, 246)',          // Blue
      'rgb(34, 197, 94)',           // Green
      'rgb(168, 85, 247)',          // Purple
      'rgb(245, 158, 11)',          // Yellow
      'rgb(236, 72, 153)',          // Pink
      'rgb(14, 165, 233)'           // Sky blue
    ]
    return colors[index % colors.length]
  }

  return (
    <div className="suggested-questions-container">
      <div className="suggested-questions-header">
        <MessageCircle size={16} />
        <span>Suggested Questions</span>
      </div>
      <div className="suggested-questions-grid">
        {questions.map((question, index) => (
          <button
            key={index}
            className="suggested-question-badge"
            style={{
              backgroundColor: getBadgeColor(index),
              borderColor: getBorderColor(index),
              color: getTextColor(index)
            }}
            onClick={() => onQuestionClick(question)}
            title={`Click to ask: ${question}`}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SuggestedQuestions

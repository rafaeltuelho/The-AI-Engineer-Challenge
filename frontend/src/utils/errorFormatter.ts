/**
 * Formats backend error responses into human-friendly messages.
 * Handles FastAPI/Pydantic validation errors and other structured error formats.
 */

interface ValidationError {
  type?: string
  loc?: (string | number)[]
  msg?: string
  input?: any
}

/**
 * Formats a single validation error into a readable message.
 */
function formatValidationError(error: ValidationError): string {
  const location = error.loc && error.loc.length > 0
    ? error.loc.slice(1).join(' → ') // Skip first element (usually "body")
    : 'unknown field'
  
  const message = error.msg || 'validation error'
  
  return `${location}: ${message}`
}

/**
 * Formats backend error detail into a user-friendly message.
 * 
 * @param detail - The error detail from the backend response
 * @returns A human-readable error message
 */
export function formatBackendError(detail: unknown): string {
  // Case 1: Plain string - return as-is
  if (typeof detail === 'string') {
    return detail
  }

  // Case 2: Array of validation errors (FastAPI/Pydantic)
  if (Array.isArray(detail)) {
    const errors = detail as ValidationError[]
    
    if (errors.length === 0) {
      return 'Validation error occurred'
    }

    if (errors.length === 1) {
      return formatValidationError(errors[0])
    }

    // Multiple errors - format as a list
    const errorMessages = errors.map(formatValidationError)
    return `Multiple validation errors:\n${errorMessages.map(msg => `• ${msg}`).join('\n')}`
  }

  // Case 3: Object with message-like properties
  if (detail && typeof detail === 'object') {
    const obj = detail as Record<string, any>
    
    // Try common error message fields
    if (obj.message) return String(obj.message)
    if (obj.error) return String(obj.error)
    if (obj.msg) return String(obj.msg)
    
    // Fallback for unknown object structure
    return 'An error occurred while processing your request'
  }

  // Case 4: Unknown type
  return 'An unexpected error occurred'
}


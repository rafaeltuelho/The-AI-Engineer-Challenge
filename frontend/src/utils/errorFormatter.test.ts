import { describe, it, expect } from 'vitest'
import { formatBackendError } from './errorFormatter'

describe('formatBackendError', () => {
  describe('plain string errors', () => {
    it('should return plain string as-is', () => {
      const result = formatBackendError('Something went wrong')
      expect(result).toBe('Something went wrong')
    })

    it('should handle empty string', () => {
      const result = formatBackendError('')
      expect(result).toBe('')
    })
  })

  describe('FastAPI/Pydantic validation errors (array)', () => {
    it('should format single validation error', () => {
      const error = [{
        type: 'value_error',
        loc: ['body', 'developer_message'],
        msg: 'Value error, Developer message is required'
      }]
      
      const result = formatBackendError(error)
      expect(result).toBe('developer_message: Value error, Developer message is required')
    })

    it('should format multiple validation errors', () => {
      const errors = [
        {
          type: 'value_error',
          loc: ['body', 'developer_message'],
          msg: 'Value error, Developer message is required'
        },
        {
          type: 'type_error',
          loc: ['body', 'model'],
          msg: 'Input should be a valid string'
        }
      ]
      
      const result = formatBackendError(errors)
      expect(result).toContain('Multiple validation errors:')
      expect(result).toContain('• developer_message: Value error, Developer message is required')
      expect(result).toContain('• model: Input should be a valid string')
    })

    it('should handle nested location paths', () => {
      const error = [{
        type: 'value_error',
        loc: ['body', 'user', 'email'],
        msg: 'Invalid email format'
      }]
      
      const result = formatBackendError(error)
      expect(result).toBe('user → email: Invalid email format')
    })

    it('should handle validation error without location', () => {
      const error = [{
        type: 'value_error',
        msg: 'General validation error'
      }]
      
      const result = formatBackendError(error)
      expect(result).toBe('unknown field: General validation error')
    })

    it('should handle validation error without message', () => {
      const error = [{
        type: 'value_error',
        loc: ['body', 'field']
      }]
      
      const result = formatBackendError(error)
      expect(result).toBe('field: validation error')
    })

    it('should handle empty array', () => {
      const result = formatBackendError([])
      expect(result).toBe('Validation error occurred')
    })
  })

  describe('object errors', () => {
    it('should extract message from object with message field', () => {
      const error = { message: 'Custom error message' }
      const result = formatBackendError(error)
      expect(result).toBe('Custom error message')
    })

    it('should extract error from object with error field', () => {
      const error = { error: 'Something failed' }
      const result = formatBackendError(error)
      expect(result).toBe('Something failed')
    })

    it('should extract msg from object with msg field', () => {
      const error = { msg: 'Error occurred' }
      const result = formatBackendError(error)
      expect(result).toBe('Error occurred')
    })

    it('should handle object without known fields', () => {
      const error = { unknown: 'field', random: 'data' }
      const result = formatBackendError(error)
      expect(result).toBe('An error occurred while processing your request')
    })

    it('should handle empty object', () => {
      const result = formatBackendError({})
      expect(result).toBe('An error occurred while processing your request')
    })
  })

  describe('edge cases', () => {
    it('should handle null', () => {
      const result = formatBackendError(null)
      expect(result).toBe('An unexpected error occurred')
    })

    it('should handle undefined', () => {
      const result = formatBackendError(undefined)
      expect(result).toBe('An unexpected error occurred')
    })

    it('should handle number', () => {
      const result = formatBackendError(42)
      expect(result).toBe('An unexpected error occurred')
    })

    it('should handle boolean', () => {
      const result = formatBackendError(true)
      expect(result).toBe('An unexpected error occurred')
    })
  })

  describe('real-world examples', () => {
    it('should format the reported developer_message error', () => {
      // This is the exact error format reported by the user
      const error = [{
        type: 'value_error',
        loc: ['body', 'developer_message'],
        msg: 'Value error, Developer message is required',
        input: null,
        ctx: { error: {} }
      }]
      
      const result = formatBackendError(error)
      expect(result).toBe('developer_message: Value error, Developer message is required')
      expect(result).not.toContain('[{')
      expect(result).not.toContain('JSON')
    })
  })
})


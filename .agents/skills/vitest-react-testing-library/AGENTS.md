# Vitest + React Testing Library - Agent Instructions

## Purpose

This document provides AI agents with specific instructions for writing and maintaining tests in this React + Vite + TypeScript + Vitest + React Testing Library codebase.

## When to Apply This Skill

Apply this skill when:
- Writing new component tests
- Fixing failing tests
- Refactoring test code
- Debugging flaky tests
- Reviewing test PRs

## Critical Rules for Agents

### Rule 1: ALWAYS Restore Global Mocks

**CRITICAL**: Failure to restore globals causes test pollution and flaky tests.

```typescript
// REQUIRED pattern for ANY global mock
describe('Component', () => {
  const originalFetch = global.fetch
  const originalFileReader = global.FileReader
  const originalLocalStorage = global.localStorage

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up mocks
  })

  afterEach(() => {
    // MANDATORY: Restore ALL mocked globals
    global.fetch = originalFetch
    global.FileReader = originalFileReader
    global.localStorage = originalLocalStorage
  })
})
```

### Rule 2: Use Accessibility-First Queries

**REQUIRED**: Always prefer accessible queries over test IDs.

```typescript
// Priority order (use highest available):
// 1. getByRole (BEST)
screen.getByRole('button', { name: /submit/i })
screen.getByRole('textbox', { name: /email/i })

// 2. getByLabelText
screen.getByLabelText('Email address')

// 3. getByPlaceholderText
screen.getByPlaceholderText('Enter email')

// 4. getByText
screen.getByText('Welcome')

// 5. getByTestId (LAST RESORT)
screen.getByTestId('submit-btn')  // Only if no other option
```

### Rule 3: Handle Async Operations Correctly

**REQUIRED**: Never assert on async state without waiting.

```typescript
// ✅ CORRECT: Wait for async updates
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
}, { timeout: 2000 })

// ✅ ALSO CORRECT: findBy* waits automatically
const element = await screen.findByText('Loaded')

// ❌ WRONG: Race condition
render(<AsyncComponent />)
expect(screen.getByText('Loaded')).toBeInTheDocument()  // FAILS
```

### Rule 4: Use Correct Query Variants

**REQUIRED**: Match query variant to assertion type.

```typescript
// ✅ CORRECT: queryBy* for negative assertions
expect(screen.queryByText('Error')).not.toBeInTheDocument()

// ❌ WRONG: getBy* throws if not found
expect(screen.getByText('Error')).not.toBeInTheDocument()  // THROWS

// ✅ CORRECT: getBy* for positive assertions
expect(screen.getByText('Success')).toBeInTheDocument()

// ✅ CORRECT: findBy* for async elements
const element = await screen.findByText('Async content')
```

### Rule 5: Mock Heavy Dependencies

**REQUIRED**: Mock icon libraries, markdown renderers, and other heavy components.

```typescript
// ALWAYS mock lucide-react
vi.mock('lucide-react', () => ({
  Send: () => <div>Send</div>,
  User: () => <div>User</div>,
  // ... other icons used in component
}))

// ALWAYS mock complex renderers
vi.mock('./MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>
}))

// ALWAYS mock OAuth providers
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
```

### Rule 6: Test User Behavior, Not Implementation

**REQUIRED**: Focus on what users see and do.

```typescript
// ✅ CORRECT: User-centric testing
const input = screen.getByRole('textbox')
fireEvent.change(input, { target: { value: 'test' } })
fireEvent.submit(input.closest('form')!)
expect(screen.getByText('Submitted')).toBeInTheDocument()

// ❌ WRONG: Testing internals
expect(component.state.value).toBe('test')
expect(component.handleSubmit).toHaveBeenCalled()
```

## Agent Workflow for Writing Tests

### Step 1: Analyze Component

Before writing tests:
1. Identify user-facing features
2. List async operations (API calls, file reads)
3. Note global dependencies (fetch, localStorage, FileReader)
4. Check for heavy dependencies to mock

### Step 2: Set Up Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ComponentName from './ComponentName'

// Mock heavy dependencies FIRST
vi.mock('lucide-react', () => ({ /* ... */ }))

describe('ComponentName', () => {
  // Store originals for restoration
  const originalFetch = global.fetch
  
  // Define default props
  const defaultProps = {
    prop1: 'value1',
    onAction: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up mocks
  })

  afterEach(() => {
    // CRITICAL: Restore globals
    global.fetch = originalFetch
  })

  // Tests go here
})
```

### Step 3: Write Tests

Follow this pattern for each test:

```typescript
it('describes user behavior', async () => {
  // 1. Render component
  render(<Component {...defaultProps} />)
  
  // 2. Find elements using accessible queries
  const button = screen.getByRole('button', { name: /submit/i })
  
  // 3. Simulate user interaction
  fireEvent.click(button)
  
  // 4. Assert on visible changes (with waitFor if async)
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
})
```

## Common Scenarios and Solutions

### Scenario 1: Testing Fetch Calls

```typescript
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url === '/api/endpoint1') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: 'value' })
      } as Response)
    }
    // Default fallback
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    } as Response)
  })
})

afterEach(() => {
  global.fetch = originalFetch  // CRITICAL
})
```

### Scenario 2: Testing File Upload

```typescript
it('handles file upload', async () => {
  const mockFileReader = {
    readAsDataURL: vi.fn(function(this: any) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/png;base64,test' } })
        }
      }, 0)
    }),
    onload: null as any,
    onerror: null as any,
  }

  global.FileReader = vi.fn(function(this: any) {
    return mockFileReader
  }) as any

  const file = new File(['content'], 'test.png', { type: 'image/png' })
  const input = screen.getByLabelText('Upload file')

  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => {
    expect(screen.getByText('test.png')).toBeInTheDocument()
  }, { timeout: 2000 })
})
```

### Scenario 3: Testing Streaming Responses

```typescript
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  headers: new Headers({ 'X-Conversation-ID': 'test-123' }),
  body: {
    getReader: () => ({
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('Chunk 1')
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('Chunk 2')
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined
        })
    })
  }
} as any))
```

### Scenario 4: Testing localStorage

```typescript
let mockLocalStorage: Record<string, string> = {}

beforeEach(() => {
  mockLocalStorage = {}
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage[key]
    }),
    clear: vi.fn(() => {
      mockLocalStorage = {}
    }),
  })
})

// No need to restore - vi.stubGlobal handles it
```

### Scenario 5: Testing Clipboard Paste

```typescript
it('handles paste event', async () => {
  const mockFile = new File(['content'], 'pasted.png', { type: 'image/png' })
  const mockClipboardData = {
    items: [{
      type: 'image/png',
      getAsFile: () => mockFile
    }]
  }

  const textarea = screen.getByRole('textbox')
  fireEvent.paste(textarea, { clipboardData: mockClipboardData })

  await waitFor(() => {
    expect(screen.getByText('pasted.png')).toBeInTheDocument()
  })
})
```

## Debugging Failed Tests

### Step 1: Check Test Output

```typescript
// Add debug output
screen.debug()  // Shows entire DOM
screen.debug(screen.getByRole('button'))  // Shows specific element
```

### Step 2: Verify Queries

```typescript
// Check what's available
screen.logTestingPlaygroundURL()  // Opens browser with query suggestions

// List all roles
screen.getByRole('')  // Error message shows available roles
```

### Step 3: Check Async Timing

```typescript
// Increase timeout if needed
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
}, { timeout: 5000 })  // Default is 1000ms
```

### Step 4: Verify Mocks

```typescript
// Check if mock was called
expect(global.fetch).toHaveBeenCalledWith('/api/endpoint')

// Check mock implementation
console.log(vi.mocked(global.fetch).mock.calls)
```

## Code Review Checklist for Agents

When reviewing test code, verify:

### Critical Issues (Must Fix)
- [ ] All global mocks are restored in `afterEach`
- [ ] Async operations use `waitFor` or `findBy*`
- [ ] Negative assertions use `queryBy*` not `getBy*`
- [ ] No hardcoded `setTimeout` delays

### Best Practices (Should Fix)
- [ ] Queries follow accessibility-first pattern
- [ ] Heavy dependencies are mocked
- [ ] Tests focus on user behavior
- [ ] Test names describe user actions
- [ ] No implementation details tested

### Nice to Have (Consider)
- [ ] Tests are well-organized
- [ ] Good use of `describe` blocks
- [ ] Helpful comments for complex setups
- [ ] Consistent naming conventions

## Error Messages and Solutions

### "Unable to find role"

**Cause**: Element doesn't have expected role or isn't rendered.

**Solution**:
```typescript
// Debug what's available
screen.debug()
screen.getByRole('')  // Lists available roles

// Check if element exists at all
expect(screen.queryByText('Expected text')).toBeInTheDocument()
```

### "TestingLibraryElementError: Unable to find an element"

**Cause**: Element not in DOM or query is wrong.

**Solution**:
```typescript
// Use queryBy* to check existence
const element = screen.queryByText('Text')
if (!element) {
  screen.debug()  // See what's actually rendered
}

// For async elements, use waitFor
await waitFor(() => {
  expect(screen.getByText('Text')).toBeInTheDocument()
})
```

### "Cannot read properties of undefined"

**Cause**: Mock not set up correctly or global not restored.

**Solution**:
```typescript
// Ensure mock is set up before render
beforeEach(() => {
  global.fetch = vi.fn(/* ... */)
})

// Ensure restoration
afterEach(() => {
  global.fetch = originalFetch
})
```

### "Test timeout exceeded"

**Cause**: Async operation never completes or waitFor timeout too short.

**Solution**:
```typescript
// Increase timeout
await waitFor(() => {
  expect(screen.getByText('Text')).toBeInTheDocument()
}, { timeout: 5000 })

// Check if async operation is mocked correctly
console.log('Mock calls:', vi.mocked(global.fetch).mock.calls)
```

## Quick Reference

### Import Statement
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
```

### Query Priority
1. `getByRole` (best)
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByTestId` (last resort)

### Query Variants
- `getBy*` - Throws if not found (positive assertions)
- `queryBy*` - Returns null if not found (negative assertions)
- `findBy*` - Returns Promise, waits (async elements)

### Essential Patterns
```typescript
// Restore globals
const original = global.thing
afterEach(() => { global.thing = original })

// Wait for async
await waitFor(() => expect(screen.getByText('X')).toBeInTheDocument())

// Negative assertion
expect(screen.queryByText('X')).not.toBeInTheDocument()

// User interaction
fireEvent.click(screen.getByRole('button'))
fireEvent.change(input, { target: { value: 'text' } })
```



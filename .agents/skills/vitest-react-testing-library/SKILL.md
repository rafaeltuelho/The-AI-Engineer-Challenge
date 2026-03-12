---
name: vitest-react-testing-library
description: Comprehensive testing guidance for Vitest and React Testing Library in React + Vite + TypeScript projects. Use when writing component tests, debugging flaky tests, testing async behavior, handling jsdom limitations, or ensuring accessibility-first testing patterns. Covers user-centric interaction testing, fetch mocking, FileReader mocking, global restoration, and common pitfalls.
license: MIT
metadata:
  author: augment-code
  version: "1.0.0"
---
# Vitest + React Testing Library Skill

## Overview

This skill provides comprehensive guidance for writing robust, maintainable tests using Vitest and React Testing Library in this React + Vite + TypeScript stack.

## When to Use This Skill

Use this skill when:
- Writing new component tests
- Debugging flaky or failing tests
- Setting up test mocks and fixtures
- Testing async behavior and user interactions
- Working with jsdom limitations
- Ensuring accessibility-first testing patterns

## Stack Configuration

### Current Setup
- **Test Runner**: Vitest 4.0.18
- **Testing Library**: @testing-library/react 16.3.2
- **User Event**: @testing-library/user-event 14.6.1
- **Matchers**: @testing-library/jest-dom 6.9.1
- **Environment**: jsdom 28.1.0
- **TypeScript**: 5.2.2

### Vitest Configuration
```typescript
// vite.config.ts
test: {
  globals: true,           // Enable global test APIs (describe, it, expect, vi)
  environment: 'jsdom',    // Browser-like environment for React components
  setupFiles: './src/test/setup.ts',
}
```

### Setup File
```typescript
// frontend/src/test/setup.ts
import '@testing-library/jest-dom'  // Provides matchers like toBeInTheDocument()
```

## Core Testing Principles

### 1. Accessibility-First Querying

**Priority Order** (from Testing Library docs):
1. **Accessible to everyone**: `getByRole`, `getByLabelText`, `getByPlaceholderText`, `getByText`
2. **Semantic queries**: `getByAltText`, `getByTitle`
3. **Test IDs** (last resort): `getByTestId`

```typescript
// ✅ GOOD: Accessible queries
const button = screen.getByRole('button', { name: /submit/i })
const input = screen.getByLabelText('Email address')
const heading = screen.getByRole('heading', { name: /welcome/i })

// ❌ BAD: Test IDs should be last resort
const button = screen.getByTestId('submit-button')
```

### 2. User-Centric Interaction Testing

Test how users interact with your app, not implementation details.

```typescript
// ✅ GOOD: User-centric
import { fireEvent } from '@testing-library/react'

const textarea = screen.getByRole('textbox')
fireEvent.change(textarea, { target: { value: 'Hello' } })
fireEvent.submit(form)

// ❌ BAD: Testing implementation
expect(component.state.value).toBe('Hello')
```

### 3. Query Variants

- `getBy*`: Throws if not found (use for elements that should exist)
- `queryBy*`: Returns null if not found (use for asserting non-existence)
- `findBy*`: Returns Promise, waits for element (use for async)

```typescript
// Element should exist
expect(screen.getByText('Welcome')).toBeInTheDocument()

// Element should NOT exist
expect(screen.queryByText('Error')).not.toBeInTheDocument()

// Wait for async element
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

## Common Patterns in This Repo

### Pattern 1: Mock Setup with Global Restoration

**Critical**: Always restore original globals to prevent test pollution.

```typescript
describe('Component', () => {
  // Store originals OUTSIDE beforeEach
  const originalFetch = global.fetch
  const originalFileReader = global.FileReader

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up mocks
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    } as Response))
  })

  afterEach(() => {
    // CRITICAL: Restore to prevent leaks
    global.fetch = originalFetch
    global.FileReader = originalFileReader
  })
})
```

### Pattern 2: Mocking Fetch with Multiple Endpoints

```typescript
global.fetch = vi.fn((url) => {
  if (url === '/api/conversations') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    } as Response)
  }
  if (url === '/api/chat') {
    return Promise.resolve({
      ok: true,
      headers: new Headers({ 'X-Conversation-ID': 'test-123' }),
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Response') })
            .mockResolvedValueOnce({ done: true, value: undefined })
        })
      }
    } as any)
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)
})
```

### Pattern 3: Mocking FileReader for File Uploads

```typescript
const mockFileReader = {
  readAsDataURL: vi.fn(function(this: any) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: 'data:image/png;base64,fakedata' } })
      }
    }, 0)
  }),
  onload: null as any,
  onerror: null as any,
}

global.FileReader = vi.fn(function(this: any) {
  return mockFileReader
}) as any
```

### Pattern 4: Mocking Icon Libraries

Avoid rendering complex icon components in tests:

```typescript
// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Send: () => <div>Send</div>,
  MessageSquare: () => <div>MessageSquare</div>,
  User: () => <div>User</div>,
  // ... other icons
}))
```

### Pattern 5: Async Assertions with waitFor

```typescript
// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument()
}, { timeout: 2000 })

// Wait for multiple conditions
await waitFor(() => {
  expect(screen.getByText('First')).toBeInTheDocument()
  expect(screen.getByText('Second')).toBeInTheDocument()
})

// Find multiple elements
const images = screen.getAllByAltText('test.png')
expect(images.length).toBeGreaterThan(0)
```

### Pattern 6: Testing Form Interactions

```typescript
const textarea = screen.getByRole('textbox')
fireEvent.change(textarea, { target: { value: 'Test message' } })

const form = textarea.closest('form')!
fireEvent.submit(form)

await waitFor(() => {
  expect(screen.getByText('Test message')).toBeInTheDocument()
})
```

### Pattern 7: Mocking localStorage

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
```

## jsdom Limitations and Workarounds

### What jsdom Doesn't Support

1. **Layout and Rendering**: No actual layout engine
   - `getBoundingClientRect()` returns zeros
   - No CSS layout calculations
   - No actual rendering

2. **Some Web APIs**:
   - `IntersectionObserver` (needs manual mock)
   - `ResizeObserver` (needs manual mock)
   - `matchMedia` (needs manual mock)
   - Canvas API (limited support)

3. **Navigation**:
   - No actual page navigation
   - `window.location` is simulated

### Workarounds

```typescript
// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
} as any

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
```

## Avoiding Flaky Tests

### 1. Always Clean Up Mocks

```typescript
afterEach(() => {
  vi.clearAllMocks()  // Clear mock call history
  // Restore globals
  global.fetch = originalFetch
})
```

### 2. Use Proper Async Patterns

```typescript
// ✅ GOOD: Wait for async operations
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// ❌ BAD: Race condition
expect(screen.getByText('Loaded')).toBeInTheDocument()
```

### 3. Avoid Hardcoded Timeouts

```typescript
// ✅ GOOD: Use waitFor with reasonable timeout
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument()
}, { timeout: 2000 })

// ❌ BAD: Arbitrary setTimeout
await new Promise(resolve => setTimeout(resolve, 1000))
```

### 4. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  // Reset all state
  vi.clearAllMocks()
  mockLocalStorage = {}
})

afterEach(() => {
  // Clean up
  cleanup()  // RTL cleanup (usually automatic)
})
```

## Common Pitfalls in This Repo

### Pitfall 1: Leaked Global Mocks

**Problem**: Mocking `global.fetch` or `global.FileReader` without restoration causes tests to interfere with each other.

**Solution**: Always store originals and restore in `afterEach`:

```typescript
const originalFetch = global.fetch
const originalFileReader = global.FileReader

afterEach(() => {
  global.fetch = originalFetch
  global.FileReader = originalFileReader
})
```

### Pitfall 2: DOM API Gaps in jsdom

**Problem**: jsdom doesn't implement all browser APIs (e.g., `FileReader`, clipboard events).

**Solution**: Mock the missing APIs:

```typescript
// Mock clipboard paste
const mockClipboardData = {
  items: [{
    type: 'image/png',
    getAsFile: () => new File(['content'], 'test.png', { type: 'image/png' })
  }]
}

fireEvent.paste(textarea, { clipboardData: mockClipboardData })
```

### Pitfall 3: Incorrect Query Selection

**Problem**: Using `getBy*` for elements that might not exist causes test failures.

**Solution**: Use `queryBy*` for negative assertions:

```typescript
// ✅ GOOD: Element should NOT exist
expect(screen.queryByText('Error')).not.toBeInTheDocument()

// ❌ BAD: Throws error if not found
expect(screen.getByText('Error')).not.toBeInTheDocument()
```

### Pitfall 4: Not Waiting for Async Updates

**Problem**: Asserting on async state changes immediately causes flaky tests.

**Solution**: Always use `waitFor` or `findBy*`:

```typescript
// ✅ GOOD: Wait for async update
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// ✅ ALSO GOOD: findBy* waits automatically
const element = await screen.findByText('Loaded')
expect(element).toBeInTheDocument()
```

### Pitfall 5: Testing Implementation Details

**Problem**: Testing internal state or methods instead of user-visible behavior.

**Solution**: Test what users see and do:

```typescript
// ✅ GOOD: Test user behavior
fireEvent.click(screen.getByRole('button', { name: /submit/i }))
expect(screen.getByText('Success')).toBeInTheDocument()

// ❌ BAD: Testing internals
expect(component.state.submitted).toBe(true)
```

### Pitfall 6: Forgetting to Mock Dependencies

**Problem**: Complex components with many dependencies slow down tests.

**Solution**: Mock heavy dependencies:

```typescript
// Mock markdown renderer
vi.mock('./MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>
}))

// Mock OAuth provider
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
```

## Setup File Best Practices

### Minimal Setup

Keep `src/test/setup.ts` minimal:

```typescript
import '@testing-library/jest-dom'

// Only add global mocks that ALL tests need
// Test-specific mocks should go in individual test files
```

### When to Add to Setup File

Add to setup file only if:
- Used by 80%+ of tests
- Truly global (e.g., `@testing-library/jest-dom`)
- Prevents repetitive boilerplate

### When NOT to Add to Setup File

Don't add to setup file if:
- Only used by a few tests
- Test-specific behavior
- Makes debugging harder

## Testing Checklist

Before submitting tests, verify:

- [ ] All mocks are cleaned up in `afterEach`
- [ ] Global objects are restored (fetch, FileReader, localStorage)
- [ ] Async operations use `waitFor` or `findBy*`
- [ ] Queries follow accessibility-first pattern
- [ ] No hardcoded timeouts
- [ ] Tests are isolated (can run in any order)
- [ ] Negative assertions use `queryBy*`
- [ ] Heavy dependencies are mocked
- [ ] Tests focus on user behavior, not implementation

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Run specific test file
npx vitest run src/components/ChatInterface.test.tsx

# Run tests matching pattern
npx vitest run -t "image attachment"

# Run with coverage
npx vitest run --coverage
```

## Debugging Tests

### View Test Output

```typescript
// Log rendered HTML
import { screen } from '@testing-library/react'
screen.debug()  // Logs entire document
screen.debug(screen.getByRole('button'))  // Logs specific element
```

### Common Debug Commands

```typescript
// See what queries are available
screen.logTestingPlaygroundURL()

// Check if element exists
console.log(screen.queryByText('Test'))  // null if not found

// See all roles
screen.getByRole('')  // Error message lists all available roles
```

## Resources

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Docs](https://vitest.dev/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Query Priority](https://testing-library.com/docs/queries/about/#priority)



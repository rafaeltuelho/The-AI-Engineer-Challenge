---
name: frontend-accessibility-interaction-design
description: Frontend accessibility and interaction design guidelines for chat-heavy React UIs. Use when implementing or reviewing UI components, forms, modals, chat interfaces, image handling, or any user-facing interactive elements. Ensures WCAG compliance, keyboard navigation, screen reader support, and inclusive design patterns.
license: MIT
metadata:
  author: the-ai-engineer-challenge
  version: "1.0.0"
---
# Frontend Accessibility & Interaction Design

Comprehensive accessibility and interaction design guidelines for React-based chat applications. Ensures inclusive, keyboard-navigable, screen-reader-friendly interfaces that comply with WCAG 2.1 AA standards.

## When to Apply

Reference these guidelines when:

- Implementing chat interfaces, message displays, or conversation UIs
- Creating modals, dialogs, panels, or overlays
- Building forms with validation and error messaging
- Handling image uploads, attachments, or media content
- Implementing keyboard shortcuts or focus management
- Reviewing UI components for accessibility issues
- Ensuring visual clarity and contrast compliance

## Core Principles

### 1. Semantic HTML First

Use semantic HTML elements before reaching for ARIA attributes. Semantic elements provide built-in accessibility features and are better supported across assistive technologies.

**Incorrect: div soup with ARIA**

```tsx
<div role="button" onClick={handleClick} tabIndex={0}>
  Submit
</div>
```

**Correct: semantic button**

```tsx
<button onClick={handleClick}>
  Submit
</button>
```

### 2. Keyboard Navigation

All interactive elements must be keyboard accessible. Users should be able to navigate, activate, and interact with all features using only the keyboard.

**Required keyboard patterns:**

- `Tab` / `Shift+Tab`: Navigate between focusable elements
- `Enter` / `Space`: Activate buttons and controls
- `Escape`: Close modals, cancel operations
- `Arrow keys`: Navigate within composite widgets (menus, tabs, lists)

**Incorrect: onClick without keyboard support**

```tsx
<div onClick={handleDelete}>
  <Trash2 size={16} />
</div>
```

**Correct: button with keyboard support**

```tsx
<button
  onClick={handleDelete}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleDelete()
    }
  }}
  aria-label="Delete message"
>
  <Trash2 size={16} />
</button>
```

### 3. Focus Management

Manage focus explicitly when the UI changes significantly (modals open/close, content loads, errors appear).

**Modal focus pattern:**

```tsx
function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus modal
      modalRef.current?.focus()
    } else {
      // Restore focus when modal closes
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="modal"
    >
      {children}
    </div>
  )
}
```

## Chat Interface Patterns

### Message List Accessibility

Chat transcripts require special consideration for screen readers. Messages should be announced as they arrive, and the conversation history should be navigable.

**Accessible message list:**

```tsx
<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-label="Chat conversation"
  className="messages-container"
>
  {messages.map((msg) => (
    <div
      key={msg.id}
      role="article"
      aria-label={`Message from ${msg.role === 'user' ? 'you' : 'assistant'}`}
      className="message"
    >
      <div className="message-role" aria-hidden="true">
        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
      </div>
      <div className="message-content">
        {msg.content}
      </div>
    </div>
  ))}
</div>
```

### Input Field Accessibility

Chat input fields must be properly labeled and provide clear feedback about their state.

```tsx
<div className="input-container">
  <label htmlFor="chat-input" className="sr-only">
    Type your message
  </label>
  <textarea
    id="chat-input"
    value={inputMessage}
    onChange={(e) => setInputMessage(e.target.value)}
    onKeyDown={handleKeyDown}
    placeholder={
      !hasAccess
        ? "Free messages exhausted. Add your API key in Settings to continue."
        : "Type your message..."
    }
    aria-label="Chat message input"
    aria-describedby={!hasAccess ? "input-error" : undefined}
    aria-invalid={!hasAccess}
    disabled={isLoading || !hasAccess}
    rows={1}
  />
  {!hasAccess && (
    <div id="input-error" role="alert" className="error-message">
      Free messages exhausted. Add your API key in Settings to continue.
    </div>
  )}
  <button
    type="submit"
    disabled={isLoading || !inputMessage.trim() || !hasAccess}
    aria-label="Send message"
  >
    <Send size={16} />
    <span className="sr-only">Send</span>
  </button>
</div>
```

## Modal and Dialog Patterns

### Accessible Modal Structure

Modals must trap focus, be dismissible, and restore focus when closed.

```tsx
function SettingsModal({ isOpen, onClose }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus trap
  useEffect(() => {
    if (!isOpen) return

    const modal = modalRef.current
    if (!modal) return

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    modal.addEventListener('keydown', handleTab)
    return () => modal.removeEventListener('keydown', handleTab)
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className="modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <div className="modal-header">
          <h2 id="modal-title">Settings</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close settings"
            className="close-button"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          {/* Modal content */}
        </div>
      </div>
    </>
  )
}
```

## Form Patterns

### Accessible Form Fields

Forms must have proper labels, validation feedback, and error messaging.

```tsx
<div className="form-field">
  <label htmlFor="api-key" className="form-label">
    <Key size={16} aria-hidden="true" />
    <span>API Key</span>
  </label>
  <input
    id="api-key"
    type="password"
    value={apiKey}
    onChange={(e) => setApiKey(e.target.value)}
    aria-describedby="api-key-help api-key-error"
    aria-invalid={!!error}
    className="form-input"
  />
  <div id="api-key-help" className="form-help">
    Your API key is stored locally and never sent to our servers
  </div>
  {error && (
    <div id="api-key-error" role="alert" className="form-error">
      <AlertCircle size={14} aria-hidden="true" />
      <span>{error}</span>
    </div>
  )}
</div>
```

### Validation Messaging

Error messages must be announced to screen readers and clearly associated with their fields.

**Key patterns:**

- Use `role="alert"` for error messages to announce them immediately
- Use `aria-describedby` to associate errors with inputs
- Use `aria-invalid="true"` on invalid fields
- Provide clear, actionable error messages

```tsx
function FormField({ label, error, ...props }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const helpId = `${id}-help`

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-describedby={`${helpId} ${error ? errorId : ''}`}
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <div id={errorId} role="alert" className="error">
          {error}
        </div>
      )}
    </div>
  )
}
```


## Image and Media Handling

### Alt Text Requirements

All images must have meaningful alt text. Decorative images should use `alt=""` or `aria-hidden="true"`.

**Incorrect: missing alt text**

```tsx
<img src={user.avatar} />
```

**Correct: meaningful alt text**

```tsx
<img src={user.avatar} alt={`${user.name}'s profile picture`} />
```

**Decorative images:**

```tsx
<img src="/decorative-pattern.svg" alt="" aria-hidden="true" />
```

### Icon Accessibility

Icons used as buttons or conveying meaning must have accessible labels.

**Incorrect: icon without label**

```tsx
<button onClick={handleDelete}>
  <Trash2 size={16} />
</button>
```

**Correct: icon with accessible label**

```tsx
<button onClick={handleDelete} aria-label="Delete message">
  <Trash2 size={16} aria-hidden="true" />
</button>
```

**Alternative: visible text with icon**

```tsx
<button onClick={handleDelete}>
  <Trash2 size={16} aria-hidden="true" />
  <span>Delete</span>
</button>
```

### Image Upload Accessibility

File upload controls must be keyboard accessible and provide clear feedback.

```tsx
function ImageUpload({ onUpload, disabled }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }

    onUpload(file)
  }

  return (
    <div
      className={`upload-container ${isDragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
        }}
        disabled={disabled}
        className="sr-only"
        id="image-upload"
        aria-describedby="upload-help upload-error"
      />
      <label htmlFor="image-upload" className="upload-label">
        <Upload size={20} aria-hidden="true" />
        <span>Upload Image</span>
      </label>
      <div id="upload-help" className="upload-help">
        Drag and drop or click to upload. PNG, JPEG, WEBP, GIF up to 5MB.
      </div>
      {error && (
        <div id="upload-error" role="alert" className="upload-error">
          {error}
        </div>
      )}
    </div>
  )
}
```

## Visual Clarity and Contrast

### Color Contrast Requirements

Text must meet WCAG AA contrast ratios:
- Normal text (< 18pt): 4.5:1 minimum
- Large text (≥ 18pt or ≥ 14pt bold): 3:1 minimum
- UI components and graphics: 3:1 minimum

**Incorrect: white text on white background**

```css
.message {
  background: white;
  color: white; /* Fails contrast */
}
```

**Correct: sufficient contrast**

```css
.message {
  background: white;
  color: #1a1a1a; /* 16.1:1 contrast ratio */
}

.message-secondary {
  background: white;
  color: #666666; /* 5.7:1 contrast ratio */
}
```

### Focus Indicators

All interactive elements must have visible focus indicators.

```css
/* Default focus styles */
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Custom focus for specific components */
.chat-input:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: -2px;
  box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.1);
}
```

### Visual Feedback

Provide clear visual feedback for all interactive states.

```css
.button {
  /* Default state */
  background: #0066cc;
  color: white;
  transition: background 0.2s, transform 0.1s;
}

.button:hover {
  background: #0052a3;
}

.button:active {
  transform: scale(0.98);
}

.button:disabled {
  background: #cccccc;
  color: #666666;
  cursor: not-allowed;
  opacity: 0.6;
}

.button:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

## Screen Reader Utilities

### Visually Hidden Content

Use the `.sr-only` class for content that should be available to screen readers but hidden visually.

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**Usage:**

```tsx
<button>
  <Send size={16} aria-hidden="true" />
  <span className="sr-only">Send message</span>
</button>
```

### Skip Links

Provide skip links for keyboard users to bypass repetitive content.

```tsx
function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <ChatInterface />
      </main>
    </>
  )
}
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

## Testing Accessibility

### Automated Testing

Use automated tools to catch common accessibility issues:

```bash
# Install axe-core for automated testing
npm install --save-dev @axe-core/react

# In your test setup
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

// Test example
it('should have no accessibility violations', async () => {
  const { container } = render(<ChatInterface {...props} />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Manual Testing Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible on all focusable elements
- [ ] Tab order is logical and follows visual flow
- [ ] All images have appropriate alt text
- [ ] Form fields have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Color contrast meets WCAG AA standards
- [ ] Content is readable when zoomed to 200%
- [ ] Screen reader announces dynamic content changes
- [ ] Modals trap focus and restore it on close

### Screen Reader Testing

Test with actual screen readers:
- **macOS**: VoiceOver (Cmd+F5)
- **Windows**: NVDA (free) or JAWS
- **Mobile**: TalkBack (Android) or VoiceOver (iOS)

## Quick Reference

### ARIA Roles for Chat UIs

| Element | Role | Live Region |
|---------|------|-------------|
| Message list | `log` | `aria-live="polite"` |
| Loading indicator | `status` | `aria-live="polite"` |
| Error message | `alert` | `role="alert"` |
| Modal dialog | `dialog` | `aria-modal="true"` |
| Individual message | `article` | - |

### Common ARIA Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `aria-label` | Accessible name | `<button aria-label="Send message">` |
| `aria-labelledby` | Reference to label | `<div aria-labelledby="title-id">` |
| `aria-describedby` | Additional description | `<input aria-describedby="help-text">` |
| `aria-invalid` | Validation state | `<input aria-invalid="true">` |
| `aria-live` | Live region politeness | `<div aria-live="polite">` |
| `aria-hidden` | Hide from screen readers | `<span aria-hidden="true">` |
| `aria-expanded` | Expansion state | `<button aria-expanded="false">` |
| `aria-controls` | Controlled element | `<button aria-controls="panel-id">` |

## References

1. [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
2. [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
3. [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
4. [axe DevTools](https://www.deque.com/axe/devtools/)
5. [React Accessibility Documentation](https://react.dev/learn/accessibility)
6. [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)




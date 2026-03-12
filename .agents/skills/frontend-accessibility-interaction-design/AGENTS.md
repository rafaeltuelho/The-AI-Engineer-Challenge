# Frontend Accessibility & Interaction Design

**Version 1.0.0**  
The AI Engineer Challenge  
March 2026

> **Note:**  
> This document provides agent-focused instructions for implementing accessible,
> inclusive React UIs. Optimized for AI-assisted development of chat interfaces,
> forms, modals, and interactive components.

---

## Abstract

Comprehensive accessibility and interaction design guidelines for React-based chat applications. Ensures WCAG 2.1 AA compliance, keyboard navigation, screen reader support, and inclusive design patterns. Covers chat-specific patterns, modal focus management, form validation, image handling, contrast requirements, and upload UX.

---

## Agent Instructions

### When to Apply This Skill

Apply these guidelines when:

1. **Creating or modifying UI components** - Any user-facing React component
2. **Implementing forms** - Input fields, validation, error messaging
3. **Building modals or dialogs** - Settings panels, confirmations, overlays
4. **Handling media** - Image uploads, attachments, alt text
5. **Chat interfaces** - Message lists, input areas, loading states
6. **Reviewing accessibility** - Code review, refactoring, bug fixes

### Priority Levels

**CRITICAL (Must Fix):**
- Missing keyboard navigation
- No focus management in modals
- Missing alt text on informative images
- Insufficient color contrast (< 4.5:1 for text)
- Form fields without labels
- Error messages not announced to screen readers

**HIGH (Should Fix):**
- Missing ARIA labels on icon buttons
- No visible focus indicators
- Improper heading hierarchy
- Missing live regions for dynamic content
- Disabled elements without explanation

**MEDIUM (Nice to Have):**
- Skip links for keyboard users
- Enhanced focus styles
- Optimized screen reader announcements
- Improved error message clarity

### Implementation Workflow

1. **Start with semantic HTML** - Use `<button>`, `<input>`, `<label>` before ARIA
2. **Add keyboard support** - Ensure Tab, Enter, Escape work correctly
3. **Implement focus management** - Especially for modals and dynamic content
4. **Add ARIA attributes** - Only when semantic HTML isn't sufficient
5. **Test with keyboard** - Navigate without mouse
6. **Verify contrast** - Use browser DevTools or online checkers
7. **Test with screen reader** - VoiceOver (Mac) or NVDA (Windows)

### Code Generation Guidelines

When generating React components:

**Always include:**
- Semantic HTML elements (`<button>`, `<label>`, `<input>`)
- Keyboard event handlers (`onKeyDown` for Enter/Escape)
- ARIA labels for icon-only buttons
- `aria-describedby` for form fields with help text
- `role="alert"` for error messages
- Focus management in modals (useEffect with focus/blur)

**Never do:**
- Use `<div>` with `onClick` without keyboard support
- Create buttons without accessible labels
- Implement modals without focus trapping
- Add images without alt text
- Use color alone to convey information
- Create forms without proper labels

### Chat Interface Specifics

For chat UIs, always:

```tsx
// Message list with live region
<div role="log" aria-live="polite" aria-atomic="false">
  {messages.map(msg => (
    <div key={msg.id} role="article" aria-label={`Message from ${msg.role}`}>
      {msg.content}
    </div>
  ))}
</div>

// Loading indicator
{isLoading && (
  <div role="status" aria-live="polite">
    <span className="sr-only">AI is generating a response</span>
  </div>
)}

// Input with proper labeling
<textarea
  aria-label="Chat message input"
  aria-describedby={error ? "input-error" : undefined}
  aria-invalid={!!error}
/>
```

### Modal Implementation Pattern

Always implement modals with this structure:

```tsx
function Modal({ isOpen, onClose }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  
  // Focus management
  useEffect(() => {
    if (isOpen) {
      const previousFocus = document.activeElement as HTMLElement
      modalRef.current?.focus()
      
      return () => previousFocus?.focus()
    }
  }, [isOpen])
  
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <h2 id="modal-title">Modal Title</h2>
        {/* Content */}
      </div>
    </>
  )
}
```

### Form Validation Pattern

Always implement form validation with this structure:

```tsx
<div className="form-field">
  <label htmlFor="field-id">Field Label</label>
  <input
    id="field-id"
    aria-describedby="field-help field-error"
    aria-invalid={!!error}
  />
  <div id="field-help">Help text</div>
  {error && (
    <div id="field-error" role="alert">
      {error}
    </div>
  )}
</div>
```

### Contrast and Visual Clarity

Per project frontend rules:

- **Never** place white text on white background
- **Always** ensure minimum 4.5:1 contrast for normal text
- **Always** ensure minimum 3:1 contrast for large text and UI components
- **Always** provide visible focus indicators
- **Always** ensure boxes grow to fit content (pleasant UX)

### Testing Checklist for Agents

Before marking work complete, verify:

- [ ] All buttons are keyboard accessible (Tab + Enter/Space)
- [ ] Modals trap focus and close on Escape
- [ ] Form fields have associated labels
- [ ] Error messages use `role="alert"`
- [ ] Images have alt text (or `alt=""` if decorative)
- [ ] Icon buttons have `aria-label`
- [ ] Color contrast meets 4.5:1 minimum
- [ ] Focus indicators are visible
- [ ] Dynamic content has appropriate `aria-live`

---

## Common Patterns Reference

### Icon Button
```tsx
<button aria-label="Delete message">
  <Trash2 size={16} aria-hidden="true" />
</button>
```

### Form Field with Error
```tsx
<input
  id="api-key"
  type="password"
  aria-describedby="help error"
  aria-invalid={!!error}
/>
{error && <div id="error" role="alert">{error}</div>}
```

### Upload Control
```tsx
<input
  type="file"
  id="upload"
  className="sr-only"
  accept="image/*"
/>
<label htmlFor="upload">Upload Image</label>
```

### Loading State
```tsx
<div role="status" aria-live="polite">
  <span className="sr-only">Loading...</span>
</div>
```

---

## Complementary to Vercel React Skill

This skill focuses on **accessibility and interaction design**, while the Vercel React skill focuses on **performance optimization**. Use both together:

- **Vercel React**: Bundle size, waterfalls, re-renders, server-side performance
- **This skill**: Keyboard navigation, screen readers, ARIA, contrast, focus management

Both skills are essential for production-ready React applications.

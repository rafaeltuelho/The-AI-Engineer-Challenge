---
name: fastapi-pydantic-best-practices
description: FastAPI and Pydantic best practices for building secure, performant, and maintainable APIs. This skill should be used when writing, reviewing, or refactoring FastAPI endpoints, Pydantic models, authentication, validation, error handling, or testing patterns. Triggers on tasks involving API development, request/response modeling, data validation, security, or backend optimization.
license: MIT
metadata:
  author: the-ai-engineer-challenge
  version: "1.0.0"
---
# FastAPI + Pydantic Best Practices

Comprehensive guide for building production-ready FastAPI applications with Pydantic. Contains practical patterns for request/response modeling, validation, authentication, error handling, and testing.

## When to Apply

Reference these guidelines when:

- Writing new FastAPI endpoints or routes
- Creating or updating Pydantic models
- Implementing request/response validation
- Adding authentication or authorization
- Handling file uploads or image processing
- Writing API tests with pytest
- Reviewing code for security or performance issues
- Implementing rate limiting or session management

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Security & Authentication | CRITICAL | security- |
| 2 | Request/Response Modeling | HIGH | model- |
| 3 | Validation Patterns | HIGH | validation- |
| 4 | Error Handling | MEDIUM-HIGH | error- |
| 5 | File & Image Processing | MEDIUM | file- |
| 6 | Performance & Optimization | MEDIUM | perf- |
| 7 | Testing Patterns | MEDIUM | test- |
| 8 | API Design | LOW-MEDIUM | api- |

## Quick Reference

### 1. Security & Authentication (CRITICAL)

- `security-session-validation` - Always validate session in endpoints
- `security-api-key-handling` - Never log or expose API keys
- `security-rate-limiting` - Apply rate limits to all public endpoints
- `security-input-sanitization` - Sanitize and validate all user inputs
- `security-cors-configuration` - Configure CORS restrictively

### 2. Request/Response Modeling (HIGH)

- `model-field-validators` - Use field_validator for single-field validation
- `model-model-validators` - Use model_validator for cross-field validation
- `model-optional-fields` - Use Optional[] with defaults for optional fields
- `model-response-models` - Always specify response_model in endpoints
- `model-nested-models` - Use nested Pydantic models for complex data

### 3. Validation Patterns (HIGH)

- `validation-string-length` - Validate string length limits
- `validation-enum-choices` - Use Literal or Enum for fixed choices
- `validation-email-format` - Validate email format properly
- `validation-file-types` - Validate file extensions and MIME types
- `validation-size-limits` - Enforce size limits on uploads and requests

### 4. Error Handling (MEDIUM-HIGH)

- `error-http-exceptions` - Use HTTPException with proper status codes
- `error-validation-errors` - Return clear validation error messages
- `error-logging` - Log errors with context, not sensitive data
- `error-exception-handlers` - Use custom exception handlers for consistency
- `error-try-catch` - Wrap external calls in try-catch blocks

### 5. File & Image Processing (MEDIUM)

- `file-upload-validation` - Validate file size before processing
- `file-temp-cleanup` - Always clean up temporary files
- `file-content-type` - Verify content type, not just extension
- `file-async-processing` - Use async for I/O-bound file operations
- `file-streaming` - Use StreamingResponse for large files

### 6. Performance & Optimization (MEDIUM)

- `perf-async-endpoints` - Use async def for I/O-bound endpoints
- `perf-dependency-injection` - Use FastAPI dependencies for reusable logic
- `perf-response-caching` - Cache expensive computations
- `perf-database-connections` - Use connection pooling
- `perf-lazy-imports` - Import heavy dependencies only when needed

### 7. Testing Patterns (MEDIUM)

- `test-client-fixture` - Use TestClient for endpoint testing
- `test-mock-dependencies` - Mock external dependencies
- `test-parametrize` - Use pytest.mark.parametrize for multiple cases
- `test-async-tests` - Use pytest-asyncio for async endpoints
- `test-coverage` - Aim for high coverage on critical paths

### 8. API Design (LOW-MEDIUM)

- `api-versioning` - Version your API endpoints
- `api-consistent-naming` - Use consistent naming conventions
- `api-openapi-docs` - Provide clear OpenAPI documentation
- `api-pagination` - Implement pagination for list endpoints
- `api-idempotency` - Make POST/PUT operations idempotent

## How to Use

Read the full compiled document for detailed explanations and code examples: `AGENTS.md`

Each rule includes:

- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references specific to this codebase

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`


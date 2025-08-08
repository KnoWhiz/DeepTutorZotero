# Claude Backend Proxy Specification

## Overview

This document specifies the backend endpoints needed to integrate Claude API with DeepTutor. The backend will act as a proxy between the frontend and the company's Claude proxy server, providing security, authentication, and request routing.

## Architecture

```
Frontend (Zotero Extension) → Backend API → Company Claude Proxy → Anthropic Claude API
```

## Backend Endpoints

### Base URL
```
/api/claude
```

### 1. POST /api/claude/messages/create
**Purpose**: Create a non-streaming Claude message

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Request-Type: claude
X-DeepTutor-Source: zotero-extension
```

**Request Body**:
```json
{
  "message": "User's message content",
  "conversationContext": {
    "messages": [
      {
        "role": "user",
        "content": "Previous user message"
      },
      {
        "role": "assistant", 
        "content": "Previous assistant response"
      }
    ],
    "context": {
      "sessionId": "session_123",
      "userId": "user_456",
      "sessionType": "BASIC",
      "storagePaths": ["path1", "path2"]
    }
  },
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "stream": false
}
```

**Response**:
```json
{
  "id": "msg_123",
  "content": "Claude's response",
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input_tokens": 25,
    "output_tokens": 13
  },
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

### 2. POST /api/claude/messages/stream
**Purpose**: Create a streaming Claude message

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
Accept: text/event-stream
X-Request-Type: claude
X-DeepTutor-Source: zotero-extension
```

**Request Body**: Same as create endpoint, but with `"stream": true`

**Response**: Server-Sent Events (SSE) stream
```
data: {"type": "content_block_delta", "delta": {"type": "text", "text": "Hello"}}

data: {"type": "content_block_delta", "delta": {"type": "text", "text": " world"}}

data: {"type": "message_stop", "message": {"id": "msg_123", "content": "Hello world"}}
```

### 3. POST /api/claude/messages/batches/create
**Purpose**: Create a batch of Claude messages

**Request Body**:
```json
{
  "requests": [
    {
      "custom_id": "request_1",
      "params": {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [
          {
            "role": "user",
            "content": "First question"
          }
        ]
      }
    },
    {
      "custom_id": "request_2", 
      "params": {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "messages": [
          {
            "role": "user",
            "content": "Second question"
          }
        ]
      }
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024
}
```

**Response**:
```json
{
  "id": "batch_123",
  "processing_status": "started",
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

### 4. GET /api/claude/messages/batches/{batchId}/results
**Purpose**: Get results from a Claude message batch

**Response**: Server-Sent Events stream with batch results
```
data: {"custom_id": "request_1", "result": {"type": "succeeded", "message": {"content": "Response 1"}}}

data: {"custom_id": "request_2", "result": {"type": "succeeded", "message": {"content": "Response 2"}}}
```

### 5. GET /api/claude/health
**Purpose**: Check Claude proxy health status

**Response**:
```json
{
  "status": "healthy",
  "claude_proxy_status": "connected",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

## Backend Implementation Requirements

### 1. Authentication & Authorization
- Validate JWT tokens from frontend
- Forward authentication to company Claude proxy if required
- Handle token refresh and retry logic

### 2. Request Routing
- Route requests to company Claude proxy server
- Add necessary headers for company proxy authentication
- Handle CORS and security headers

### 3. Error Handling
- Handle Claude API errors gracefully
- Provide meaningful error messages to frontend
- Implement retry logic for transient failures

### 4. Logging & Monitoring
- Log all Claude API requests and responses
- Monitor response times and error rates
- Track usage metrics

### 5. Configuration
- Environment variables for Claude proxy URL and API keys
- Configurable timeouts and retry settings
- Feature flags for enabling/disabling Claude integration

## Environment Variables

```bash
# Claude Proxy Configuration
CLAUDE_PROXY_URL=https://your-company-claude-proxy.com
CLAUDE_API_KEY=your-claude-api-key
CLAUDE_PROXY_TIMEOUT=30000
CLAUDE_MAX_RETRIES=3

# Feature Flags
ENABLE_CLAUDE_INTEGRATION=true
CLAUDE_FALLBACK_ENABLED=true
```

## Security Considerations

### 1. API Key Management
- Store Claude API keys securely on backend
- Never expose API keys to frontend
- Rotate API keys regularly

### 2. Request Validation
- Validate all incoming requests
- Sanitize user input
- Implement rate limiting

### 3. CORS Configuration
- Configure CORS headers appropriately
- Allow only trusted origins

## Error Response Format

```json
{
  "error": {
    "code": "CLAUDE_API_ERROR",
    "message": "Failed to connect to Claude API",
    "details": {
      "status_code": 500,
      "claude_error": "Internal server error"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Integration with Existing DeepTutor Backend

### 1. Add to Existing API Routes
- Extend current API router to include `/api/claude/*` routes
- Maintain existing authentication middleware
- Use existing error handling patterns

### 2. Database Integration
- Optionally log Claude requests to existing database
- Track usage for billing/analytics
- Maintain conversation history

### 3. Session Management
- Use existing session management for Claude requests
- Maintain conversation context across requests
- Handle user preferences for Claude vs DeepTutor

## Testing Requirements

### 1. Unit Tests
- Test request/response parsing
- Test error handling
- Test authentication flow

### 2. Integration Tests
- Test end-to-end Claude API calls
- Test streaming functionality
- Test fallback mechanisms

### 3. Load Tests
- Test concurrent Claude requests
- Test streaming performance
- Test error recovery

## Deployment Considerations

### 1. Environment Setup
- Configure Claude proxy URL for each environment
- Set appropriate API keys
- Configure monitoring and logging

### 2. Rollout Strategy
- Deploy with feature flags
- Gradual rollout to users
- Monitor performance and errors

### 3. Monitoring
- Set up alerts for Claude API failures
- Monitor response times
- Track usage patterns

## Migration Plan

### Phase 1: Backend Implementation
1. Implement Claude proxy endpoints
2. Add configuration and environment variables
3. Implement error handling and logging
4. Add health check endpoint

### Phase 2: Frontend Integration
1. Update frontend to use new Claude endpoints
2. Add Claude/DeepTutor selection logic
3. Implement fallback mechanisms
4. Add UI controls for Claude usage

### Phase 3: Testing & Rollout
1. Comprehensive testing
2. Gradual rollout to users
3. Monitor performance and errors
4. Gather user feedback

### Phase 4: Optimization
1. Performance optimization
2. Error handling improvements
3. User experience enhancements
4. Advanced features (batching, etc.)

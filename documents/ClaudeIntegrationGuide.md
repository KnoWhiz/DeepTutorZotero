# Claude Integration Guide for DeepTutor

## Overview

This guide provides step-by-step instructions for integrating Claude API into your existing DeepTutor system.

## Prerequisites

1. Backend team has implemented the Claude proxy endpoints (see `ClaudeBackendProxySpec.md`)
2. Company Claude proxy server is configured and accessible
3. Environment variables are set up

## Step 1: Update Your Existing DeepTutorChatBox

### Option A: Replace sendToAPI Function

In your existing `DeepTutorChatBox.js`, replace the `sendToAPI` function:

```javascript
// Replace this:
const sendToAPI = async (message) => {
    // ... existing code
};

// With this:
import { sendToAPIWithClaude } from './DeepTutorChatBoxClaude.js';

const sendToAPI = async (message) => {
    return await sendToAPIWithClaude(message, conversation);
};
```

### Option B: Add Claude Toggle

Add a UI toggle to let users choose between DeepTutor and Claude:

```javascript
// Add state for Claude toggle
const [useClaude, setUseClaude] = useState(false);

// Add UI toggle
const ClaudeToggle = () => (
    <div className="claude-toggle">
        <label>
            <input 
                type="checkbox" 
                checked={useClaude} 
                onChange={(e) => setUseClaude(e.target.checked)}
            />
            Use Claude AI
        </label>
    </div>
);

// Modify sendToAPI to use the toggle
const sendToAPI = async (message) => {
    if (useClaude) {
        return await sendToAPIWithClaude(message, conversation);
    } else {
        // Use existing DeepTutor logic
        return await sendToDeepTutorAPI(message, conversation);
    }
};
```

## Step 2: Add Claude Configuration

Add configuration options to your existing code:

```javascript
// Add to your existing configuration
const CLAUDE_CONFIG = {
    ENABLED: true,
    USE_CLAUDE_BY_DEFAULT: false,
    FALLBACK_TO_DEEPTUTOR: true,
    CLAUDE_PROMPT_PREFIX: "You are a helpful AI tutor. Please respond to the user's question: "
};

// Add to your component state
const [claudeEnabled, setClaudeEnabled] = useState(CLAUDE_CONFIG.ENABLED);
```

## Step 3: Add Claude Health Check

Add a health check to ensure Claude is available:

```javascript
// Add to your component
useEffect(() => {
    const checkClaudeHealth = async () => {
        try {
            const health = await checkClaudeProxyHealth();
            setClaudeEnabled(health.status === 'healthy');
        } catch (error) {
            console.error('Claude health check failed:', error);
            setClaudeEnabled(false);
        }
    };

    if (CLAUDE_CONFIG.ENABLED) {
        checkClaudeHealth();
    }
}, []);
```

## Step 4: Add Claude UI Indicators

Add visual indicators to show when Claude is being used:

```javascript
// Add to your message rendering logic
const renderMessage = (message) => {
    const isClaude = message.source === 'claude';
    const senderName = isClaude ? 'Claude' : 'DeepTutor';
    
    return (
        <div className={`message ${isClaude ? 'claude-message' : 'deeptutor-message'}`}>
            <div className="message-header">
                <span className="sender">{senderName}</span>
                {isClaude && <span className="claude-badge">Claude AI</span>}
            </div>
            <div className="message-content">
                {message.subMessages[0].text}
            </div>
        </div>
    );
};
```

## Step 5: Add Claude Trigger Keywords

Allow users to trigger Claude with keywords:

```javascript
// Add to your message processing
const shouldUseClaude = (messageText) => {
    const claudeKeywords = ['[claude]', '[use claude]', '[claude ai]'];
    return claudeKeywords.some(keyword => 
        messageText.toLowerCase().includes(keyword)
    );
};

// Modify your send message function
const handleSend = async () => {
    const messageText = inputValue.trim();
    const useClaude = shouldUseClaude(messageText);
    
    // Remove trigger keywords from the actual message
    const cleanMessage = messageText
        .replace(/\[claude\]/gi, '')
        .replace(/\[use claude\]/gi, '')
        .replace(/\[claude ai\]/gi, '')
        .trim();
    
    if (cleanMessage) {
        setInputValue('');
        await userSendMessage(cleanMessage, useClaude);
    }
};
```

## Step 6: Add Error Handling and Fallback

Add robust error handling:

```javascript
const sendToAPIWithFallback = async (message, useClaude) => {
    try {
        if (useClaude && claudeEnabled) {
            return await sendToClaudeAPI(message, conversation);
        } else {
            return await sendToDeepTutorAPI(message, conversation);
        }
    } catch (error) {
        console.error('API call failed:', error);
        
        // Fallback logic
        if (useClaude && CLAUDE_CONFIG.FALLBACK_TO_DEEPTUTOR) {
            console.log('Claude failed, falling back to DeepTutor');
            return await sendToDeepTutorAPI(message, conversation);
        }
        
        throw error;
    }
};
```

## Step 7: Add Claude Settings UI

Add a settings panel for Claude configuration:

```javascript
const ClaudeSettings = () => (
    <div className="claude-settings">
        <h3>Claude AI Settings</h3>
        <div className="setting-item">
            <label>
                <input 
                    type="checkbox" 
                    checked={claudeEnabled} 
                    onChange={(e) => setClaudeEnabled(e.target.checked)}
                />
                Enable Claude AI
            </label>
        </div>
        <div className="setting-item">
            <label>
                <input 
                    type="checkbox" 
                    checked={CLAUDE_CONFIG.USE_CLAUDE_BY_DEFAULT} 
                    onChange={(e) => updateConfig('USE_CLAUDE_BY_DEFAULT', e.target.checked)}
                />
                Use Claude by default
            </label>
        </div>
        <div className="setting-item">
            <label>
                <input 
                    type="checkbox" 
                    checked={CLAUDE_CONFIG.FALLBACK_TO_DEEPTUTOR} 
                    onChange={(e) => updateConfig('FALLBACK_TO_DEEPTUTOR', e.target.checked)}
                />
                Fallback to DeepTutor if Claude fails
            </label>
        </div>
    </div>
);
```

## Step 8: Add Claude Usage Tracking

Track Claude usage for analytics:

```javascript
const trackClaudeUsage = (message, response) => {
    // Send usage data to your analytics
    const usageData = {
        timestamp: new Date().toISOString(),
        userId: userId,
        sessionId: sessionId,
        messageLength: message.subMessages[0].text.length,
        responseLength: response.content?.length || 0,
        model: 'claude-sonnet-4-20250514',
        source: 'zotero-extension'
    };
    
    // Send to your analytics endpoint
    fetch('/api/analytics/claude-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usageData)
    }).catch(console.error);
};
```

## Step 9: Testing the Integration

### Test Cases

1. **Basic Claude Integration**
   ```javascript
   // Test with trigger keyword
   await userSendMessage("Hello [claude], how are you?");
   // Should use Claude API
   ```

2. **Fallback Testing**
   ```javascript
   // Test fallback when Claude fails
   // Mock Claude API to fail
   // Should fallback to DeepTutor
   ```

3. **Health Check Testing**
   ```javascript
   // Test health check
   const health = await checkClaudeProxyHealth();
   console.log('Claude health:', health);
   ```

4. **Streaming Testing**
   ```javascript
   // Test streaming responses
   // Verify SSE parsing works correctly
   ```

## Step 10: Deployment Checklist

### Backend Requirements
- [ ] Claude proxy endpoints implemented
- [ ] Environment variables configured
- [ ] Authentication working
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Health check endpoint working

### Frontend Requirements
- [ ] Claude API integration added
- [ ] UI controls implemented
- [ ] Error handling added
- [ ] Fallback logic working
- [ ] Health checks implemented
- [ ] Usage tracking added

### Testing Requirements
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] Load tests completed
- [ ] User acceptance testing done

## Troubleshooting

### Common Issues

1. **Claude API not responding**
   - Check backend Claude proxy configuration
   - Verify API keys are set correctly
   - Check network connectivity

2. **Streaming not working**
   - Verify SSE parsing logic
   - Check response format from Claude API
   - Ensure proper error handling

3. **Authentication errors**
   - Verify JWT tokens are valid
   - Check authorization headers
   - Ensure token refresh logic works

4. **Fallback not working**
   - Check fallback configuration
   - Verify DeepTutor API is accessible
   - Test error detection logic

### Debug Commands

```javascript
// Check Claude health
const health = await checkClaudeProxyHealth();
console.log('Claude health:', health);

// Test Claude message creation
const response = await createClaudeMessage("Test message");
console.log('Claude response:', response);

// Test streaming
const stream = await subscribeToClaudeStream("Test streaming");
console.log('Stream response:', stream);
```

## Performance Considerations

1. **Caching**: Cache Claude responses for similar queries
2. **Rate Limiting**: Implement rate limiting for Claude API calls
3. **Connection Pooling**: Reuse connections to Claude proxy
4. **Response Time Monitoring**: Track and optimize response times

## Security Considerations

1. **API Key Security**: Never expose Claude API keys in frontend
2. **Request Validation**: Validate all user input
3. **Rate Limiting**: Prevent abuse of Claude API
4. **Logging**: Log all Claude API interactions for audit

## Future Enhancements

1. **Advanced Prompting**: Add system prompts and context management
2. **Batch Processing**: Implement batch requests for multiple queries
3. **Model Selection**: Allow users to choose different Claude models
4. **Conversation Memory**: Implement long-term conversation memory
5. **File Upload**: Add support for file uploads to Claude
6. **Tool Use**: Implement Claude's tool use capabilities

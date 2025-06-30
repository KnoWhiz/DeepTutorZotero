# DeepTutor Localhost Server

This document describes the localhost server functionality that is automatically started when DeepTutor runs. The server provides an API endpoint that allows external applications to send text messages to DeepTutor, which will be displayed as popups.

## Overview

The localhost server is a simple HTTP server that runs on port 3001 by default. It provides a REST API endpoint called `sendText` that accepts POST requests with text content and displays it as a popup in the DeepTutor interface.

## Features

- **Automatic Startup**: The server starts automatically when DeepTutor is initialized
- **Cross-Platform Support**: Works in Firefox/Thunderbird (XPCOM), Node.js, and browser environments
- **Popup Display**: Shows received text in a styled popup with close functionality
- **Health Check**: Provides a health endpoint for monitoring server status
- **CORS Support**: Includes proper CORS headers for cross-origin requests

## API Endpoints

### POST /sendText

Sends text to be displayed as a popup in DeepTutor.

**Request:**
```json
{
  "text": "Your message here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Text received and popup displayed",
  "receivedText": "Your message here"
}
```

### GET /health

Checks the health status of the server.

**Response:**
```json
{
  "status": "healthy",
  "server": "DeepTutor Localhost Server",
  "port": 3001,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### 1. Using curl from command line

```bash
curl -X POST http://localhost:3001/sendText \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from command line!"}'
```

### 2. Using JavaScript fetch API

```javascript
const response = await fetch("http://localhost:3001/sendText", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ text: "Hello from JavaScript!" })
});

const result = await response.json();
console.log(result);
```

### 3. Using Python requests

```python
import requests

response = requests.post(
    "http://localhost:3001/sendText",
    json={"text": "Hello from Python!"}
)

print(response.json())
```

### 4. Programmatically from within DeepTutor

```javascript
// Import the test functions
import { sendTextFromDeepTutor } from './testLocalhostServer.js';

// Send text programmatically
await sendTextFromDeepTutor("Hello from DeepTutor!");
```

## Server Configuration

### Port Configuration

The server runs on port 3001 by default. You can change this by modifying the constructor call in `DeepTutor.jsx`:

```javascript
// In DeepTutor.jsx constructor
this.localhostServer = new DeepTutorLocalhostServer(3002); // Custom port
```

### Environment Detection

The server automatically detects the environment and uses the appropriate implementation:

- **Firefox/Thunderbird**: Uses XPCOM for native HTTP server functionality
- **Node.js**: Uses Node.js built-in HTTP server
- **Browser**: Uses polling mechanism with localStorage as fallback

## Popup Features

The popup that displays received text includes:

- **Styled Design**: Matches DeepTutor's visual theme with blue accent colors
- **Close Button**: X button in the top-right corner
- **Auto-Close**: Automatically disappears after 10 seconds
- **Scrollable Content**: Handles long text with scrollbars
- **XSS Protection**: HTML content is properly escaped
- **Responsive**: Adapts to different screen sizes

## Error Handling

The server includes comprehensive error handling:

- **Invalid JSON**: Returns 400 error for malformed requests
- **Missing Text**: Uses default message if no text provided
- **Server Errors**: Returns 500 error for internal server issues
- **Network Issues**: Graceful handling of connection problems

## Testing

Use the provided test functions in `testLocalhostServer.js` to verify functionality:

```javascript
import { testLocalhostServer } from './testLocalhostServer.js';

// Run all tests
await testLocalhostServer();

// Test specific functionality
await testSendTextViaFetch();
await testHealthEndpoint();
```

## Security Considerations

- **Localhost Only**: Server only accepts connections from localhost
- **No Authentication**: Intended for local development and testing
- **XSS Protection**: All displayed text is HTML-escaped
- **CORS Headers**: Properly configured for cross-origin requests

## Troubleshooting

### Server Won't Start

1. Check if port 3001 is already in use
2. Verify that the environment supports HTTP server creation
3. Check browser console for error messages

### Popup Not Displaying

1. Verify the server is running by calling the health endpoint
2. Check that the request is properly formatted
3. Look for JavaScript errors in the browser console

### Connection Refused

1. Ensure DeepTutor is running and the server has started
2. Check firewall settings
3. Verify the correct port is being used

## Integration with External Applications

The localhost server allows external applications to communicate with DeepTutor:

### Example: Integration with Python Script

```python
import requests
import time

def send_message_to_deeptutor(message):
    try:
        response = requests.post(
            "http://localhost:3001/sendText",
            json={"text": message},
            timeout=5
        )
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error sending message: {e}")
        return None

# Send a message
result = send_message_to_deeptutor("Processing complete!")
if result and result.get("success"):
    print("Message sent successfully")
```

### Example: Integration with Shell Script

```bash
#!/bin/bash

send_message() {
    local message="$1"
    curl -X POST http://localhost:3001/sendText \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"$message\"}" \
        -s
}

# Send a message
send_message "Backup completed successfully!"
```

## License

This localhost server is part of DeepTutor and is licensed under the GNU Affero General Public License v3.0. 
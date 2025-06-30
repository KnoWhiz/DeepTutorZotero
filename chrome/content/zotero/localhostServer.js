/**
 * Localhost Server for DeepTutor
 * 
 * This module provides a simple HTTP server that runs on localhost
 * and displays popups when it receives API calls to the "sendText" endpoint.
 * 
 * @author DeepTutor Team
 * @license GNU Affero General Public License v3.0
 */

"use strict";

/**
 * DeepTutor Localhost Server Class
 * 
 * Creates and manages a local HTTP server that listens for API calls
 * and displays popups with the received text content.
 */
class DeepTutorLocalhostServer {
	/**
	 * Constructor for the localhost server
	 * @param {number} port - The port number to run the server on (default: 3001)
	 */
	constructor(port = 3017) {
		this.port = port;
		this.server = null;
		this.isRunning = false;
		this.serverUrl = `http://localhost:${this.port}`;
	}

	/**
	 * Starts the localhost server
	 * @returns {Promise<boolean>} - Returns true if server started successfully
	 */
	async start() {
		try {
			Zotero.debug(`DeepTutor: Starting localhost server on port ${this.port}`);

			// Check if we're in a browser environment with HTTP server capabilities
			if (typeof Components !== "undefined" && Components.classes) {
				// Firefox/Thunderbird environment - use XPCOM
				await this.startXPCOMServer();
			} else if (typeof require !== "undefined") {
				// Node.js environment
				await this.startNodeServer();
			} else {
				// Browser environment - use Service Worker or alternative
				await this.startBrowserServer();
			}

			this.isRunning = true;
			Zotero.debug(`DeepTutor: Localhost server started successfully at ${this.serverUrl}`);
			return true;
		} catch (error) {
			Zotero.debug(`DeepTutor: Failed to start localhost server: ${error.message}`);
			return false;
		}
	}

	/**
	 * Starts server using XPCOM (Firefox/Thunderbird environment)
	 * @returns {Promise<void>}
	 */
	async startXPCOMServer() {
		return new Promise((resolve, reject) => {
			try {
				// Create HTTP server using XPCOM
				const serverSocket = Components.classes["@mozilla.org/network/server-socket;1"]
					.createInstance(Components.interfaces.nsIServerSocket);
				
				serverSocket.init(this.port, false, -1);
				
				// Create listener for incoming connections
				const listener = {
					onSocketAccepted: (socket, transport) => {
						this.handleXPCOMConnection(socket, transport);
					},
					onStopListening: (socket, status) => {
						Zotero.debug(`DeepTutor: Server stopped listening: ${status}`);
					}
				};
				
				serverSocket.asyncListen(listener);
				this.server = serverSocket;
				
				Zotero.debug(`DeepTutor: XPCOM server listening on port ${this.port}`);
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Handles incoming connections in XPCOM environment
	 * @param {Object} socket - The socket object
	 * @param {Object} transport - The transport object
	 */
	handleXPCOMConnection(socket, transport) {
		try {
			const inputStream = transport.openInputStream(0, 0, 0);
			const outputStream = transport.openOutputStream(0, 0, 0);
			
			// Read the HTTP request
			const requestData = this.readInputStream(inputStream);
			
			// Parse the request
			const request = this.parseHTTPRequest(requestData);
			
			// Handle the request
			this.handleRequest(request, outputStream);
			
			// Close streams
			inputStream.close();
			outputStream.close();
		} catch (error) {
			Zotero.debug(`DeepTutor: Error handling XPCOM connection: ${error.message}`);
		}
	}

	/**
	 * Starts server using Node.js (if available)
	 * @returns {Promise<void>}
	 */
	async startNodeServer() {
		return new Promise((resolve, reject) => {
			try {
				const http = require("http");
				
				this.server = http.createServer((req, res) => {
					this.handleNodeRequest(req, res);
				});
				
				this.server.listen(this.port, () => {
					Zotero.debug(`DeepTutor: Node.js server listening on port ${this.port}`);
					resolve();
				});
				
				this.server.on("error", (error) => {
					Zotero.debug(`DeepTutor: Node.js server error: ${error.message}`);
					reject(error);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Starts server using browser APIs (Service Worker or alternative)
	 * @returns {Promise<void>}
	 */
	async startBrowserServer() {
		return new Promise((resolve, reject) => {
			try {
				// For browser environments, we'll use a polling mechanism
				// or WebSocket as a fallback since direct HTTP server creation
				// is not available in standard browser environments
				
				Zotero.debug("DeepTutor: Browser environment detected, using polling mechanism");
				
				// Set up polling to check for messages
				this.startPolling();
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Starts polling mechanism for browser environments
	 */
	startPolling() {
		// Store messages in localStorage for polling
		if (!window.deepTutorMessages) {
			window.deepTutorMessages = [];
		}
		
		// Poll for new messages every 1 second
		setInterval(() => {
			if (window.deepTutorMessages && window.deepTutorMessages.length > 0) {
				const message = window.deepTutorMessages.shift();
				this.displayPopup(message);
			}
		}, 1000);
		
		Zotero.debug("DeepTutor: Polling mechanism started");
	}

	/**
	 * Handles Node.js HTTP requests
	 * @param {Object} req - The request object
	 * @param {Object} res - The response object
	 */
	handleNodeRequest(req, res) {
		try {
			// Set CORS headers
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			
			if (req.method === "OPTIONS") {
				res.writeHead(200);
				res.end();
				return;
			}
			
			// Handle different endpoints
			if (req.url === "/sendText" && req.method === "POST") {
				this.handleSendTextRequest(req, res);
			} else if (req.url === "/health" && req.method === "GET") {
				this.handleHealthRequest(req, res);
			} else {
				this.handleNotFoundRequest(req, res);
			}
		} catch (error) {
			Zotero.debug(`DeepTutor: Error handling Node.js request: ${error.message}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Internal server error" }));
		}
	}

	/**
	 * Handles the sendText API endpoint
	 * @param {Object} req - The request object
	 * @param {Object} res - The response object
	 */
	handleSendTextRequest(req, res) {
		let body = "";
		
		req.on("data", (chunk) => {
			body += chunk.toString();
		});
		
		req.on("end", () => {
			try {
				const data = JSON.parse(body);
				const text = data.text || data.message || data.content || "No text provided";
				
				Zotero.debug(`DeepTutor: Received sendText request with text: ${text}`);
				
				// Display popup with the text
				this.displayPopup(text);
				
				// Send success response
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ 
					success: true, 
					message: "Text received and popup displayed",
					receivedText: text 
				}));
			} catch (error) {
				Zotero.debug(`DeepTutor: Error parsing sendText request: ${error.message}`);
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
			}
		});
	}

	/**
	 * Handles health check requests
	 * @param {Object} req - The request object
	 * @param {Object} res - The response object
	 */
	handleHealthRequest(req, res) {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ 
			status: "healthy", 
			server: "DeepTutor Localhost Server",
			port: this.port,
			timestamp: new Date().toISOString()
		}));
	}

	/**
	 * Handles 404 requests
	 * @param {Object} req - The request object
	 * @param {Object} res - The response object
	 */
	handleNotFoundRequest(req, res) {
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ 
			error: "Endpoint not found",
			availableEndpoints: ["/sendText", "/health"]
		}));
	}

	/**
	 * Displays a popup with the given text
	 * @param {string} text - The text to display in the popup
	 */
	displayPopup(text) {
		try {
			Zotero.debug(`DeepTutor: Displaying popup with text: ${text}`);
			
			// Create popup content
			const popupContent = `
				<div style="
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					background: white;
					border: 2px solid #0687E5;
					border-radius: 10px;
					padding: 20px;
					box-shadow: 0 4px 20px rgba(0,0,0,0.3);
					z-index: 10000;
					max-width: 400px;
					max-height: 300px;
					overflow: auto;
					font-family: Arial, sans-serif;
				">
					<div style="
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 15px;
						border-bottom: 1px solid #eee;
						padding-bottom: 10px;
					">
						<h3 style="
							margin: 0;
							color: #0687E5;
							font-size: 18px;
						">DeepTutor Message</h3>
						<button onclick="this.parentElement.parentElement.remove()" style="
							background: none;
							border: none;
							font-size: 20px;
							cursor: pointer;
							color: #999;
							padding: 0;
							width: 25px;
							height: 25px;
							display: flex;
							align-items: center;
							justify-content: center;
						">×</button>
					</div>
					<div style="
						color: #333;
						line-height: 1.5;
						white-space: pre-wrap;
						word-wrap: break-word;
					">${this.escapeHtml(text)}</div>
					<div style="
						text-align: center;
						margin-top: 15px;
						padding-top: 10px;
						border-top: 1px solid #eee;
					">
						<button onclick="this.parentElement.parentElement.remove()" style="
							background: #0687E5;
							color: white;
							border: none;
							padding: 8px 16px;
							border-radius: 5px;
							cursor: pointer;
							font-size: 14px;
						">Close</button>
					</div>
				</div>
			`;
			
			// Create and append popup element
			const popupElement = document.createElement("div");
			popupElement.innerHTML = popupContent;
			document.body.appendChild(popupElement.firstElementChild);
			
			// Auto-remove popup after 10 seconds
			setTimeout(() => {
				if (popupElement.firstElementChild && popupElement.firstElementChild.parentNode) {
					popupElement.firstElementChild.remove();
				}
			}, 10000);
			
		} catch (error) {
			Zotero.debug(`DeepTutor: Error displaying popup: ${error.message}`);
			
			// Fallback: use Zotero alert
			try {
				Zotero.alert(null, "DeepTutor Message", text);
			} catch (alertError) {
				Zotero.debug(`DeepTutor: Error showing Zotero alert: ${alertError.message}`);
			}
		}
	}

	/**
	 * Escapes HTML to prevent XSS
	 * @param {string} text - The text to escape
	 * @returns {string} - The escaped text
	 */
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Reads data from an input stream (XPCOM)
	 * @param {Object} inputStream - The input stream to read from
	 * @returns {string} - The read data
	 */
	readInputStream(inputStream) {
		const scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
			.createInstance(Components.interfaces.nsIScriptableInputStream);
		scriptableStream.init(inputStream);
		
		let data = "";
		let chunk;
		while ((chunk = scriptableStream.read(4096)) !== "") {
			data += chunk;
		}
		
		return data;
	}

	/**
	 * Parses HTTP request data
	 * @param {string} requestData - The raw HTTP request data
	 * @returns {Object} - The parsed request object
	 */
	parseHTTPRequest(requestData) {
		const lines = requestData.split("\r\n");
		const requestLine = lines[0].split(" ");
		
		return {
			method: requestLine[0],
			url: requestLine[1],
			version: requestLine[2],
			headers: this.parseHeaders(lines.slice(1)),
			body: this.extractBody(requestData)
		};
	}

	/**
	 * Parses HTTP headers
	 * @param {Array} headerLines - The header lines to parse
	 * @returns {Object} - The parsed headers
	 */
	parseHeaders(headerLines) {
		const headers = {};
		
		for (const line of headerLines) {
			if (line === "") break;
			
			const colonIndex = line.indexOf(":");
			if (colonIndex !== -1) {
				const key = line.substring(0, colonIndex).trim();
				const value = line.substring(colonIndex + 1).trim();
				headers[key.toLowerCase()] = value;
			}
		}
		
		return headers;
	}

	/**
	 * Extracts body from HTTP request
	 * @param {string} requestData - The raw HTTP request data
	 * @returns {string} - The request body
	 */
	extractBody(requestData) {
		const bodyIndex = requestData.indexOf("\r\n\r\n");
		return bodyIndex !== -1 ? requestData.substring(bodyIndex + 4) : "";
	}

	/**
	 * Stops the localhost server
	 * @returns {Promise<boolean>} - Returns true if server stopped successfully
	 */
	async stop() {
		try {
			Zotero.debug("DeepTutor: Stopping localhost server");
			
			if (this.server) {
				if (this.server.close) {
					// Node.js server
					this.server.close();
				} else if (this.server.close) {
					// XPCOM server
					this.server.close();
				}
			}
			
			this.server = null;
			this.isRunning = false;
			
			Zotero.debug("DeepTutor: Localhost server stopped successfully");
			return true;
		} catch (error) {
			Zotero.debug(`DeepTutor: Error stopping localhost server: ${error.message}`);
			return false;
		}
	}

	/**
	 * Gets the server URL
	 * @returns {string} - The server URL
	 */
	getServerUrl() {
		return this.serverUrl;
	}

	/**
	 * Checks if the server is running
	 * @returns {boolean} - True if server is running
	 */
	isServerRunning() {
		return this.isRunning;
	}

	/**
	 * Provides a method to send text via the API (for testing)
	 * @param {string} text - The text to send
	 * @returns {Promise<Object>} - The response from the server
	 */
	async sendText(text) {
		try {
			const response = await fetch(`${this.serverUrl}/sendText`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ text })
			});
			
			return await response.json();
		} catch (error) {
			Zotero.debug(`DeepTutor: Error sending text via API: ${error.message}`);
			throw error;
		}
	}
}

// Export the server class
if (typeof module !== "undefined" && module.exports) {
	module.exports = DeepTutorLocalhostServer;
} else if (typeof window !== "undefined") {
	window.DeepTutorLocalhostServer = DeepTutorLocalhostServer;
} 
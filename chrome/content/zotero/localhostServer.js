/**
 * DeepTutor Localhost Server Integration
 *
 * This module integrates with Zotero's existing HTTP server infrastructure
 * to provide a "sendText" endpoint that displays popups when called.
 *
 * @author DeepTutor Team
 * @license GNU Affero General Public License v3.0
 */

"use strict";

/**
 * DeepTutor Localhost Server Class
 *
 * Integrates with Zotero's existing HTTP server to provide text messaging functionality.
 */

class DeepTutorLocalhostServer {
	/**
	 * Constructor for the DeepTutor server integration
	 * @param {number} port - The port number (default: 3017, but uses Zotero's server port)
	 */
	constructor(port = 3017) {
		this.port = port;
		this.isRunning = false;
		this.serverUrl = null;
		this.endpointRegistered = false;
	}

	/**
	 * Starts the DeepTutor server integration
	 * @returns {Promise<boolean>} - Returns true if integration started successfully
	 */
	async start() {
		try {
			console.log("🚀 DeepTutor: Starting server integration...");
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Starting server integration`);
			}

			// Check if Zotero.Server is available
			if (typeof Zotero === "undefined" || !Zotero.Server) {
				console.error("❌ DeepTutor: Zotero.Server not available");
				return false;
			}

			// Initialize Zotero's HTTP server if not already running
			if (!Zotero.Server.port) {
				console.log("🔧 DeepTutor: Initializing Zotero HTTP server...");
				Zotero.Server.init(this.port);
			}

			// Wait a moment for server to start
			await new Promise(resolve => setTimeout(resolve, 100));

			// Check if server is running
			if (!Zotero.Server.port) {
				console.error("❌ DeepTutor: Failed to start Zotero HTTP server");
				return false;
			}

			// Register our endpoint
			this.registerEndpoint();

			// Set server URL
			this.serverUrl = `http://localhost:${Zotero.Server.port}`;
			this.isRunning = true;

			console.log("✅ DeepTutor: Server integration started successfully!");
			console.log("📍 Server URL:", this.serverUrl);
			console.log("🔗 Available endpoints:");
			console.log("   - POST /deeptutor/sendText      - Send text to display as popup");
			console.log("   - POST /deeptutor/googleOauthCode - Receive Google OAuth code");
			console.log("   - GET  /deeptutor/health        - Check server status");
			console.log("🧪 Test with: curl http://localhost:" + Zotero.Server.port + "/deeptutor/health");
			
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Server integration started successfully at ${this.serverUrl}`);
			}
			return true;
		} catch (error) {
			console.error("❌ DeepTutor: Failed to start server integration:", error.message);
			console.error("❌ DeepTutor: Error stack:", error.stack);
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Failed to start server integration: ${error.message}`);
			}
			return false;
		}
	}

	/**
	 * Registers the DeepTutor endpoints with Zotero's HTTP server
	 */
	registerEndpoint() {
		if (this.endpointRegistered) {
			console.log("🔧 DeepTutor: Endpoints already registered");
			return;
		}

		console.log("🔧 DeepTutor: Registering endpoints with Zotero HTTP server...");

		// Check if Zotero.Server.Endpoints exists
		if (!Zotero.Server.Endpoints) {
			console.error("❌ DeepTutor: Zotero.Server.Endpoints not available");
			return;
		}

		// Register sendText endpoint
		Zotero.Server.Connector.DeepTutorSendText = function() {};
		Zotero.Server.Endpoints["/deeptutor/sendText"] = Zotero.Server.Connector.DeepTutorSendText;
		Zotero.Server.Connector.DeepTutorSendText.prototype = {
			supportedMethods: ["POST", "OPTIONS"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: true,
			
			init: function(request) {
				console.log("📨 DeepTutor: Received sendText request");
				
			if (request.method !== "POST") {
					return [405, "text/plain", "Method not allowed"];
				}

				try {
					const data = request.data;
					if (!data || !data.text) {
						return [400, "application/json", JSON.stringify({
							error: "Missing 'text' field in request body"
						})];
					}

					const text = data.text;
					console.log("📨 DeepTutor: Received text:", text.substring(0, 50) + (text.length > 50 ? "..." : ""));
					
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Received sendText request with text: ${text}`);
					}

					// Display popup with the text
					this.displayPopup(text);

					return [200, "application/json", JSON.stringify({
						success: true,
						message: "Text received and popup displayed",
						receivedText: text
					})];
				} catch (error) {
					console.error("❌ DeepTutor: Error processing sendText request:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Internal server error"
					})];
				}
			},
			
			displayPopup: function(text) {
				try {
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Displaying popup with text: ${text}`);
					}

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
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Error displaying popup: ${error.message}`);
					}

					// Fallback: use Zotero alert
					try {
						Zotero.alert(null, "DeepTutor Message", text);
					} catch (alertError) {
						if (typeof Zotero !== "undefined") {
							Zotero.debug(`DeepTutor: Error showing Zotero alert: ${alertError.message}`);
						}
					}
				}
			},
			
			escapeHtml: function(text) {
				const div = document.createElement("div");
				div.textContent = text;
				return div.innerHTML;
			}
		};

		// Register googleOauthCode endpoint
		Zotero.Server.Connector.DeepTutorGoogleOauthCode = function() {};
		Zotero.Server.Endpoints["/deeptutor/googleOauthCode"] = Zotero.Server.Connector.DeepTutorGoogleOauthCode;
		Zotero.Server.Connector.DeepTutorGoogleOauthCode.prototype = {
			supportedMethods: ["POST", "OPTIONS"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: true,
			
			init: function(request) {
				console.log("🔐 DeepTutor: Received googleOauthCode request");
				
				if (request.method !== "POST") {
					return [405, "text/plain", "Method not allowed"];
				}

				try {
					const data = request.data;
					if (!data || !data.oauthCode) {
						return [400, "application/json", JSON.stringify({
							error: "Missing 'code' field in request body"
						})];
					}

					const code = data.oauthCode;
					console.log("🔐 DeepTutor: Received OAuth code:", code.substring(0, 20) + (code.length > 20 ? "..." : ""));
					
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Received googleOauthCode request with code: ${code}`);
					}

					// Display popup with the OAuth code
					this.displayPopup(code);

					return [200, "application/json", JSON.stringify({
						success: true,
						message: "OAuth code received and popup displayed",
						receivedCode: code
					})];
				} catch (error) {
					console.error("❌ DeepTutor: Error processing googleOauthCode request:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Internal server error"
					})];
				}
			},
			
			displayPopup: function(code) {
				try {
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Displaying OAuth code popup: ${code}`);
					}

					// Create popup content
					const popupContent = `
						<div style="
							position: fixed;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							background: white;
							border: 2px solid #4285F4;
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
									color: #4285F4;
									font-size: 18px;
								">Google OAuth Code</h3>
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
								font-family: monospace;
								background: #f5f5f5;
								padding: 10px;
								border-radius: 5px;
								border: 1px solid #ddd;
							">${this.escapeHtml(code)}</div>
							<div style="
								text-align: center;
								margin-top: 15px;
								padding-top: 10px;
								border-top: 1px solid #eee;
							">
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: #4285F4;
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
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Error displaying OAuth code popup: ${error.message}`);
					}

					// Fallback: use Zotero alert
					try {
						Zotero.alert(null, "Google OAuth Code", code);
					} catch (alertError) {
						if (typeof Zotero !== "undefined") {
							Zotero.debug(`DeepTutor: Error showing Zotero alert: ${alertError.message}`);
						}
					}
				}
			},
			
			escapeHtml: function(text) {
				const div = document.createElement("div");
				div.textContent = text;
				return div.innerHTML;
			}
		};

		// Register health endpoint
		Zotero.Server.Connector.DeepTutorHealth = function() {};
		Zotero.Server.Endpoints["/deeptutor/health"] = Zotero.Server.Connector.DeepTutorHealth;
		Zotero.Server.Connector.DeepTutorHealth.prototype = {
			supportedMethods: ["GET", "OPTIONS"],
			permitBookmarklet: true,
			
			init: function(_request) {
				console.log("🏥 DeepTutor: Health check request received");

				const healthData = {
					status: "healthy",
					server: "DeepTutor Integration with Zotero HTTP Server",
					port: Zotero.Server.port,
					timestamp: new Date().toISOString(),
					endpoints: Object.keys(Zotero.Server.Endpoints).filter(key => key.startsWith('/deeptutor/'))
				};

				return [200, "application/json", JSON.stringify(healthData)];
			}
		};

		this.endpointRegistered = true;
		console.log("✅ DeepTutor: Endpoints registered successfully");
		console.log("📋 Registered endpoints:", Object.keys(Zotero.Server.Endpoints).filter(key => key.startsWith('/deeptutor/')));
	}

	/**
	 * Stops the DeepTutor server integration
	 * @returns {Promise<boolean>} - Returns true if integration stopped successfully
	 */
	async stop() {
		try {
			console.log("🛑 DeepTutor: Stopping server integration");

			// Remove our endpoints
			if (this.endpointRegistered) {
				delete Zotero.Server.Endpoints["/deeptutor/sendText"];
				delete Zotero.Server.Endpoints["/deeptutor/googleOauthCode"];
				delete Zotero.Server.Endpoints["/deeptutor/health"];
				this.endpointRegistered = false;
				console.log("🔧 DeepTutor: Endpoints removed");
			}

			this.isRunning = false;
			this.serverUrl = null;

			console.log("✅ DeepTutor: Server integration stopped successfully");
			if (typeof Zotero !== "undefined") {
				Zotero.debug("DeepTutor: Server integration stopped successfully");
			}
			return true;
		} catch (error) {
			console.error(`DeepTutor: Error stopping server integration: ${error.message}`);
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Error stopping server integration: ${error.message}`);
			}
			return false;
		}
	}

	/**
	 * Gets the server URL
	 * @returns {string} - The server URL
	 */
	getServerUrl() {
		return this.serverUrl || `http://localhost:${Zotero.Server?.port || this.port}`;
	}

	/**
	 * Checks if the server integration is running
	 * @returns {boolean} - True if integration is running
	 */
	isServerRunning() {
		return this.isRunning && !!Zotero.Server?.port;
	}

	/**
	 * Provides a method to send text via the API (for testing)
	 * @param {string} text - The text to send
	 * @returns {Promise<Object>} - The response from the server
	 */
	async sendText(text) {
		try {
			if (!this.isRunning) {
				throw new Error("Server integration not running");
			}

			const response = await fetch(`${this.getServerUrl()}/deeptutor/sendText`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ text })
			});

			return await response.json();
		} catch (error) {
			console.error(`DeepTutor: Error sending text via API: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Provides a method to send OAuth code via the API (for testing)
	 * @param {string} code - The OAuth code to send
	 * @returns {Promise<Object>} - The response from the server
	 */
	async sendOAuthCode(code) {
		try {
			if (!this.isRunning) {
				throw new Error("Server integration not running");
			}

			const response = await fetch(`${this.getServerUrl()}/deeptutor/googleOauthCode`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ code })
			});

			return await response.json();
		} catch (error) {
			console.error(`DeepTutor: Error sending OAuth code via API: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Gets a list of all available endpoints
	 * @returns {Array<string>} - Array of endpoint paths
	 */
	getAvailableEndpoints() {
		if (!Zotero.Server || !Zotero.Server.Endpoints) {
			return [];
		}
		return Object.keys(Zotero.Server.Endpoints);
	}

	/**
	 * Gets DeepTutor-specific endpoints
	 * @returns {Array<string>} - Array of DeepTutor endpoint paths
	 */
	getDeepTutorEndpoints() {
		if (!Zotero.Server || !Zotero.Server.Endpoints) {
			return [];
		}
		return Object.keys(Zotero.Server.Endpoints).filter(key => key.startsWith('/deeptutor/'));
	}
}

// Export the server class
if (typeof module !== "undefined" && module.exports) {
	module.exports = DeepTutorLocalhostServer;
} else if (typeof window !== "undefined") {
	window.DeepTutorLocalhostServer = DeepTutorLocalhostServer;
}

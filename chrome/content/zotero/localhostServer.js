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

// Import the completeAuth function from DeepTutorGoogleAuthScript
let completeAuth = null;
try {
	const authScript = require('./DeepTutorGoogleAuthScript.js');
	completeAuth = authScript.completeAuth;
} catch (error) {
	console.log("🔐 DeepTutor: Could not import completeAuth function:", error.message);
}

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
		this.googleOAuthEnabled = false; // Flag to control Google OAuth endpoint availability
	}

	/**
	 * Enables the Google OAuth endpoint (called when Google sign-in popup is shown)
	 */
	enableGoogleOAuth() {
		this.googleOAuthEnabled = true;
		console.log("🔐 DeepTutor: Google OAuth endpoint enabled");
		if (typeof Zotero !== "undefined") {
			Zotero.debug("DeepTutor: Google OAuth endpoint enabled");
		}
	}

	/**
	 * Disables the Google OAuth endpoint (called when Google sign-in popup is closed)
	 */
	disableGoogleOAuth() {
		this.googleOAuthEnabled = false;
		console.log("🔐 DeepTutor: Google OAuth endpoint disabled");
		if (typeof Zotero !== "undefined") {
			Zotero.debug("DeepTutor: Google OAuth endpoint disabled");
		}
	}



	/**
	 * Handles OAuth code authentication by calling the existing completeAuth function
	 * @param {string} authCode - The authorization code received from Google
	 * @returns {Promise<Object>} - Returns the authentication result
	 */
	async handleOAuthCode(authCode) {
		try {
			console.log("🔐 DeepTutor: Processing OAuth code for authentication");
			
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Processing OAuth code for authentication`);
			}

			// Check if the completeAuth function is available
			if (!completeAuth) {
				console.log("🔐 DeepTutor: completeAuth function not available, using fallback");
				return {
					success: false,
					error: "Authentication system not available"
				};
			}

			// Call the imported completeAuth function
			console.log("🔐 DeepTutor: Calling completeAuth function with code");
			completeAuth(authCode);

			console.log("🔐 DeepTutor: Authentication completed successfully");
			
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Authentication completed successfully`);
			}

			return {
				success: true,
				message: "Authentication completed successfully"
			};
		} catch (error) {
			console.error("❌ DeepTutor: OAuth code authentication failed:", error.message);
			
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: OAuth code authentication failed: ${error.message}`);
			}

			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Opens the Google sign-in URL in the default browser
	 * @returns {Promise<boolean>} - Returns true if URL was opened successfully
	 */
	async openGoogleSignInUrl() {
		try {
			const url = "https://staging.deeptutor.knowhiz.us/dzGoogleSignIn";
			console.log("🌐 DeepTutor: Opening Google sign-in URL:", url);
			
			if (typeof Zotero !== "undefined") {
				Zotero.debug(`DeepTutor: Opening Google sign-in URL: ${url}`);
			}

			// Try multiple methods to open the URL
			try {
				// Primary: Use Zotero's proper API for opening external URLs
				Zotero.launchURL(url);
				console.log("✅ DeepTutor: Successfully opened Google sign-in URL");
				return true;
			} catch (error) {
				console.error("❌ DeepTutor: Failed to open URL with Zotero.launchURL:", error.message);
				
				// Fallback: Try XPCOM nsIExternalProtocolService
				try {
					if (typeof Cc !== "undefined" && typeof Ci !== "undefined") {
						const extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
							.getService(Ci.nsIExternalProtocolService);
						const uri = Cc["@mozilla.org/network/io-service;1"]
							.getService(Ci.nsIIOService)
							.newURI(url, null, null);
						extps.loadURI(uri);
						console.log("✅ DeepTutor: Successfully opened URL via XPCOM");
						return true;
					}
				} catch (fallbackError) {
					console.error("❌ DeepTutor: Failed to open URL with XPCOM:", fallbackError.message);
				}
				
				// Final fallback: Copy URL to clipboard
				if (navigator.clipboard) {
					await navigator.clipboard.writeText(url);
					console.log("📋 DeepTutor: Copied Google sign-in URL to clipboard");
					if (typeof Zotero !== "undefined") {
						Zotero.alert(null, "DeepTutor", "Google sign-in URL copied to clipboard!\nPlease paste it in your browser to access the sign-in page.");
					}
					return true;
				}
				
				return false;
			}
		} catch (error) {
			console.error("❌ DeepTutor: Error opening Google sign-in URL:", error.message);
			return false;
		}
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
			server: this, // Reference to the server instance
			supportedMethods: ["POST", "OPTIONS"],
			supportedDataTypes: ["application/json"],
			permitBookmarklet: true,
			
			init: async function(request) {
				console.log("🔐 DeepTutor: Received googleOauthCode request");
				
				if (request.method !== "POST") {
					return [405, "text/plain", "Method not allowed"];
				}

				// Check if Google OAuth endpoint is enabled
				if (!this.server || !this.server.googleOAuthEnabled) {
					console.log("🔐 DeepTutor: Google OAuth endpoint is disabled");
					return [403, "application/json", JSON.stringify({
						error: "Google OAuth endpoint is not available. Please start the Google sign-in process first."
					})];
				}

				try {
					const data = request.data;
					// Accept both 'code' and 'oauthCode' field names for flexibility
					const oauthCode = data?.oauthCode || data?.code;
					
					if (!oauthCode) {
						return [400, "application/json", JSON.stringify({
							error: "Missing 'code' or 'oauthCode' field in request body"
						})];
					}

					console.log("🔐 DeepTutor: Received OAuth code:", oauthCode.substring(0, 20) + (oauthCode.length > 20 ? "..." : ""));
					
					if (typeof Zotero !== "undefined") {
						Zotero.debug(`DeepTutor: Received googleOauthCode request with code: ${oauthCode}`);
					}

					// Process the OAuth code for authentication
					const authResult = await this.server.handleOAuthCode(oauthCode);

					if (authResult.success) {
						console.log("🔐 DeepTutor: OAuth authentication successful");
						
						// Display success popup
						this.displayAuthSuccessPopup(authResult.user);

						return [200, "application/json", JSON.stringify({
							success: true,
							message: "OAuth authentication successful",
							user: {
								email: authResult.user.username,
								name: authResult.user.attributes.name
							}
						})];
					} else {
						console.error("❌ DeepTutor: OAuth authentication failed:", authResult.error);
						
						// Display error popup
						this.displayAuthErrorPopup(authResult.error);

						return [400, "application/json", JSON.stringify({
							success: false,
							error: authResult.error
						})];
					}
				} catch (error) {
					console.error("❌ DeepTutor: Error processing googleOauthCode request:", error.message);
					return [500, "application/json", JSON.stringify({
						error: "Internal server error"
					})];
				}
			},
			
			displayAuthSuccessPopup: function(user) {
				try {
					// Check if we're in a DOM environment
					if (typeof document === "undefined" || !document.body) {
						console.log("🔐 DeepTutor: No DOM available, using Zotero alert for success");
						if (typeof Zotero !== "undefined") {
							Zotero.alert(null, "Google Sign-In Success",
								`Successfully signed in as: ${user.username}\nName: ${user.attributes.name}`);
						}
						return;
					}

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
								">Google Sign-In Success</h3>
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
							">
								Signed in as: <b>${user.username}</b><br/>
								Name: ${user.attributes.name}
							</div>
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

					const popupElement = document.createElement("div");
					popupElement.innerHTML = popupContent;
					document.body.appendChild(popupElement.firstElementChild);

					setTimeout(() => {
						if (popupElement.firstElementChild && popupElement.firstElementChild.parentNode) {
							popupElement.firstElementChild.remove();
						}
					}, 10000);
				} catch (error) {
					console.error("❌ DeepTutor: Error displaying auth success popup:", error.message);
					// Fallback to Zotero alert
					if (typeof Zotero !== "undefined") {
						Zotero.alert(null, "Google Sign-In Success",
							`Successfully signed in as: ${user.username}\nName: ${user.attributes.name}`);
					}
				}
			},

			displayAuthErrorPopup: function(errorMsg) {
				try {
					// Check if we're in a DOM environment
					if (typeof document === "undefined" || !document.body) {
						console.log("🔐 DeepTutor: No DOM available, using Zotero alert for error");
						if (typeof Zotero !== "undefined") {
							Zotero.alert(null, "Google Sign-In Failed", `Error: ${errorMsg}`);
						}
						return;
					}

					const popupContent = `
						<div style="
							position: fixed;
							top: 50%;
							left: 50%;
							transform: translate(-50%, -50%);
							background: white;
							border: 2px solid #dc3545;
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
									color: #dc3545;
									font-size: 18px;
								">Google Sign-In Failed</h3>
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
							">
								Error: ${errorMsg}
							</div>
							<div style="
								text-align: center;
								margin-top: 15px;
								padding-top: 10px;
								border-top: 1px solid #eee;
							">
								<button onclick="this.parentElement.parentElement.remove()" style="
									background: #dc3545;
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

					const popupElement = document.createElement("div");
					popupElement.innerHTML = popupContent;
					document.body.appendChild(popupElement.firstElementChild);

					setTimeout(() => {
						if (popupElement.firstElementChild && popupElement.firstElementChild.parentNode) {
							popupElement.firstElementChild.remove();
						}
					}, 10000);
				} catch (error) {
					console.error("❌ DeepTutor: Error displaying auth error popup:", error.message);
					// Fallback to Zotero alert
					if (typeof Zotero !== "undefined") {
						Zotero.alert(null, "Google Sign-In Failed", `Error: ${errorMsg}`);
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

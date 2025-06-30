/**
 * Test file for DeepTutor Localhost Server
 *
 * This file demonstrates how to test the localhost server functionality
 * and how to send text via the API to trigger popups.
 *
 * @author DeepTutor Team
 * @license GNU Affero General Public License v3.0
 */

"use strict";

/**
 * Test function to demonstrate the localhost server functionality
 */
async function testLocalhostServer() {
	try {
		Zotero.debug("DeepTutor: Testing localhost server functionality");

		// Test 1: Send text via fetch API
		await testSendTextViaFetch();

		// Test 2: Send text via curl command (if available)
		await testSendTextViaCurl();

		// Test 3: Test health endpoint
		await testHealthEndpoint();

		Zotero.debug("DeepTutor: All localhost server tests completed");
	} catch (error) {
		Zotero.debug(`DeepTutor: Error during localhost server testing: ${error.message}`);
	}
}

/**
 * Test sending text via fetch API
 */
async function testSendTextViaFetch() {
	try {
		Zotero.debug("DeepTutor: Testing sendText via fetch API");

		const testText = "Hello from DeepTutor! This is a test message sent via the localhost server API.";

		const response = await fetch("http://localhost:3017/sendText", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ text: testText })
		});

		const result = await response.json();
		Zotero.debug(`DeepTutor: sendText API response: ${JSON.stringify(result)}`);

		if (result.success) {
			Zotero.debug("DeepTutor: sendText API test successful - popup should be displayed");
		} else {
			Zotero.debug(`DeepTutor: sendText API test failed: ${result.error}`);
		}
	} catch (error) {
		Zotero.debug(`DeepTutor: Error testing sendText via fetch: ${error.message}`);
	}
}

/**
 * Test sending text via curl command (if available)
 */
async function testSendTextViaCurl() {
	try {
		Zotero.debug("DeepTutor: Testing sendText via curl command");

		// Note: This would require a system with curl available
		// In a real implementation, you might use Zotero.Utilities.Internal.executeCommand
		// or similar to run curl commands

		const testText = "Hello from curl! This is a test message sent via curl command.";
		const curlCommand = `curl -X POST http://localhost:3017/sendText -H "Content-Type: application/json" -d '{"text":"${testText}"}'`;

		Zotero.debug(`DeepTutor: Curl command to test: ${curlCommand}`);
		Zotero.debug("DeepTutor: Note: Curl command execution not implemented in this test");
	} catch (error) {
		Zotero.debug(`DeepTutor: Error testing sendText via curl: ${error.message}`);
	}
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
	try {
		Zotero.debug("DeepTutor: Testing health endpoint");

		const response = await fetch("http://localhost:3017/health");
		const result = await response.json();

		Zotero.debug(`DeepTutor: Health endpoint response: ${JSON.stringify(result)}`);

		if (result.status === "healthy") {
			Zotero.debug("DeepTutor: Health endpoint test successful");
		} else {
			Zotero.debug(`DeepTutor: Health endpoint test failed: ${result.error}`);
		}
	} catch (error) {
		Zotero.debug(`DeepTutor: Error testing health endpoint: ${error.message}`);
	}
}

/**
 * Example of how to send text programmatically from within DeepTutor
 * @param {string} text - The text to send and display in popup
 */
async function sendTextFromDeepTutor(text) {
	try {
		Zotero.debug(`DeepTutor: Sending text programmatically: ${text}`);

		const response = await fetch("http://localhost:3017/sendText", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ text })
		});

		const result = await response.json();

		if (result.success) {
			Zotero.debug("DeepTutor: Text sent successfully - popup should be displayed");
			return true;
		} else {
			Zotero.debug(`DeepTutor: Failed to send text: ${result.error}`);
			return false;
		}
	} catch (error) {
		Zotero.debug(`DeepTutor: Error sending text: ${error.message}`);
		return false;
	}
}

/**
 * Example of how to send text from external applications
 * This function can be called from other parts of the codebase
 * @param {string} text - The text to send and display in popup
 * @param {number} port - The port number (default: 3017)
 */
async function sendTextToDeepTutor(text, port = 3017) {
	try {
		const response = await fetch(`http://localhost:${port}/sendText`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ text })
		});

		const result = await response.json();
		return result;
	} catch (error) {
		Zotero.debug(`DeepTutor: Error sending text to DeepTutor: ${error.message}`);
		throw error;
	}
}

// Export functions for use in other modules
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		testLocalhostServer,
		testSendTextViaFetch,
		testSendTextViaCurl,
		testHealthEndpoint,
		sendTextFromDeepTutor,
		sendTextToDeepTutor
	};
} else if (typeof window !== "undefined") {
	window.DeepTutorLocalhostServerTest = {
		testLocalhostServer,
		testSendTextViaFetch,
		testSendTextViaCurl,
		testHealthEndpoint,
		sendTextFromDeepTutor,
		sendTextToDeepTutor
	};
} 
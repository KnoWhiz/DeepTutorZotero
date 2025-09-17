let { Cc, Ci, Cu } = require('chrome');

// Lazy import of Subprocess to avoid loading issues
let Subprocess;
try {
	Zotero.debug("StreamingSubprocess: Attempting to import Subprocess module...");
	({ Subprocess } = ChromeUtils.import("resource://gre/modules/Subprocess.jsm"));
	Zotero.debug("StreamingSubprocess: Subprocess module imported successfully:", !!Subprocess);
}
catch (e) {
	Zotero.debug("StreamingSubprocess: Failed to import Subprocess module:", e);
	Subprocess = null;
}

// Alternative import methods if the first one fails
if (!Subprocess) {
	try {
		Zotero.debug("StreamingSubprocess: Trying alternative import method...");
		Subprocess = Cu.import("resource://gre/modules/Subprocess.jsm", {}).Subprocess;
		Zotero.debug("StreamingSubprocess: Alternative import successful:", !!Subprocess);
	}
	catch (e) {
		Zotero.debug("StreamingSubprocess: Alternative import also failed:", e);
		Subprocess = null;
	}
}

// Try accessing via globalThis if available
if (!Subprocess && typeof globalThis !== 'undefined' && globalThis.Subprocess) {
	try {
		Zotero.debug("StreamingSubprocess: Trying globalThis.Subprocess...");
		Subprocess = globalThis.Subprocess;
		Zotero.debug("StreamingSubprocess: globalThis import successful:", !!Subprocess);
	}
	catch (e) {
		Zotero.debug("StreamingSubprocess: globalThis import failed:", e);
	}
}

/**
 * StreamingSubprocess - A utility for running shell commands with real-time stdout streaming
 *
 * This module provides unified subprocess execution with streaming support, automatically
 * falling back between different methods based on availability.
 */
const StreamingSubprocess = {

	/**
	 * Run a subprocess with streaming output support
	 * @param {string} command - The command to execute
	 * @param {string[]} args - Arguments for the command
	 * @returns {Promise<string>} - The complete output from the command
	 */
	run: async function (command, args) {
		Zotero.debug("StreamingSubprocess: Starting subprocess with streaming support");

		// Try Subprocess.call first (preferred method)
		if (Subprocess && typeof Subprocess.call === 'function') {
			try {
				return await this._runWithSubprocessAPI(command, args);
			}
			catch (e) {
				Zotero.debug("StreamingSubprocess: Subprocess.call failed, falling back:", e);
			}
		}

		// Fall back to file polling method
		Zotero.debug("StreamingSubprocess: Using file polling fallback method");
		return this._runWithFilePolling(command, args);
	},

	/**
	 * Run command using Subprocess.call API with streaming
	 * @private
	 */
	_runWithSubprocessAPI: async function (command, args) {
		Zotero.debug("StreamingSubprocess: Using Subprocess.call API");

		const proc = await Subprocess.call({
			command,
			arguments: args
		});

		const result = await this._readStreamOutput(proc.stdout);
		await proc.wait();

		return result;
	},

	/**
	 * Read output from a stream (either readable stream or readString interface)
	 * @private
	 */
	_readStreamOutput: async function (stdout) {
		let result = "";
		let buffer = ""; // Buffer for incomplete JSON
		let thinkingProcesses = []; // Store thinking process results
		let finalResult = ""; // Store final result

		// Function to process accumulated buffer and extract complete JSON objects
		const processBuffer = (newText) => {
			buffer += newText;

			// Try to extract complete JSON objects from buffer
			let braceCount = 0;
			let inString = false;
			let escapeNext = false;
			let jsonStart = -1;

			for (let i = 0; i < buffer.length; i++) {
				const char = buffer[i];

				if (escapeNext) {
					escapeNext = false;
					continue;
				}

				if (char === '\\') {
					escapeNext = true;
					continue;
				}

				if (char === '"' && !escapeNext) {
					inString = !inString;
					continue;
				}

				if (!inString) {
					if (char === '{') {
						if (braceCount === 0) {
							jsonStart = i;
						}
						braceCount++;
					}
					else if (char === '}') {
						braceCount--;
						if (braceCount === 0 && jsonStart !== -1) {
							// Found complete JSON object
							const jsonStr = buffer.substring(jsonStart, i + 1);
							try {
								const jsonObj = JSON.parse(jsonStr);

								// Store the JSON object for processing
								if (jsonObj.result !== undefined) {
									// This looks like a result JSON, store it
									finalResult = jsonObj.result;
									// Move previous final result to thinking process if it exists
									if (result) {
										thinkingProcesses.push(result);
									}
									result = jsonObj.result;
								}
													else if (jsonObj.type === 'assistant' && jsonObj.message && jsonObj.message.content) {
														// Handle Claude API response format
														let content = '';
														if (Array.isArray(jsonObj.message.content)) {
															// Extract text content from content array where type === "text"
															content = jsonObj.message.content
																.filter(item => item.type === 'text' && item.text)
																.map(item => item.text)
																.join('\n'); // Use newline to separate multiple text blocks
														}
														else if (typeof jsonObj.message.content === 'string') {
															content = jsonObj.message.content;
														}
														
														if (content && content.trim()) {
															// Move previous final result to thinking process if it exists
															if (result && result.trim()) {
																thinkingProcesses.push(result.trim());
																Zotero.debug("StreamingSubprocess: Added to thinking processes:", result.trim());
															}
															finalResult = content.trim();
															result = content.trim();
															Zotero.debug("StreamingSubprocess: Set as current result:", content.trim());
														}
													}

								Zotero.debug("StreamingSubprocess: Parsed complete JSON:", jsonObj);
							}
							catch (parseError) {
								Zotero.debug("StreamingSubprocess: JSON parse error:", parseError, "JSON:", jsonStr);
							}

							// Remove processed JSON from buffer
							buffer = buffer.substring(i + 1);
							i = -1; // Reset loop
							jsonStart = -1;
						}
					}
				}
			}
		};

		// Try Web Streams API first
		if (stdout.readable) {
			Zotero.debug("StreamingSubprocess: Using Web Streams API");
			const decoder = new TextDecoder();
			const reader = stdout.readable.getReader();

			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;

					const text = decoder.decode(value, { stream: true });

					// Process the new text chunk
					processBuffer(text);

					// Real-time debug output
					Zotero.debug("StreamingSubprocess: stdout chunk:", text);
				}
			}
			finally {
				reader.releaseLock();
			}
		}
		// Fall back to readString method (same as utilities_internal.js)
		else if (typeof stdout.readString === 'function') {
			Zotero.debug("StreamingSubprocess: Using readString method");
			let str;
			while ((str = await stdout.readString())) {
				// Process the new text chunk
				processBuffer(str);

				// Real-time debug output
				Zotero.debug("StreamingSubprocess: stdout chunk:", str);
			}
		}
		else {
			throw new Error("No supported stream reading method available");
		}

		// Process any remaining buffer content
		if (buffer.trim()) {
			Zotero.debug("StreamingSubprocess: Remaining buffer content:", buffer);
			// Try to parse remaining content as plain text if not JSON
			if (!buffer.trim().startsWith('{')) {
				result += buffer;
			}
		}

		// Return result with thinking process metadata
		const streamResult = {
			finalResult: finalResult || result,
			thinkingProcesses: thinkingProcesses,
			fullOutput: result
		};

		Zotero.debug("StreamingSubprocess: Final stream result:", streamResult);

		// For backward compatibility, return the final result as string
		// but attach metadata for enhanced processing
		const resultString = String(streamResult.finalResult || streamResult.fullOutput || '');
		resultString._streamMetadata = streamResult;

		return resultString;
	},

	/**
	 * Alternative streaming method using file polling
	 * @private
	 */
	_runWithFilePolling: async function (command, args) {
		Zotero.debug("StreamingSubprocess: Starting file polling method");

		// Create temporary file for output
		const tmpDir = Zotero.getTempDirectory().path;
		const outputFile = tmpDir + "/zotero_command_output_" + Date.now() + ".txt";

		// Modify command to redirect output to file for polling
		const modifiedArgs = [...args];
		if (modifiedArgs.length > 0 && modifiedArgs[0] === "-c") {
			// For shell commands, redirect output to file while still allowing real-time monitoring
			modifiedArgs[1] = `(${modifiedArgs[1]}) 2>&1 | tee "${outputFile}"`;
		}

		Zotero.debug("StreamingSubprocess: Modified args:", JSON.stringify(modifiedArgs));

		// Start the process
		const proc = Cc["@mozilla.org/process/util;1"]
			.createInstance(Ci.nsIProcess);

		try {
			// Setup command file
			Cu.import("resource://gre/modules/FileUtils.jsm");
			const cmdFile = new FileUtils.File(command);
			proc.init(cmdFile);

			let result = "";
			let lastPosition = 0;
			let processFinished = false;

			// Start process asynchronously
			const processPromise = new Promise((resolve, reject) => {
				proc.runwAsync(modifiedArgs, modifiedArgs.length, {
					observe: function (subject, topic) {
						Zotero.debug("StreamingSubprocess: Process event:", topic);
						if (topic === "process-finished") {
							processFinished = true;
							if (proc.exitValue === 0) {
								resolve();
							}
							else {
								reject(new Error(`Process exited with code ${proc.exitValue}`));
							}
						}
					}
				});
			});

			// Poll the output file for new content
			const pollOutput = async () => {
				while (!processFinished) {
					try {
						// Try to read the output file
						const file = Cc["@mozilla.org/file/local;1"]
							.createInstance(Ci.nsIFile);
						file.initWithPath(outputFile);

						if (file.exists()) {
							// Read file content
							const fstream = Cc["@mozilla.org/network/file-input-stream;1"]
								.createInstance(Ci.nsIFileInputStream);
							const cstream = Cc["@mozilla.org/intl/converter-input-stream;1"]
								.createInstance(Ci.nsIConverterInputStream);

							fstream.init(file, -1, 0, 0);
							cstream.init(fstream, "UTF-8", 0, 0);

							let str = {};
							let fileContent = "";
							while (cstream.readString(4096, str) != 0) {
								fileContent += str.value;
							}

							cstream.close();
							fstream.close();

							// Check for new content
							if (fileContent.length > lastPosition) {
								const newContent = fileContent.substring(lastPosition);
								lastPosition = fileContent.length;
								result += newContent;

								// Real-time debug output
								Zotero.debug("StreamingSubprocess: new output:", newContent);
							}
						}
					}
					catch (e) {
						Zotero.debug("StreamingSubprocess: Error reading output file:", e);
					}

					// Wait a bit before next poll
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			};

			// Start polling and wait for process to complete
			await Promise.all([processPromise, pollOutput()]);

			// Final read to catch any remaining output
			try {
				const file = Cc["@mozilla.org/file/local;1"]
					.createInstance(Ci.nsIFile);
				file.initWithPath(outputFile);

				if (file.exists()) {
					const fstream = Cc["@mozilla.org/network/file-input-stream;1"]
						.createInstance(Ci.nsIFileInputStream);
					const cstream = Cc["@mozilla.org/intl/converter-input-stream;1"]
						.createInstance(Ci.nsIConverterInputStream);

					fstream.init(file, -1, 0, 0);
					cstream.init(fstream, "UTF-8", 0, 0);

					let str = {};
					let fileContent = "";
					while (cstream.readString(4096, str) != 0) {
						fileContent += str.value;
					}

					cstream.close();
					fstream.close();

					// Check for any final content
					if (fileContent.length > lastPosition) {
						const finalContent = fileContent.substring(lastPosition);
						result += finalContent;
						Zotero.debug("StreamingSubprocess: final output:", finalContent);
					}
				}
			}
		  catch (e) {
				Zotero.debug("StreamingSubprocess: Error in final read:", e);
			}

			// Clean up temp file
			try {
				const file = Cc["@mozilla.org/file/local;1"]
					.createInstance(Ci.nsIFile);
				file.initWithPath(outputFile);
				if (file.exists()) {
					file.remove(false);
				}
			}
			catch (e) {
				Zotero.debug("StreamingSubprocess: Error cleaning up temp file:", e);
			}

			return result;
		}
		catch (e) {
			Zotero.debug("StreamingSubprocess: Error in file polling method:", e);
			// Fall back to regular method
			return Zotero.Utilities.Internal.subprocess(command, args, []);
		}
	},

	/**
	 * Check if streaming subprocess functionality is available
	 * @returns {boolean}
	 */
	isAvailable: function () {
		return !!(Subprocess || Zotero.Utilities?.Internal?.subprocess);
	}
};

// Export the module
if (typeof module !== 'undefined' && module.exports) {
	module.exports = StreamingSubprocess;
}
else if (typeof exports !== 'undefined') {
	exports.StreamingSubprocess = StreamingSubprocess;
}
else {
	// Global export for browser environments
	this.StreamingSubprocess = StreamingSubprocess;
}

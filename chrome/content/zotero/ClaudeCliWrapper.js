let { Cc, Ci } = require('chrome');

const ClaudeCliWrapper = {
	_subprocessAvailable: function() {
		return !!(Zotero.Utilities && Zotero.Utilities.Internal && typeof Zotero.Utilities.Internal.subprocess === 'function');
	},

	// Execute the local "claude" or "codex" CLI with optional args and stdin
	// - args: array of string arguments for the claude command
	// - workingDirOverride: optional string path; if omitted or invalid, no explicit cwd change is attempted
	// - stdinText: optional string piped to the process via shell (printf/echo)
	// - noteContainer: optional Zotero item ID for saving response as note
	// - saveClaudeResponse: boolean flag to save response to note
	// - systemPrompt: optional system prompt to append to the command
	// - modifyUserPrompt: boolean flag to prepend professor instruction to user message
	// - cliChoice: string indicating which CLI to use ('claude' or 'codex')
	runClaude: async function(args = [], workingDirOverride = null, stdinText = null, noteContainer = null, saveClaudeResponse = false, systemPrompt = null, modifyUserPrompt = false, cliChoice = 'claude') {
		Zotero.debug("ClaudeCliWrapper.runClaude: start");
		const timeout = 15000;

		// Only honor explicit string workingDir; avoid accidental cwd usage
		const workingDirPath = (workingDirOverride && typeof workingDirOverride === 'string') ? workingDirOverride : null;

		// Detect WSL by UNC path like \\wsl.localhost\\<distro>\\<linuxPath>
		let wslInfo = null;
		if (Zotero.isWin && workingDirPath) {
			const m = /^\\wsl\.localhost\\([^\\]+)\\(.+)$/.exec(workingDirPath);
			if (m) {
				wslInfo = { distro: m[1], linuxDir: '/' + m[2].replace(/\\/g, '/') };
			}
		}

		// Normalize args to strings (preserving old working piping approach)
		let safeArgs = Array.isArray(args) ? args.map(a => String(a)) : [];
		// Zotero.debug(`ClaudeCliWrapper.runClaude: safeArgs=${JSON.stringify(safeArgs)}`);
		// Zotero.debug(`ClaudeCliWrapper.runClaude: systemPrompt=${systemPrompt}`);
		// Zotero.debug(`ClaudeCliWrapper.runClaude: modifyUserPrompt=${modifyUserPrompt}`);
		// Zotero.debug(`ClaudeCliWrapper.runClaude: cliChoice=${cliChoice}`);
		
		// Add system prompt if provided (only for Claude, not Codex)
		if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() && cliChoice !== 'codex') {
			safeArgs.push('--append-system-prompt', systemPrompt.trim());
			// Zotero.debug(`ClaudeCliWrapper.runClaude: Added system prompt for Claude: ${systemPrompt.trim()}`);
		} else if (cliChoice === 'codex') {
			//Zotero.debug(`ClaudeCliWrapper.runClaude: Skipping system prompt for Codex`);
		}

		// Modify user prompt if requested
		let finalStdinText = stdinText;
		if (modifyUserPrompt && stdinText && typeof stdinText === 'string' && stdinText.trim()) {
			const professorInstruction = "1. IMPORTANT: Regardless of what the user asks, always follow the action structure in STEP 4, so we can ensure the token amount is under the limit. 2. Generate thorough and detailed response with at least 4 sentences that have explicit file references, examples, and valuable explanations based on quotes, etc. 3. Do not access all files in directory, but follow the action structure to save tokens. 4. Action structure: You are a kind professor who is flexible to utilizing local resources and can provide deep and understandable answers. Please start by reviewing the summary in \"General\" folder and the File_Hierarchy_SQL_REAL md file in \"FileTree\" folder to get an overview of the local data, then based on user question, you can decide on what data to focus on reviewing and how you can utilize local resources to answer questions. We expect the user to ask question based on at least one of the three focuses: file content, library file structure, and user usage. For question focusing on content of some files, please try to selectively read files relevant to the question in RawDocData folder and integrate with learning from summary file to answer question. For question focusing on filebase structure, please base on the File_Hierarchy_SQL_REAL md file to capture the right files that we need to focus on, and then answer question base on your focus. Please provide detailed, accurate, and passionate answer. Please take ownership on selective what files you need to review, based on the above instruction, and how you can organize the plan to find solution. 5. The user's question is: ";
			finalStdinText = professorInstruction + stdinText.trim();
			//Zotero.debug(`ClaudeCliWrapper.runClaude: Modified user prompt with professor instruction`);
			//Zotero.debug(`ClaudeCliWrapper.runClaude: Original prompt: ${stdinText}`);
			//Zotero.debug(`ClaudeCliWrapper.runClaude: Modified prompt: ${finalStdinText}`);
		}

		// Helper: build a space-joined args string without shell interpolation (best-effort quoting per shell below if needed)
		const joinArgs = (arr) => (arr && arr.length) ? (' ' + arr.join(' ')) : '';

		// Helper: minimal escape for bash double-quoted string used with printf
		const escapeForBashDoubleQuoted = (text) => String(text).replace(/["\\`$]/g, ch => '\\' + ch);

		// Helper: minimal escape for cmd.exe echo
		const escapeForCmdEcho = (text) => String(text)
			.replace(/%/g, '%%')
			.replace(/([&|<>^()])/g, '^$1')
			.replace(/"/g, '^"');

		try {
			if (!this._subprocessAvailable()) {
				return { error: new Error('Subprocess API not available') };
			}

			let command;
			let spArgs;
			let options = { timeout };

					// Get API key from Zotero preferences for immediate use (only for Claude)
		let storedApiKey = null, apiKeyEnvVar = null;
		let baseCommand;
		
		if (cliChoice === 'codex') {
			// For Codex, we need to construct the command as "codex exec 'COMMAND'"
			// where COMMAND is the finalStdinText - NO API KEY INJECTION
			baseCommand = 'codex';
			// For Codex, we don't use the args in the same way - we pass the stdinText as the command
			if (finalStdinText) {
				// Wrap the command with quotes to ensure proper structure: codex exec "COMMAND"
				safeArgs = ['exec', `"${finalStdinText}"`];
				finalStdinText = null; // Clear stdinText since we're passing it as args
			}
			// No API key handling for Codex
			// Zotero.debug(`ClaudeCliWrapper.runClaude: Using Codex - no API key injection`);
		} else {
			// For Claude, use the original logic with API key
			baseCommand = 'claude';
			storedApiKey = Zotero.Prefs.get('deeptutor.claude.apiKey');
			apiKeyEnvVar = 'ANTHROPIC_API_KEY';
			// Zotero.debug(`ClaudeCliWrapper.runClaude: Using Claude with stored API key: ${storedApiKey ? 'yes' : 'no'}`);
		}

		if (wslInfo) {
			// Execute inside WSL bash, optionally cd to linuxDir
			command = "C:\\Windows\\System32\\wsl.exe";
			const joined = joinArgs(safeArgs);
			const shBody = (finalStdinText != null)
				? `printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | ${baseCommand}${joined}`
				: `${baseCommand}${joined}`;
			// Inject API key for immediate use (only for Claude, not Codex)
			const envCmd = (storedApiKey && apiKeyEnvVar) ? `${apiKeyEnvVar}="${storedApiKey}" ${shBody}` : shBody;
			const shLine = workingDirPath ? `cd "${wslInfo.linuxDir}" && ${envCmd}` : envCmd;
			spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
		}
		else if (Zotero.isWin) {
			// Native Windows CMD
			command = "C:\\Windows\\System32\\cmd.exe";
			const joined = joinArgs(safeArgs);
			const body = (finalStdinText != null)
				? `echo ${escapeForCmdEcho(finalStdinText)} | ${baseCommand}${joined}`
				: `${baseCommand}${joined}`;
			// Inject API key for immediate use (only for Claude, not Codex)
			const envBody = (storedApiKey && apiKeyEnvVar) ? `set ${apiKeyEnvVar}=${storedApiKey} && ${body}` : body;
			const line = workingDirPath ? `cd /d "${workingDirPath}" && ${envBody}` : envBody;
			spArgs = ["/d", "/s", "/c", line];
		}
		else {
			// Unix-like shells
			command = "/bin/sh";
			const joined = joinArgs(safeArgs);
			const baseCmd = workingDirPath
				? (finalStdinText != null
					? `cd "${workingDirPath}" && printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | ${baseCommand}${joined}`
					: `cd "${workingDirPath}" && ${baseCommand}${joined}`)
				: (finalStdinText != null
					? `printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | ${baseCommand}${joined}`
					: `${baseCommand}${joined}`);
			// Inject API key for immediate use (only for Claude, not Codex)
			const line = (storedApiKey && apiKeyEnvVar) ? `${apiKeyEnvVar}="${storedApiKey}" ${baseCmd}` : baseCmd;
			spArgs = ["-lc", line];
		}
			// Zotero.debug(`TTTTTTTTTTTT ClaudeCliWrapper.runClaude: command=${command}, spArgs=${JSON.stringify(spArgs)}, options=${JSON.stringify(options)}`);

			const res = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			// Zotero.debug("ClaudeCliWrapper.runClaude: result:", JSON.stringify(res));
			
			// Save response to note if requested and conditions are met
			// Zotero.debug(`ClaudeCliWrapper.runClaude: saveClaudeResponse=${saveClaudeResponse}, noteContainer=${noteContainer}, res=${JSON.stringify(res)}`);
			if (saveClaudeResponse && noteContainer && res) {
				try {
					await this.saveClaudeResponseToNote(res, noteContainer);
					// Zotero.debug("ClaudeCliWrapper.runClaude: Response saved to note successfully");
				}
				catch (noteError) {
					// Zotero.debug("ClaudeCliWrapper.runClaude: Error saving to note:", noteError);
					// Don't fail the main operation if note saving fails
				}
			}
			
			return res;
		}
		catch (e) {
			// Zotero.debug("ClaudeCliWrapper.runClaude: error:", e);
			return { error: e };
		}
	},

	// Streaming version of runClaude that processes output in real-time using --output-format=stream-json
	// - args: array of string arguments for the claude command
	// - workingDirOverride: optional string path; if omitted or invalid, no explicit cwd change is attempted
	// - stdinText: optional string piped to the process via shell (printf/echo)
	// - noteContainer: optional Zotero item ID for saving response as note
	// - saveClaudeResponse: boolean flag to save response to note
	// - systemPrompt: optional system prompt to append to the command
	// - modifyUserPrompt: boolean flag to prepend professor instruction to user message
	// - cliChoice: string indicating which CLI to use ('claude' or 'codex')
	// - onChunk: callback function called for each streaming chunk (chunk, isComplete)
	// - onError: callback function called for errors
	runClaudeStreaming: async function(args = [], workingDirOverride = null, stdinText = null, noteContainer = null, saveClaudeResponse = false, systemPrompt = null, modifyUserPrompt = false, cliChoice = 'claude', onChunk = null, onError = null) {
		// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: start");
		const timeout = 15000;

		// Only honor explicit string workingDir; avoid accidental cwd usage
		const workingDirPath = (workingDirOverride && typeof workingDirOverride === 'string') ? workingDirOverride : null;

		// Detect WSL by UNC path like \\wsl.localhost\\<distro>\\<linuxPath>
		let wslInfo = null;
		if (Zotero.isWin && workingDirPath) {
			const m = /^\\wsl\.localhost\\([^\\]+)\\(.+)$/.exec(workingDirPath);
			if (m) {
				wslInfo = { distro: m[1], linuxDir: '/' + m[2].replace(/\\/g, '/') };
			}
		}

		// Normalize args to strings and add streaming format
		let safeArgs = Array.isArray(args) ? args.map(a => String(a)) : [];
		
		// Add streaming output format for Claude (not for Codex)
		if (cliChoice === 'claude') {
			safeArgs.push('--output-format=stream-json');
		}
		
		// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: safeArgs=${JSON.stringify(safeArgs)}`);
		// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: systemPrompt=${systemPrompt}`);
		// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: modifyUserPrompt=${modifyUserPrompt}`);
		// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: cliChoice=${cliChoice}`);
		
		// Add system prompt if provided (only for Claude, not Codex)
		if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() && cliChoice !== 'codex') {
			safeArgs.push('--append-system-prompt', systemPrompt.trim());
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Added system prompt for Claude: ${systemPrompt.trim()}`);
		} else if (cliChoice === 'codex') {
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Skipping system prompt for Codex`);
		}

		// Modify user prompt if requested
		let finalStdinText = stdinText;
		if (modifyUserPrompt && stdinText && typeof stdinText === 'string' && stdinText.trim()) {
			const professorInstruction = "1. IMPORTANT: Regardless of what the user asks, always follow the action structure in STEP 4, so we can ensure the token amount is under the limit. 2. Generate thorough and detailed response with at least 4 sentences that have explicit file references, examples, and valuable explanations based on quotes, etc. 3. Do not access all files in directory, but follow the action structure to save tokens. 4. Action structure: You are a kind professor who is flexible to utilizing local resources and can provide deep and understandable answers. Please start by reviewing the summary in \"General\" folder and the File_Hierarchy_SQL_REAL md file in \"FileTree\" folder to get an overview of the local data, then based on user question, you can decide on what data to focus on reviewing and how you can utilize local resources to answer questions. We expect the user to ask question based on at least one of the three focuses: file content, library file structure, and user usage. For question focusing on content of some files, please try to selectively read files relevant to the question in RawDocData folder and integrate with learning from summary file to answer question. For question focusing on filebase structure, please base on the File_Hierarchy_SQL_REAL md file to capture the right files that we need to focus on, and then answer question base on your focus. Please provide detailed, accurate, and passionate answer. Please take ownership on selective what files you need to review, based on the above instruction, and how you can organize the plan to find solution. 5. The user's question is: ";
			finalStdinText = professorInstruction + stdinText.trim();
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Modified user prompt with professor instruction`);
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Original prompt: ${stdinText}`);
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Modified prompt: ${finalStdinText}`);
		}

		// Helper: build a space-joined args string without shell interpolation (best-effort quoting per shell below if needed)
		const joinArgs = (arr) => (arr && arr.length) ? (' ' + arr.join(' ')) : '';

		// Helper: minimal escape for bash double-quoted string used with printf
		const escapeForBashDoubleQuoted = (text) => String(text).replace(/["\\`$]/g, ch => '\\' + ch);

		// Helper: minimal escape for cmd.exe echo
		const escapeForCmdEcho = (text) => String(text)
			.replace(/%/g, '%%')
			.replace(/([&|<>^()])/g, '^$1')
			.replace(/"/g, '^"');

		try {
			if (!this._subprocessAvailable()) {
				const error = new Error('Subprocess API not available');
				if (onError) onError(error);
				return { error };
			}

			let command;
			let spArgs;
			let options = { timeout };

			// Get API key from Zotero preferences for immediate use (only for Claude)
			let storedApiKey = null, apiKeyEnvVar = null;
			let baseCommand;
			
			if (cliChoice === 'codex') {
				// For Codex, we need to construct the command as "codex exec 'COMMAND'"
				// where COMMAND is the finalStdinText - NO API KEY INJECTION
				baseCommand = 'codex';
				// For Codex, we don't use the args in the same way - we pass the stdinText as the command
				if (finalStdinText) {
					// Wrap the command with quotes to ensure proper structure: codex exec "COMMAND"
					safeArgs = ['exec', `"${finalStdinText}"`];
					finalStdinText = null; // Clear stdinText since we're passing it as args
				}
				// No API key handling for Codex
				// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Using Codex - no API key injection`);
			} else {
				// For Claude, use the original logic with API key
				baseCommand = 'claude';
				storedApiKey = Zotero.Prefs.get('deeptutor.claude.apiKey');
				apiKeyEnvVar = 'ANTHROPIC_API_KEY';
				// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Using Claude with stored API key: ${storedApiKey ? 'yes' : 'no'}`);
			}

			if (wslInfo) {
				// Execute inside WSL bash, optionally cd to linuxDir
				command = "C:\\Windows\\System32\\wsl.exe";
				const joined = joinArgs(safeArgs);
				const shBody = (finalStdinText != null)
					? `printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | ${baseCommand}${joined}`
					: `${baseCommand}${joined}`;
				// Inject API key for immediate use (only for Claude, not Codex)
				const envCmd = (storedApiKey && apiKeyEnvVar) ? `${apiKeyEnvVar}="${storedApiKey}" ${shBody}` : shBody;
				const shLine = workingDirPath ? `cd "${wslInfo.linuxDir}" && ${envCmd}` : envCmd;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
			}
			else if (Zotero.isWin) {
				// Native Windows CMD
				command = "C:\\Windows\\System32\\cmd.exe";
				const joined = joinArgs(safeArgs);
				const body = (finalStdinText != null)
					? `echo ${escapeForCmdEcho(finalStdinText)} | ${baseCommand}${joined}`
					: `${baseCommand}${joined}`;
				// Inject API key for immediate use (only for Claude, not Codex)
				const envBody = (storedApiKey && apiKeyEnvVar) ? `set ${apiKeyEnvVar}=${storedApiKey} && ${body}` : body;
				const line = workingDirPath ? `cd /d "${workingDirPath}" && ${envBody}` : envBody;
				spArgs = ["/d", "/s", "/c", line];
			}
			else {
				// Unix-like shells
				command = "/bin/sh";
				const joined = joinArgs(safeArgs);
				const baseCmd = workingDirPath
					? (finalStdinText != null
						? `cd "${workingDirPath}" && printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | ${baseCommand}${joined}`
						: `cd "${workingDirPath}" && ${baseCommand}${joined}`)
					: (finalStdinText != null
						? `printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | ${baseCommand}${joined}`
						: `${baseCommand}${joined}`);
				// Inject API key for immediate use (only for Claude, not Codex)
				const line = (storedApiKey && apiKeyEnvVar) ? `${apiKeyEnvVar}="${storedApiKey}" ${baseCmd}` : baseCmd;
				spArgs = ["-lc", line];
			}
			
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: command=${command}, spArgs=${JSON.stringify(spArgs)}, options=${JSON.stringify(options)}`);

			// Process the subprocess result
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: About to execute subprocess with command: ${command}`);
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: subprocess args: ${JSON.stringify(spArgs)}`);
			
			const res = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			
			// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: raw result type:", typeof res);
			// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: raw result:", JSON.stringify(res));
			// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: raw result length:", res ? String(res).length : 'null/undefined');
			
			// Check if res is an object with error information
			if (res && typeof res === 'object') {
				if (res.exitCode !== undefined) {
					// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: subprocess exitCode:", res.exitCode);
				}
				if (res.stderr) {
					// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: subprocess stderr:", res.stderr);
				}
				if (res.stdout !== undefined) {
					// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: subprocess stdout length:", res.stdout ? res.stdout.length : 'empty');
				}
			}
			
			// Parse streaming JSON output
			let fullResponse = '';
			let accumulatedContent = '';
			let isComplete = false;
			
			// Handle different response formats from subprocess
			let responseText = '';
			if (res) {
				if (typeof res === 'string') {
					// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: res is string, length: ${res.length}`);
					if (res.trim()) {
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: res content preview: ${res.substring(0, 200)}...`);
					}
					responseText = res;
				} else if (res.stdout !== undefined) {
					// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: res has stdout, length: ${res.stdout ? res.stdout.length : 'null'}`);
					if (res.stdout && res.stdout.trim()) {
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: stdout content preview: ${res.stdout.substring(0, 200)}...`);
					}
					responseText = res.stdout || '';
				} else if (res.output !== undefined) {
					// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: res has output, length: ${res.output ? res.output.length : 'null'}`);
					if (res.output && res.output.trim()) {
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: output content preview: ${res.output.substring(0, 200)}...`);
					}
					responseText = res.output || '';
				} else {
					// Fallback: convert to string if it's an object
					// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: res is object, converting to string`);
					responseText = String(res);
				}
			} else {
				// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: res is null/undefined");
			}
			
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Final responseText length: ${responseText.length}`);
			if (responseText && responseText.trim()) {
				// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: responseText preview: ${responseText.substring(0, 200)}...`);
			}
			
			if (responseText && responseText.trim()) {
				const lines = responseText.split('\n');
				// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Processing ${lines.length} lines from responseText`);
				
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i].trim();
					if (!line) continue;
					
					try {
						// Parse JSON chunk
						const chunk = JSON.parse(line);
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Parsed chunk:`, JSON.stringify(chunk));
						
						// Extract content from different possible chunk structures
						let content = '';
						
						// Handle different Claude CLI streaming formats
						if (chunk.content) {
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: chunk.content: ${chunk.content}`);
							// Format: {"content": "text"}
							if (typeof chunk.content === 'string') {
								content = chunk.content;
							} else if (chunk.content.text) {
								content = chunk.content.text;
							}
						} else if (chunk.delta && chunk.delta.text) {
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: chunk.delta.text: ${chunk.delta.text}`);
							// Format: {"delta": {"text": "content"}}
							content = chunk.delta.text;
						} else if (chunk.delta && typeof chunk.delta === 'string') {
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: chunk.delta: ${chunk.delta}`);
							// Format: {"delta": "content"}
							content = chunk.delta;
						} else if (chunk.text) {	
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: chunk.text: ${chunk.text}`);
							// Format: {"text": "content"}
							content = chunk.text;
						} else if (chunk.message && chunk.message.content) {
							// Format: {"message": {"content": "text"}}
							if (typeof chunk.message.content === 'string') {
								content = chunk.message.content;
							} else if (Array.isArray(chunk.message.content)) {
								// Handle array of content blocks
								content = chunk.message.content
									.filter(block => block.type === 'text' && block.text)
									.map(block => block.text)
									.join('');
							}
						} else if (typeof chunk === 'string') {
							// Format: direct string
							content = chunk;
						} else {
							// Log unrecognized chunk format for debugging
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Unrecognized chunk format:`, JSON.stringify(chunk));
						}
						
						if (content && typeof content === 'string') {
							accumulatedContent += content;
							fullResponse += content;
							
							// Call the chunk callback if provided
							if (onChunk && typeof onChunk === 'function') {
								onChunk(content, false, accumulatedContent);
							}
						} else if (chunk && !content) {
							// Log when we have a chunk but couldn't extract content
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: Could not extract content from chunk:`, JSON.stringify(chunk));
						}
						
						// Check if this is the final chunk
						if (chunk.stop_reason || chunk.finish_reason || chunk.done || chunk.type === 'message_stop') {
							isComplete = true;
							break;
						}
						
					} catch (parseError) {
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: JSON parse error for line: ${line}`, parseError);
						// If JSON parsing fails, treat the line as plain text content
						if (line) {
							// Only add non-JSON lines if they seem to contain actual content
							if (!line.startsWith('{') && !line.startsWith('data:') && line.length > 0) {
								accumulatedContent += line + '\n';
								fullResponse += line + '\n';
								
								if (onChunk && typeof onChunk === 'function') {
									onChunk(line + '\n', false, accumulatedContent);
								}
							}
						}
					}
				}
			} else {
				// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: No valid response text found");
				
				// Check for potential command execution issues
				if (res && typeof res === 'object') {
					if (res.exitCode && res.exitCode !== 0) {
						const errorMsg = `Claude CLI command failed with exit code ${res.exitCode}`;
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: ${errorMsg}`);
						if (res.stderr) {
							// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: stderr: ${res.stderr}`);
						}
						
						if (onError && typeof onError === 'function') {
							onError(new Error(`${errorMsg}${res.stderr ? ': ' + res.stderr : ''}`));
						}
						
						return { 
							error: new Error(`${errorMsg}${res.stderr ? ': ' + res.stderr : ''}`),
							exitCode: res.exitCode,
							stderr: res.stderr 
						};
					}
				}
				
				// If no streaming content was found but we have a response, try to use it as-is
				if (res) {
					let fallbackContent = '';
					if (typeof res === 'string') {
						fallbackContent = res;
					} else if (res.stdout !== undefined) {
						fallbackContent = res.stdout || '';
					} else if (res.output !== undefined) {
						fallbackContent = res.output || '';
					}
					
					if (fallbackContent && fallbackContent.trim()) {
						// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: Using fallback content");
						fullResponse = fallbackContent;
						accumulatedContent = fallbackContent;
						
						if (onChunk && typeof onChunk === 'function') {
							onChunk(fallbackContent, true, accumulatedContent);
						}
					} else {
						// No content at all - might be a command issue
						const warningMsg = "Claude CLI command executed but returned no content. Check if Claude CLI is properly installed and configured.";
						// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: ${warningMsg}`);
						
						if (onError && typeof onError === 'function') {
							onError(new Error(warningMsg));
						}
					}
				} else {
					// Completely null response
					const errorMsg = "Claude CLI command failed to execute - no response received";
					// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: ${errorMsg}`);
					
					if (onError && typeof onError === 'function') {
						onError(new Error(errorMsg));
					}
					
					return { error: new Error(errorMsg) };
				}
			}
			
			// Call final chunk callback if provided
			if (onChunk && typeof onChunk === 'function') {
				onChunk('', true, accumulatedContent);
			}
			
			// Save response to note if requested and conditions are met
			// Zotero.debug(`ClaudeCliWrapper.runClaudeStreaming: saveClaudeResponse=${saveClaudeResponse}, noteContainer=${noteContainer}`);
			if (saveClaudeResponse && noteContainer && fullResponse) {
				try {
					await this.saveClaudeResponseToNote(fullResponse, noteContainer);
					// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: Response saved to note successfully");
				}
				catch (noteError) {
					// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: Error saving to note:", noteError);
					// Don't fail the main operation if note saving fails
				}
			}
			
			// Return result that's compatible with both object usage and direct string usage
			const result = { 
				success: true, 
				content: fullResponse, 
				accumulatedContent: accumulatedContent,
				isComplete: true 
			};
			
			// Add toString method to prevent [object Object] when used as string
			result.toString = function() {
				return this.content || '';
			};
			
			return result;
		}
		catch (e) {
			// Zotero.debug("ClaudeCliWrapper.runClaudeStreaming: error:", e);
			if (onError && typeof onError === 'function') {
				onError(e);
			}
			return { error: e };
		}
	},

	// Example function demonstrating how to use the streaming functionality
	// This shows how to integrate streaming responses into your current system
	exampleStreamingUsage: async function(prompt, workingDirOverride = null) {
		//Zotero.debug("ClaudeCliWrapper.exampleStreamingUsage: start");
		
		let streamingContent = '';
		let isComplete = false;
		
		// Define callback functions for handling streaming chunks
		const onChunk = (chunk, isFinal, accumulated) => {
			// Zotero.debug(`ClaudeCliWrapper.exampleStreamingUsage: Received chunk: "${chunk}"`);
			// Zotero.debug(`ClaudeCliWrapper.exampleStreamingUsage: Is final: ${isFinal}`);
			// Zotero.debug(`ClaudeCliWrapper.exampleStreamingUsage: Accumulated content length: ${accumulated.length}`);
			
			// Update the streaming content
			streamingContent = accumulated;
			isComplete = isFinal;
			
			// Here you would typically update your UI with the new chunk
			// For example, append to a chat message or update a progress indicator
			if (chunk) {
				// Example: Update UI with new content
				// updateChatMessage(streamingContent);
				// showTypingIndicator(!isFinal);
			}
		};
		
		const onError = (error) => {
			// Zotero.debug("ClaudeCliWrapper.exampleStreamingUsage: Error occurred:", error);
			// Handle error in your UI
			// showErrorMessage(error.message);
		};
		
		// Call the streaming function
		const result = await this.runClaudeStreaming(
			[], // args
			workingDirOverride, // working directory
			prompt, // stdin text (the prompt)
			null, // note container (optional)
			false, // save to note (optional)
			null, // system prompt (optional)
			false, // modify user prompt (optional)
			'claude', // cli choice
			onChunk, // chunk callback
			onError // error callback
		);
		
		// Zotero.debug("ClaudeCliWrapper.exampleStreamingUsage: Final result:", JSON.stringify(result));
		return result;
	},

	// Check if "claude" CLI exists by invoking platform-appropriate locator
	checkClaude: async function(workingDirOverride = null) {
		// Zotero.debug("ClaudeCliWrapper.checkClaude: start");
		const timeout = 10000;
		const workingDirPath = (workingDirOverride && typeof workingDirOverride === 'string') ? workingDirOverride : null;

		let wslInfo = null;
		if (Zotero.isWin && workingDirPath) {
			const m = /^\\wsl\.localhost\\([^\\]+)\\(.+)$/.exec(workingDirPath);
			if (m) {
				wslInfo = { distro: m[1], linuxDir: '/' + m[2].replace(/\\/g, '/') };
			}
		}

		try {
			if (!this._subprocessAvailable()) {
				return { exists: false, error: new Error('Subprocess API not available') };
			}

			let command;
			let spArgs;
			let options = { timeout };

			if (wslInfo) {
				command = "C:\\Windows\\System32\\wsl.exe";
				const locator = 'which claude';
				const shLine = workingDirPath ? `cd "${wslInfo.linuxDir}" && ${locator}` : locator;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
			}
			else if (Zotero.isWin) {
				command = "C:\\Windows\\System32\\cmd.exe";
				const locator = 'where claude';
				const line = workingDirPath ? `cd /d "${workingDirPath}" && ${locator}` : locator;
				spArgs = ["/d", "/s", "/c", line];
			}
			else {
				command = "/bin/sh";
				const locator = 'which claude';
				const line = workingDirPath ? `cd "${workingDirPath}" && ${locator}` : locator;
				spArgs = ["-lc", line];
			}

			const res = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			// Zotero.debug(`ClaudeCliWrapper.checkClaude: stdout=${JSON.stringify(res.trim())}`);
			if (res && !/not found|could not be found|no such file|INFO:/i.test(res.trim())) {
				return { exists: true, path: res.trim() };
			}
			return { exists: false, path: null };
		}
		catch (e) {
			// Zotero.debug("ClaudeCliWrapper.checkClaude: error:", e);
			return { exists: false, error: e };
		}
	}
,

	// Install Claude CLI and set API key
	installClaude: async function(apiKey, workingDirOverride = null) {
		// Zotero.debug("ClaudeCliWrapper.installClaude: start");
		// Zotero.debug(`ClaudeCliWrapper.installClaude: apiKey length=${apiKey ? apiKey.length : 0}`);
		const timeout = 180000; // 3 minutes for npm install
		const workingDirPath = (workingDirOverride && typeof workingDirOverride === 'string') ? workingDirOverride : null;

		let wslInfo = null;
		if (Zotero.isWin && workingDirPath) {
			const m = /^\\wsl\.localhost\\([^\\]+)\\(.+)$/.exec(workingDirPath);
			if (m) {
				wslInfo = { distro: m[1], linuxDir: '/' + m[2].replace(/\\/g, '/') };
			}
		}

		try {
			if (!this._subprocessAvailable()) {
				return { ok: false, error: new Error('Subprocess API not available') };
			}

					if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
			return { ok: false, error: new Error('Valid API key is required') };
		}

		const cleanApiKey = String(apiKey).trim();

		// Store API key in Zotero preferences for immediate use (one-click solution)
		try {
			Zotero.Prefs.set('deeptutor.claude.apiKey', cleanApiKey);
			// Zotero.debug("ClaudeCliWrapper.installClaude: API key stored in Zotero preferences for immediate use");
		} catch (prefError) {
			// Zotero.debug("ClaudeCliWrapper.installClaude: Error storing API key in preferences:", prefError);
		}

		// Step 1: Install Claude CLI
			// Zotero.debug("ClaudeCliWrapper.installClaude: Installing Claude CLI...");
			let installResult;
			
			let command;
			let spArgs;
			let options = { timeout };

			if (wslInfo) {
				command = "C:\\Windows\\System32\\wsl.exe";
				const installLine = workingDirPath
					? `cd "${wslInfo.linuxDir}" && npm install -g @anthropic-ai/claude-code`
					: `npm install -g @anthropic-ai/claude-code`;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", installLine];
			}
			else if (Zotero.isWin) {
				command = "C:\\Windows\\System32\\cmd.exe";
				const installLine = workingDirPath
					? `cd /d "${workingDirPath}" && npm install -g @anthropic-ai/claude-code`
					: `npm install -g @anthropic-ai/claude-code`;
				spArgs = ["/d", "/s", "/c", installLine];
			}
			else {
				command = "/bin/sh";
				const installLine = workingDirPath
					? `cd "${workingDirPath}" && npm install -g @anthropic-ai/claude-code`
					: `npm install -g @anthropic-ai/claude-code`;
				spArgs = ["-lc", installLine];
			}

			installResult = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			// Zotero.debug("ClaudeCliWrapper.installClaude: npm install result:", JSON.stringify(installResult));
			
			// Check if installation was successful
			if (installResult && (installResult.includes('error') || installResult.includes('failed'))) {
				return { ok: false, error: new Error(`npm install failed: ${installResult}`) };
			}

					// Step 2: Set API key with multiple persistent approaches for one-click solution
		// Zotero.debug("ClaudeCliWrapper.installClaude: Setting API key with multiple approaches...");
		let envResult = {};

		if (wslInfo) {
			// For WSL: Multiple approaches for maximum reliability
			try {
				// 1. Add to .bashrc for shell persistence
				const bashrcLine = `echo 'export ANTHROPIC_API_KEY="${cleanApiKey}"' >> ~/.bashrc`;
				const bashrcSpArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", bashrcLine];
				envResult.bashrc = await Zotero.Utilities.Internal.subprocess(command, bashrcSpArgs, options);
				
				// 2. Add to .profile for login shell persistence
				const profileLine = `echo 'export ANTHROPIC_API_KEY="${cleanApiKey}"' >> ~/.profile`;
				const profileSpArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", profileLine];
				envResult.profile = await Zotero.Utilities.Internal.subprocess(command, profileSpArgs, options);
			} catch (e) {
				// Zotero.debug("ClaudeCliWrapper.installClaude: WSL env setting error:", e);
			}
		}
		else if (Zotero.isWin) {
			// For Windows: User and system level approaches
			try {
				// 1. Set user-level persistent environment variable
				const userEnvLine = `setx ANTHROPIC_API_KEY "${cleanApiKey}"`;
				const userEnvSpArgs = ["/d", "/s", "/c", userEnvLine];
				envResult.userLevel = await Zotero.Utilities.Internal.subprocess(command, userEnvSpArgs, options);
				
				// 2. Try system-level if user has admin rights (may fail, that's ok)
				try {
					const systemEnvLine = `setx ANTHROPIC_API_KEY "${cleanApiKey}" /M`;
					const systemEnvSpArgs = ["/d", "/s", "/c", systemEnvLine];
					envResult.systemLevel = await Zotero.Utilities.Internal.subprocess(command, systemEnvSpArgs, options);
				} catch (adminError) {
					// Zotero.debug("ClaudeCliWrapper.installClaude: System-level setx failed (expected if not admin):", adminError);
				}
			} catch (e) {
				// Zotero.debug("ClaudeCliWrapper.installClaude: Windows env setting error:", e);
			}
		}
		else {
			// For Unix-like systems: Multiple shell profiles for maximum coverage
			try {
				// 1. Add to .bashrc
				const bashrcLine = `echo 'export ANTHROPIC_API_KEY="${cleanApiKey}"' >> ~/.bashrc`;
				const bashrcSpArgs = ["-lc", bashrcLine];
				envResult.bashrc = await Zotero.Utilities.Internal.subprocess("/bin/sh", bashrcSpArgs, options);
				
				// 2. Add to .profile
				const profileLine = `echo 'export ANTHROPIC_API_KEY="${cleanApiKey}"' >> ~/.profile`;
				const profileSpArgs = ["-lc", profileLine];
				envResult.profile = await Zotero.Utilities.Internal.subprocess("/bin/sh", profileSpArgs, options);
				
				// 3. Add to .zshrc if it exists (for zsh users)
				const zshrcLine = `[ -f ~/.zshrc ] && echo 'export ANTHROPIC_API_KEY="${cleanApiKey}"' >> ~/.zshrc || true`;
				const zshrcSpArgs = ["-lc", zshrcLine];
				envResult.zshrc = await Zotero.Utilities.Internal.subprocess("/bin/sh", zshrcSpArgs, options);
			} catch (e) {
				// Zotero.debug("ClaudeCliWrapper.installClaude: Unix env setting error:", e);
			}
		}

			// Zotero.debug("ClaudeCliWrapper.installClaude: env variable result:", JSON.stringify(envResult));

					// Step 3: Verify installation
		// Zotero.debug("ClaudeCliWrapper.installClaude: Verifying installation...");
		const verifyResult = await this.checkClaude(workingDirOverride);
		// Zotero.debug("ClaudeCliWrapper.installClaude: verification result:", JSON.stringify(verifyResult));

		// Step 4: Test immediate API key functionality (one-click verification)
		let apiTestResult = null;
		if (verifyResult.exists) {
			try {
				// Zotero.debug("ClaudeCliWrapper.installClaude: Testing immediate API key functionality...");
				apiTestResult = await this.runClaude([], workingDirOverride, "test", null, false, null, false, 'claude');
				// Zotero.debug("ClaudeCliWrapper.installClaude: API test result:", JSON.stringify(apiTestResult));
			} catch (testError) {
				// Zotero.debug("ClaudeCliWrapper.installClaude: API test error:", testError);
				apiTestResult = { error: testError };
			}
		}

		if (verifyResult.exists) {
			const isApiWorking = apiTestResult && !apiTestResult.error && 
				!String(apiTestResult).includes('API key') && 
				!String(apiTestResult).includes('authentication');
			
			return { 
				ok: true, 
				result: {
					install: installResult,
					env: envResult,
					verification: verifyResult,
					apiTest: apiTestResult
				},
				message: isApiWorking 
					? "🎉 Claude CLI installed and API key working immediately! One-click setup complete."
					: "✅ Claude CLI installed and API key set. API may need a moment to activate or you may need to restart your terminal for some features."
			};
		} else {
			return { 
				ok: false, 
				error: new Error("Installation completed but claude command not found. Please check your PATH."),
				partialResult: {
					install: installResult,
					env: envResult,
					verification: verifyResult
				}
			};
		}
		}
		catch (e) {
			// Zotero.debug("ClaudeCliWrapper.installClaude: error:", e);
			return { ok: false, error: e };
		}
	},

	// Save Claude response to a Zotero note (similar to DeepTutorChatBoxMessage.js logic)
	saveClaudeResponseToNote: async function(responseText, noteContainer) {
		if (!responseText || !noteContainer) {
			throw new Error('Missing response text or note container');
		}

		try {
			let noteText = responseText;
			
			// Clean the text - basic sanitization
			if (noteText) {
				// Convert markdown-style formatting to basic HTML for better readability
				noteText = noteText
					// Convert **bold** to <strong>bold</strong>
					.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
					// Convert *italic* to <em>italic</em>
					.replace(/\*(.*?)\*/g, '<em>$1</em>')
					// Convert line breaks to HTML breaks
					.replace(/\n/g, '<br>')
					// Clean up multiple spaces
					.replace(/\s\s+/g, ' ')
					.trim();
			}

			if (!noteText) {
				throw new Error('Response text appears to be empty after cleaning');
			}

			// Create the note
			let noteName = '';
			let containerName = '';
			
			await Zotero.DB.executeTransaction(async () => {
				const noteItem = new Zotero.Item('note');
				noteItem.libraryID = Zotero.Items.get(noteContainer).libraryID;
				
				// Set the parent item
				noteItem.parentID = noteContainer;
				
				// Create note title from the first line or a default
				const titleText = noteText.replace(/<[^>]*>/g, '').substring(0, 100);
				const _noteTitle = titleText.length > 100 ? titleText.substring(0, 97) + '...' : titleText;
				
				// Prepare the final note content with proper HTML structure
				const fullNoteContent = `<div class="zotero-note znv1">
					<h3>Claude CLI Response</h3>
					<p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
					<hr>
					<div>${noteText}</div>
				</div>`;
				
				// Set the note content
				noteItem.setNote(fullNoteContent);
				
				// Save the note
				const noteID = await noteItem.save({
					notifierData: {
						autoSyncDelay: Zotero.Notes.AUTO_SYNC_DELAY
					}
				});
				
				// Get the note name and container name for the success message
				const savedNote = Zotero.Items.get(noteID);
				noteName = savedNote.getNoteTitle();
				
				const parentItem = Zotero.Items.get(noteContainer);
				containerName = parentItem.getDisplayTitle();
			});
			
			// Show success message with actual names
			Zotero.alert(null, "Note Created Successfully", `Claude response saved as note "${noteName}" in "${containerName}".`);
			return { success: true, noteName, containerName };
		}
		catch (error) {
			// Zotero.debug("ClaudeCliWrapper.saveClaudeResponseToNote: error:", error);
			throw error;
		}
	}
};

// Zotero.debug("ClaudeCliWrapper: Module loaded successfully");
module.exports = ClaudeCliWrapper;



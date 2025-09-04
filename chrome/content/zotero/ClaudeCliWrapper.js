let { Cc, Ci } = require('chrome');

const ClaudeCliWrapper = {
	_subprocessAvailable: function() {
		return !!(Zotero.Utilities && Zotero.Utilities.Internal && typeof Zotero.Utilities.Internal.subprocess === 'function');
	},

	// Execute the local "claude" CLI with optional args and stdin
	// - args: array of string arguments for the claude command
	// - workingDirOverride: optional string path; if omitted or invalid, no explicit cwd change is attempted
	// - stdinText: optional string piped to the process via shell (printf/echo)
	// - noteContainer: optional Zotero item ID for saving response as note
	// - saveClaudeResponse: boolean flag to save response to note
	// - systemPrompt: optional system prompt to append to the command
	// - modifyUserPrompt: boolean flag to prepend professor instruction to user message
	runClaude: async function(args = [], workingDirOverride = null, stdinText = null, noteContainer = null, saveClaudeResponse = false, systemPrompt = null, modifyUserPrompt = false) {
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
		Zotero.debug(`ClaudeCliWrapper.runClaude: safeArgs=${JSON.stringify(safeArgs)}`);
		Zotero.debug(`ClaudeCliWrapper.runClaude: systemPrompt=${systemPrompt}`);
		Zotero.debug(`ClaudeCliWrapper.runClaude: modifyUserPrompt=${modifyUserPrompt}`);
		
		// Add system prompt if provided (while preserving old piping logic)
		if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
			safeArgs.push('--append-system-prompt', systemPrompt.trim());
			Zotero.debug(`ClaudeCliWrapper.runClaude: Added system prompt: ${systemPrompt.trim()}`);
		}

		// Modify user prompt if requested
		let finalStdinText = stdinText;
		if (modifyUserPrompt && stdinText && typeof stdinText === 'string' && stdinText.trim()) {
			const professorInstruction = "You are a kind professor who is flexible to utilizing local resources and can provide deep and understandable answers. Please start by reviewing the summary in \"General\" folder and the File_Hierarchy_SQL_REAL md file in \"FileTree\" folder to get an overview of the local data, then based on user question, you can decide on what data to focus on reviewing and how you can utilize local resources to answer questions. We expect the user to ask question based on at least one of the three focuses: file content, library file structure, and user usage. For question focusing on content of some files, please try to selectively read files relevant to the question in RawDocData folder and integrate with learning from summary file to answer question. For question focusing on filebase structure, please base on the File_Hierarchy_SQL_REAL md file to capture the right files that we need to focus on, and then answer question base on your focus. Please provide detailed, accurate, and passionate answer. Please take ownership on selective what files you need to review, based on the above instruction, and how you can organize the plan to find solution. The user's question is: ";
			finalStdinText = professorInstruction + stdinText.trim();
			Zotero.debug(`ClaudeCliWrapper.runClaude: Modified user prompt with professor instruction`);
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

			// Get API key from Zotero preferences for immediate use (one-click solution)
			const storedApiKey = Zotero.Prefs.get('deeptutor.claude.apiKey');
			Zotero.debug(`ClaudeCliWrapper.runClaude: Using stored API key: ${storedApiKey ? 'yes' : 'no'}`);

			if (wslInfo) {
				// Execute inside WSL bash, optionally cd to linuxDir
				command = "C:\\Windows\\System32\\wsl.exe";
				const joined = joinArgs(safeArgs);
				const shBody = (finalStdinText != null)
					? `printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | claude${joined}`
					: `claude${joined}`;
				// Inject API key for immediate use (one-time command approach)
				const envClaudeCmd = storedApiKey ? `ANTHROPIC_API_KEY="${storedApiKey}" ${shBody}` : shBody;
				const shLine = workingDirPath ? `cd "${wslInfo.linuxDir}" && ${envClaudeCmd}` : envClaudeCmd;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
			}
			else if (Zotero.isWin) {
				// Native Windows CMD
				command = "C:\\Windows\\System32\\cmd.exe";
				const joined = joinArgs(safeArgs);
				const body = (finalStdinText != null)
					? `echo ${escapeForCmdEcho(finalStdinText)} | claude${joined}`
					: `claude${joined}`;
				// Inject API key for immediate use (set for command session)
				const envBody = storedApiKey ? `set ANTHROPIC_API_KEY=${storedApiKey} && ${body}` : body;
				const line = workingDirPath ? `cd /d "${workingDirPath}" && ${envBody}` : envBody;
				spArgs = ["/d", "/s", "/c", line];
			}
			else {
				// Unix-like shells
				command = "/bin/sh";
				const joined = joinArgs(safeArgs);
				const baseCmd = workingDirPath
					? (finalStdinText != null
						? `cd "${workingDirPath}" && printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | claude${joined}`
						: `cd "${workingDirPath}" && claude${joined}`)
					: (finalStdinText != null
						? `printf "%s" "${escapeForBashDoubleQuoted(finalStdinText)}" | claude${joined}`
						: `claude${joined}`);
				// Inject API key for immediate use (one-time command approach)
				const line = storedApiKey ? `ANTHROPIC_API_KEY="${storedApiKey}" ${baseCmd}` : baseCmd;
				spArgs = ["-lc", line];
			}

			const res = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			Zotero.debug("ClaudeCliWrapper.runClaude: result:", JSON.stringify(res));
			
			// Save response to note if requested and conditions are met
			Zotero.debug(`ClaudeCliWrapper.runClaude: saveClaudeResponse=${saveClaudeResponse}, noteContainer=${noteContainer}, res=${JSON.stringify(res)}`);
			if (saveClaudeResponse && noteContainer && res) {
				try {
					await this.saveClaudeResponseToNote(res, noteContainer);
					Zotero.debug("ClaudeCliWrapper.runClaude: Response saved to note successfully");
				}
				catch (noteError) {
					Zotero.debug("ClaudeCliWrapper.runClaude: Error saving to note:", noteError);
					// Don't fail the main operation if note saving fails
				}
			}
			
			return res;
		}
		catch (e) {
			Zotero.debug("ClaudeCliWrapper.runClaude: error:", e);
			return { error: e };
		}
	}
,

	// Check if "claude" CLI exists by invoking platform-appropriate locator
	checkClaude: async function(workingDirOverride = null) {
		Zotero.debug("ClaudeCliWrapper.checkClaude: start");
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
			Zotero.debug(`ClaudeCliWrapper.checkClaude: stdout=${JSON.stringify(res.trim())}`);
			if (res && !/not found|could not be found|no such file|INFO:/i.test(res.trim())) {
				return { exists: true, path: res.trim() };
			}
			return { exists: false, path: null };
		}
		catch (e) {
			Zotero.debug("ClaudeCliWrapper.checkClaude: error:", e);
			return { exists: false, error: e };
		}
	}
,

	// Install Claude CLI and set API key
	installClaude: async function(apiKey, workingDirOverride = null) {
		Zotero.debug("ClaudeCliWrapper.installClaude: start");
		Zotero.debug(`ClaudeCliWrapper.installClaude: apiKey length=${apiKey ? apiKey.length : 0}`);
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
			Zotero.debug("ClaudeCliWrapper.installClaude: API key stored in Zotero preferences for immediate use");
		} catch (prefError) {
			Zotero.debug("ClaudeCliWrapper.installClaude: Error storing API key in preferences:", prefError);
		}

		// Step 1: Install Claude CLI
			Zotero.debug("ClaudeCliWrapper.installClaude: Installing Claude CLI...");
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
			Zotero.debug("ClaudeCliWrapper.installClaude: npm install result:", JSON.stringify(installResult));
			
			// Check if installation was successful
			if (installResult && (installResult.includes('error') || installResult.includes('failed'))) {
				return { ok: false, error: new Error(`npm install failed: ${installResult}`) };
			}

					// Step 2: Set API key with multiple persistent approaches for one-click solution
		Zotero.debug("ClaudeCliWrapper.installClaude: Setting API key with multiple approaches...");
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
				Zotero.debug("ClaudeCliWrapper.installClaude: WSL env setting error:", e);
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
					Zotero.debug("ClaudeCliWrapper.installClaude: System-level setx failed (expected if not admin):", adminError);
				}
			} catch (e) {
				Zotero.debug("ClaudeCliWrapper.installClaude: Windows env setting error:", e);
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
				Zotero.debug("ClaudeCliWrapper.installClaude: Unix env setting error:", e);
			}
		}

			Zotero.debug("ClaudeCliWrapper.installClaude: env variable result:", JSON.stringify(envResult));

					// Step 3: Verify installation
		Zotero.debug("ClaudeCliWrapper.installClaude: Verifying installation...");
		const verifyResult = await this.checkClaude(workingDirOverride);
		Zotero.debug("ClaudeCliWrapper.installClaude: verification result:", JSON.stringify(verifyResult));

		// Step 4: Test immediate API key functionality (one-click verification)
		let apiTestResult = null;
		if (verifyResult.exists) {
			try {
				Zotero.debug("ClaudeCliWrapper.installClaude: Testing immediate API key functionality...");
				apiTestResult = await this.runClaude([], workingDirOverride, "test", null, false, null);
				Zotero.debug("ClaudeCliWrapper.installClaude: API test result:", JSON.stringify(apiTestResult));
			} catch (testError) {
				Zotero.debug("ClaudeCliWrapper.installClaude: API test error:", testError);
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
			Zotero.debug("ClaudeCliWrapper.installClaude: error:", e);
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
			Zotero.debug("ClaudeCliWrapper.saveClaudeResponseToNote: error:", error);
			throw error;
		}
	}
};

Zotero.debug("ClaudeCliWrapper: Module loaded successfully");
module.exports = ClaudeCliWrapper;



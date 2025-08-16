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
	runClaude: async function(args = [], workingDirOverride = null, stdinText = null, noteContainer = null, saveClaudeResponse = false, systemPrompt = null) {
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

		// Normalize args to strings and add system prompt if provided
		let safeArgs = Array.isArray(args) ? args.map(a => String(a)) : [];
		Zotero.debug(`ClaudeCliWrapper.runClaude: safeArgs=${JSON.stringify(safeArgs)}`);
		Zotero.debug(`ClaudeCliWrapper.runClaude: systemPrompt=${systemPrompt}`);
		// Always use -p flag for input text (system prompt functionality disabled)
		let usePFlag = false;
		if (stdinText != null) {
			safeArgs.unshift('-p', `"${stdinText}"`);
			usePFlag = true; // Track that we're using -p flag
			Zotero.debug(`ClaudeCliWrapper.runClaude: Using -p flag with input text`);
		}
		
		// System prompt functionality is disabled (kept for reference)
		if (false && systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
			safeArgs.push('--append-system-prompt', `"${systemPrompt.trim()}"`);
			Zotero.debug(`ClaudeCliWrapper.runClaude: Using system prompt: ${systemPrompt.trim()}`);
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

			if (wslInfo) {
				// Execute inside WSL bash, optionally cd to linuxDir
				command = "C:\\Windows\\System32\\wsl.exe";
				const joined = joinArgs(safeArgs);
				const shBody = usePFlag
					? `claude${joined}`  // Using -p flag, no piping needed
					: (stdinText != null
						? `printf "%s" "${escapeForBashDoubleQuoted(stdinText)}" | claude${joined}`
						: `claude${joined}`);
				const shLine = workingDirPath ? `cd "${wslInfo.linuxDir}" && ${shBody}` : shBody;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
			}
			else if (Zotero.isWin) {
				// Native Windows CMD
				command = "C:\\Windows\\System32\\cmd.exe";
				const joined = joinArgs(safeArgs);
				const body = usePFlag
					? `claude${joined}`  // Using -p flag, no piping needed
					: (stdinText != null
						? `echo ${escapeForCmdEcho(stdinText)} | claude${joined}`
						: `claude${joined}`);
				const line = workingDirPath ? `cd /d "${workingDirPath}" && ${body}` : body;
				spArgs = ["/d", "/s", "/c", line];
			}
			else {
				// Unix-like shells
				command = "/bin/sh";
				const joined = joinArgs(safeArgs);
				const line = workingDirPath
					? (usePFlag
						? `cd "${workingDirPath}" && claude${joined}`  // Using -p flag, no piping needed
						: (stdinText != null
							? `cd "${workingDirPath}" && printf "%s" "${escapeForBashDoubleQuoted(stdinText)}" | claude${joined}`
							: `cd "${workingDirPath}" && claude${joined}`))
					: (usePFlag
						? `claude${joined}`  // Using -p flag, no piping needed
						: (stdinText != null
							? `printf "%s" "${escapeForBashDoubleQuoted(stdinText)}" | claude${joined}`
							: `claude${joined}`));
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
		const timeout = 120000; // allow time for npm install
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

			let command;
			let spArgs;
			let options = { timeout };

			if (wslInfo) {
				command = "C:\\Windows\\System32\\wsl.exe";
				const shLine = workingDirPath
					? `cd "${wslInfo.linuxDir}" && npm install -g @anthropic-ai/claude-code && export ANTHROPIC_API_KEY="${String(apiKey || '')}"`
					: `npm install -g @anthropic-ai/claude-code && export ANTHROPIC_API_KEY="${String(apiKey || '')}"`;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
			}
			else if (Zotero.isWin) {
				command = "C:\\Windows\\System32\\cmd.exe";
				// setx persists user-level env var
				const line = workingDirPath
					? `cd /d "${workingDirPath}" && npm install -g @anthropic-ai/claude-code && setx ANTHROPIC_API_KEY "${String(apiKey || '')}"`
					: `npm install -g @anthropic-ai/claude-code && setx ANTHROPIC_API_KEY "${String(apiKey || '')}"`;
				spArgs = ["/d", "/s", "/c", line];
			}
			else {
				command = "/bin/sh";
				const line = workingDirPath
					? `cd "${workingDirPath}" && npm install -g @anthropic-ai/claude-code && export ANTHROPIC_API_KEY="${String(apiKey || '')}"`
					: `npm install -g @anthropic-ai/claude-code && export ANTHROPIC_API_KEY="${String(apiKey || '')}"`;
				spArgs = ["-lc", line];
			}

			const res = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			Zotero.debug("ClaudeCliWrapper.installClaude: result:", JSON.stringify(res));
			return { ok: true, result: res };
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



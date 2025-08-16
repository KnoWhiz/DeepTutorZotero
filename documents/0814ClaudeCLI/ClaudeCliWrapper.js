let { Cc, Ci } = require('chrome');

const ClaudeCliWrapper = {
	_subprocessAvailable: function() {
		return !!(Zotero.Utilities && Zotero.Utilities.Internal && typeof Zotero.Utilities.Internal.subprocess === 'function');
	},

	// Execute the local "claude" CLI with optional args and stdin
	// - args: array of string arguments for the claude command
	// - workingDirOverride: optional string path; if omitted or invalid, no explicit cwd change is attempted
	// - stdinText: optional string piped to the process via shell (printf/echo)
	runClaude: async function(args = [], workingDirOverride = null, stdinText = null) {
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

		// Normalize args to strings
		const safeArgs = Array.isArray(args) ? args.map(a => String(a)) : [];

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
				const shBody = (stdinText != null)
					? `printf "%s" "${escapeForBashDoubleQuoted(stdinText)}" | claude${joined}`
					: `claude${joined}`;
				const shLine = workingDirPath ? `cd "${wslInfo.linuxDir}" && ${shBody}` : shBody;
				spArgs = ["-d", wslInfo.distro, "--", "bash", "-lc", shLine];
			}
			else if (Zotero.isWin) {
				// Native Windows CMD
				command = "C:\\Windows\\System32\\cmd.exe";
				const joined = joinArgs(safeArgs);
				const body = (stdinText != null)
					? `echo ${escapeForCmdEcho(stdinText)} | claude${joined}`
					: `claude${joined}`;
				const line = workingDirPath ? `cd /d "${workingDirPath}" && ${body}` : body;
				spArgs = ["/d", "/s", "/c", line];
			}
			else {
				// Unix-like shells
				command = "/bin/sh";
				const joined = joinArgs(safeArgs);
				const line = workingDirPath
					? (stdinText != null
						? `cd "${workingDirPath}" && printf "%s" "${escapeForBashDoubleQuoted(stdinText)}" | claude${joined}`
						: `cd "${workingDirPath}" && claude${joined}`)
					: (stdinText != null
						? `printf "%s" "${escapeForBashDoubleQuoted(stdinText)}" | claude${joined}`
						: `claude${joined}`);
				spArgs = ["-lc", line];
			}

			const res = await Zotero.Utilities.Internal.subprocess(command, spArgs, options);
			Zotero.debug("ClaudeCliWrapper.runClaude: result:", JSON.stringify(res));
			return res;
		}
		catch (e) {
			Zotero.debug("ClaudeCliWrapper.runClaude: error:", e);
			return { error: e };
		}
	}
};

Zotero.debug("ClaudeCliWrapper: Module loaded successfully");
module.exports = ClaudeCliWrapper;



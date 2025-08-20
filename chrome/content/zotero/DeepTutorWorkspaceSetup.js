import React, { useEffect, useState } from "react"; // eslint-disable-line no-unused-vars
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";

// Close icon paths
const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg";
const PopupCloseDarkPath = "chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg";

/**
 * Full-screen first-run workspace setup popup for DeepTutor.
 *
 * Options:
 *  - Start New Workspace: create ~/DeepTutor next to the current data dir's parent and set it
 *  - Copy from Zotero: copy current data dir to ~/DeepTutor and set it
 *  - Share with Zotero: keep current data dir
 *
 * On success this sets the prefs flag `deeptutor.workspaceSetupCompleted` and calls onComplete().
 */
export default function DeepTutorWorkspaceSetup({ onClose, onComplete }) {
	const { colors, isDark } = useDeepTutorTheme();
	const closeIcon = isDark ? PopupCloseDarkPath : PopupClosePath;

	const [choice, setChoice] = useState("start");
	const [isWorking, setIsWorking] = useState(false);
	const [error, setError] = useState("");
	const [portalEl, setPortalEl] = useState(null);
	const [page, setPage] = useState("main"); // 'main' | 'pathEntry'
	const [pathPurpose, setPathPurpose] = useState("copy"); // 'copy' | 'share'
	const [customZoteroPath, setCustomZoteroPath] = useState("");
	const [showHelpPopup, setShowHelpPopup] = useState(false);
	const [bgSize, setBgSize] = useState({ width: 0, height: 0 });

	// Create a portal container in the top-level Zotero window so we can block the whole UI
	useEffect(() => {
		try {
			const win = (typeof window !== 'undefined' && window.top) ? window.top : window;
			const doc = win && win.document ? win.document : document;
			if (!doc) {
				console.log('[DeepTutor Setup] No document available for portal creation');
				return;
			}
			let container = doc.getElementById('deeptutor-workspace-setup-overlay-root');
			if (!container) {
				container = doc.createElement('div');
				container.id = 'deeptutor-workspace-setup-overlay-root';
				(doc.documentElement || doc.body).appendChild(container);
			}
			setPortalEl(container);
			return () => {
				try {
					if (container && container.parentNode) {
						container.parentNode.removeChild(container);
					}
				}
				catch (e) {
					// ignore cleanup errors
				}
			};
		}
		catch (e) {
			console.log('[DeepTutor Setup] Failed to create portal container:', e);
		}
	}, []);

	// Load background image dimensions to size container to image
	useEffect(() => {
		try {
			const img = new Image();
			img.onload = () => {
				// Scale down to fit viewport while preserving aspect ratio
				const maxW = Math.floor(window.innerWidth * 0.95);
				const maxH = Math.floor(window.innerHeight * 0.92);
				const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
				const w = Math.max(320, Math.round(img.naturalWidth * scale));
				const h = Math.max(240, Math.round(img.naturalHeight * scale));
				setBgSize({ width: w, height: h });
			};
			img.src = isDark
				? "chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/dark_mode_background.png"
				: "chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/light_mode_background.png";
		}
		catch (e) {}
	}, [isDark]);

	// Styles for the popup container and elements
	const styles = {
		overlay: {
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: isDark ? "#000000" : "#FFFFFF", // Solid background color
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 2000,
			backgroundImage: `url(${isDark ? "chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/dark_mode_background.png" : "chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/light_mode_background.png"})`,
			backgroundSize: '1512px 945px',
			backgroundRepeat: 'no-repeat',
			backgroundPosition: 'center',
		},
		container: {
			position: "relative",
			width: "1512px",
			height: "945px",
			background: "transparent",
			borderRadius: "0.75rem",
			border: "none",
			padding: "0",
			boxShadow: "none",
			fontFamily: "Roboto, Inter, Arial, sans-serif",
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			textAlign: 'center',
		},
		contentArea: {
			width: "821px",
			height: "609px",
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			padding: "2.5rem 3rem",
		},
		logo: {
			width: '10rem',
			height: 'auto',
			marginBottom: '1rem',
		},
		title: {
			width: "100%",
			textAlign: "center",
			margin: 0,
			marginBottom: "1rem",
			fontWeight: 800,
			fontSize: "3rem", // 48px
			lineHeight: 1.15,
			color: isDark ? "#FFFFFF" : "#1C1B1F",
		},
		subtitle: {
			fontSize: "2rem", // 32px
			fontWeight: 600,
			color: colors.text.primary,
			marginBottom: "1.5rem",
			textAlign: 'left',
			width: '100%',
		},
		optionRow: {
			display: "flex",
			alignItems: "center",
			gap: "0.75rem",
			padding: "0.75rem 1rem",
			borderRadius: "0.5rem",
			border: `1px solid ${colors.border.primary}`,
			marginBottom: "0.5rem",
			cursor: "pointer",
			background: "transparent",
		},
		optionLabel: {
			color: colors.text.primary,
			fontSize: "1rem",
			fontWeight: 600,
			flexGrow: 1,
			textAlign: 'left',
		},
		actions: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: 'center',
			width: '100%',
			marginTop: "1.5rem",
		},
		spacer: {
			flexGrow: 1,
		},
		primary: {
			all: "revert",
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			borderRadius: "0.5rem",
			padding: "0.75rem 2rem", // Wider padding for wider button
			minWidth: "120px", // Ensure minimum width
			fontWeight: 700,
			cursor: "pointer"
		},
		secondary: {
			all: "revert",
			background: colors.background.quaternary,
			color: colors.text.primary,
			border: `1px solid ${colors.border.primary}`,
			borderRadius: "0.5rem",
			padding: "0.75rem 1.25rem",
			fontWeight: 600,
			cursor: "pointer"
		},
		hint: {
			fontSize: "0.875rem",
			color: colors.text.secondary,
			marginLeft: "2.5rem",
			marginBottom: "1rem",
			fontStyle: "italic",
		},
		error: {
			color: colors.error.primary,
			backgroundColor: colors.error.background,
			padding: "0.75rem",
			borderRadius: "0.5rem",
			marginBottom: "1rem",
			border: `1px solid ${colors.error.border}`,
		},
		close: {
			all: "revert",
			position: "absolute",
			right: "1rem",
			top: "1rem",
			background: "none",
			border: "none",
			width: "1.25rem",
			height: "1.25rem",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		backButton: {
			all: "revert",
			position: "absolute",
			left: "1rem",
			top: "1rem",
			background: colors.background.quaternary,
			border: `1px solid ${colors.border.primary}`,
			color: colors.text.primary,
			borderRadius: "0.5rem",
			padding: "0.25rem 0.75rem",
			cursor: "pointer",
			fontWeight: 600,
		},
		input: {
			width: "100%",
			padding: "0.75rem",
			borderRadius: "0.5rem",
			border: `1px solid ${colors.border.primary}`,
			color: colors.text.primary,
			background: colors.background.primary,
			fontFamily: "Roboto, sans-serif",
		},
		textButton: {
			all: "revert",
			background: "transparent",
			border: "none",
			color: "#0687E5",
			cursor: "pointer",
			textDecoration: "underline",
			fontFamily: "Roboto, sans-serif",
			fontSize: "1rem",
			marginTop: "0.75rem",
		},
		helpOverlay: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: "rgba(0,0,0,0.5)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 2100,
		},
		helpContent: {
			background: colors.background.primary,
			border: isDark ? `1px solid ${colors.popup.border}` : "none",
			borderRadius: "0.5rem",
			padding: "1.5rem",
			maxWidth: "32rem",
			width: "90%",
		},
	};

	const getOriginalDataDirFromAdvanced = () => {
		try {
			const useDataDir = Zotero.Prefs.get("useDataDir");
			const prefVal = Zotero.Prefs.get("lastDataDir") || Zotero.Prefs.get("dataDir");
			const fromPrefs = useDataDir && prefVal ? prefVal : null;
			const original = fromPrefs || Zotero.DataDirectory.defaultDir;
			console.log("[DeepTutor Setup] Original (advanced) data dir:", original, "useDataDir:", useDataDir);
			return original;
		}
		catch (e) {
			console.log("[DeepTutor Setup] Error reading advanced data dir prefs:", e);
			return Zotero.DataDirectory.defaultDir;
		}
	};

	const computeDeepTutorDir = () => {
		// Default DeepTutor location under home directory
		try {
			if (typeof OS !== "undefined" && OS.Constants && OS.Constants.Path && OS.Constants.Path.homeDir) {
				return PathUtils.join(OS.Constants.Path.homeDir, "DeepTutor");
			}
		}
		catch (e) {}
		// Fallback: base on Zotero default dir parent
		try {
			const base = Zotero.DataDirectory.defaultDir;
			const parent = PathUtils.parent(base);
			return PathUtils.join(parent, "DeepTutor");
		}
		catch (e) {
			console.log("[DeepTutor Setup] computeDeepTutorDir fallback failed:", e);
			return PathUtils.join("~", "DeepTutor");
		}
	};

	const markCompleted = () => {
		try {
			Zotero.Prefs.set("deeptutor.workspaceSetupCompleted", true);
		}
		catch (e) {
			// ignore
		}
	};

	const restartNow = () => {
		try {
			if (typeof Services !== 'undefined' && Services.startup && Components && Components.interfaces) {
				Services.startup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
			}
			else {
				console.log('[DeepTutor Setup] Restart requested; Services not available. Please restart Zotero manually.');
			}
		}
		catch (e) {
			Zotero.debug(`DeepTutor: Failed to trigger restart: ${e}`);
		}
	};

	const handleContinue = async () => {
		if (isWorking) return;
		setError("");
		setIsWorking(true);
		try {
			if (choice === "share") {
				markCompleted();
				setIsWorking(false);
				if (onComplete) onComplete();
				return;
			}

			const originalDir = getOriginalDataDirFromAdvanced();
			const deepTutorDir = computeDeepTutorDir();
			console.log("[DeepTutor Setup] Choice:", choice, "originalDir:", originalDir, "deepTutorDir:", deepTutorDir);

			if (choice === "start") {
				await IOUtils.makeDirectory(deepTutorDir, { ignoreExisting: true, permissions: 0o755 });
				// Use deeptutor.sqlite in a new DeepTutor data folder (do not interfere with Zotero dataDir)
				Zotero.Prefs.set("deeptutor.dataDir", deepTutorDir);
				markCompleted();
				setIsWorking(false);
				if (onComplete) onComplete();
				return;
			}

			if (choice === "copy") {
				// Create target if missing and ensure not copying into itself
				if (deepTutorDir === originalDir) {
					throw new Error("Computed DeepTutor directory equals current data directory");
				}
				await IOUtils.makeDirectory(deepTutorDir, { ignoreExisting: true, permissions: 0o755 });
				// If target non-empty, abort to avoid unsafe merge
				const targetEmpty = await Zotero.File.directoryIsEmpty(deepTutorDir);
				if (!targetEmpty) {
					throw new Error("Target DeepTutor directory is not empty. Choose 'Start New Workspace' or clear the folder.");
				}
				console.log("[DeepTutor Setup] Copying directory...", { from: originalDir, to: deepTutorDir });
				await Zotero.File.copyDirectory(originalDir, deepTutorDir);
				// Rename zotero.sqlite to deeptutor.sqlite if present
				try {
					const dbFrom = PathUtils.join(deepTutorDir, "zotero.sqlite");
					await IOUtils.stat(dbFrom);
					await OS.File.move(dbFrom, PathUtils.join(deepTutorDir, "deeptutor.sqlite"));
				}
				catch (e) {
					console.log("[DeepTutor Setup] Database rename step (zotero.sqlite -> deeptutor.sqlite) skipped or failed:", e);
				}
				Zotero.Prefs.set("deeptutor.dataDir", deepTutorDir);
				markCompleted();
				setIsWorking(false);
				if (onComplete) onComplete();
			}
		}
		catch (e) {
			setError(e && e.message ? e.message : String(e));
			console.log("[DeepTutor Setup] Error during workspace operation:", e);
			setIsWorking(false);
		}
	};

	const isFirstRun = !Zotero.Prefs.get("deeptutor.workspaceSetupCompleted");

	const overlay = (
		<div style={styles.overlay}>
			<div style={styles.container}>
				<button style={styles.close} onClick={onClose} aria-label="Close">
					<img src={closeIcon} alt="Close" style={{ width: "1.25rem", height: "1.25rem" }} />
				</button>

				{page === "main" && (
					<>
						<img src="chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/deeptutor_main.svg" alt="DeepTutor" style={styles.logo} />
						<h2 style={styles.title}>Welcome to DeepTutor</h2>
						<div style={styles.subtitle}>How would you like to set up your DeepTutor workspace?</div>
						<div style={{ textAlign: "center", color: colors.text.tertiary, marginBottom: "1.25rem" }}>First-time setup: {isFirstRun ? "Yes" : "No (showing for testing)"}</div>

						<div role="radiogroup" aria-label="Workspace setup options" style={{ width: '100%', maxWidth: '24rem', marginTop: "1rem" }}>
							<label style={styles.optionRow} onClick={() => setChoice("start")}>
								<input type="radio" name="dt-setup" checked={choice === "start"} onChange={() => setChoice("start")} />
								<span style={styles.optionLabel}>Start New Workspace</span>
							</label>
							<div style={styles.hint}>Create a new, empty DeepTutor folder for your data.</div>

							<label style={styles.optionRow} onClick={() => setChoice("copy")}>
								<input type="radio" name="dt-setup" checked={choice === "copy"} onChange={() => setChoice("copy")} />
								<span style={styles.optionLabel}>Copy from Zotero</span>
							</label>
							<div style={styles.hint}>Copy your existing Zotero data into a new DeepTutor folder.</div>

							<label style={styles.optionRow} onClick={() => setChoice("share")}>
								<input type="radio" name="dt-setup" checked={choice === "share"} onChange={() => setChoice("share")} />
								<span style={styles.optionLabel}>Share with Zotero</span>
							</label>
							<div style={styles.hint}>Use your existing Zotero data directly. Note: You can't run both apps at the same time.</div>
						</div>

						{error ? <div style={styles.error}>{error}</div> : null}

						<div style={styles.actions}>
							<div style={styles.spacer}></div>
							<button style={styles.secondary} onClick={onClose} disabled={isWorking}>Cancel</button>
							<button style={styles.primary} onClick={handleContinue} disabled={isWorking}>{isWorking ? "Working..." : "Continue"}</button>
						</div>
					</>
				)}

				{page === "pathEntry" && (
					<>
						<button style={styles.backButton} onClick={() => {
							setPage("main"); setError("");
						}}>Back</button>
						<h2 style={styles.title}>Find Zotero Data Directory</h2>
						<div style={{ color: colors.text.primary, fontWeight: 600, marginBottom: "0.75rem" }}>
                            To {pathPurpose === "copy" ? "copy Zotero's workspace with DeepTutor" : "share Zotero's workspace with DeepTutor"}, please copy your Zotero Data Directory path here:
						</div>
						<input
							style={styles.input}
							placeholder="Your Zotero Data Directory"
							value={customZoteroPath}
							onChange={e => setCustomZoteroPath(e.target.value)}
						/>
						<button style={styles.textButton} onClick={() => setShowHelpPopup(true)}>How to find my Zotero file path?</button>
						{error ? <div style={styles.error}>{error}</div> : null}
						<div style={styles.actions}>
							<button style={styles.secondary} onClick={() => {
								setPage("main"); setError("");
							}} disabled={isWorking}>Back</button>
							<button style={styles.primary} onClick={handlePathEntryContinue} disabled={isWorking}>{isWorking ? "Working..." : "Continue"}</button>
						</div>
						{showHelpPopup && (
							<div style={styles.helpOverlay}>
								<div style={styles.helpContent}>
									<div style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: "0.5rem", color: colors.text.primary }}>Find My Zotero Data Directory</div>
									<div style={{ color: colors.text.primary, marginBottom: "1rem" }}>
										{Zotero.isWin
											? "Please navigate to Edit > Settings > Data Directory Location. Please copy the path into the input box"
											: "Please navigate to Zotero > Settings > Data Directory Location. Please copy the path into the input box"}
									</div>
									<div style={{ display: "flex", justifyContent: "flex-end" }}>
										<button style={styles.primary} onClick={() => setShowHelpPopup(false)}>OK</button>
									</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);

	if (!portalEl) {
		// Container not ready yet; avoid rendering to an invalid portal target
		return null;
	}
	return ReactDOM.createPortal(overlay, portalEl);
}

DeepTutorWorkspaceSetup.propTypes = {
	onClose: PropTypes.func,
	onComplete: PropTypes.func
};



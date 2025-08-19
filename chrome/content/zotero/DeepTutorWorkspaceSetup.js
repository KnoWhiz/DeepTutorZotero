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

    const [choice, setChoice] = useState("share");
    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState("");
    const [portalEl, setPortalEl] = useState(null);

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

    const styles = {
        overlay: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
        },
        container: {
            position: "relative",
            width: "min(56rem, 92vw)",
            maxHeight: "92vh",
            background: colors.background.primary,
            borderRadius: "0.75rem",
            border: isDark ? `1px solid ${colors.popup.border}` : "none",
            padding: "2.5rem 3rem",
            boxShadow: "0 0.75rem 2rem rgba(0,0,0,0.25)",
            fontFamily: "Roboto, Inter, Arial, sans-serif"
        },
        title: {
            width: "100%",
            textAlign: "center",
            margin: 0,
            marginBottom: "2rem",
            fontWeight: 800,
            fontSize: "2rem",
            lineHeight: 1.15,
            background: "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "#0687E5"
        },
        optionRow: {
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            border: `1px solid ${colors.border.primary}`,
            marginBottom: "0.75rem",
            cursor: "pointer",
            background: colors.background.quaternary
        },
        optionLabel: {
            color: colors.text.primary,
            fontSize: "1rem",
            fontWeight: 600
        },
        hint: {
            color: colors.text.tertiary,
            fontSize: "0.9rem",
            marginLeft: "2rem",
            marginTop: "-0.25rem",
            marginBottom: "0.75rem"
        },
        actions: {
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.5rem"
        },
        primary: {
            all: "revert",
            background: colors.button.primary,
            color: colors.button.primaryText,
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.75rem 1.25rem",
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
        error: {
            color: "#ef4444",
            fontSize: "0.95rem",
            marginTop: "0.75rem"
        }
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
        const originalDir = getOriginalDataDirFromAdvanced();
        try {
            const parent = PathUtils.parent(originalDir);
            const dst = OS.Path.join(parent, "DeepTutor");
            console.log("[DeepTutor Setup] Computed DeepTutor dir:", dst, "from original:", originalDir);
            return dst;
        } catch (e) {
            console.log("[DeepTutor Setup] Failed computing DeepTutor dir, falling back to home/DeepTutor:", e);
            return OS.Path.join(OS.Constants.Path.homeDir, "DeepTutor");
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
                // Ensure directory exists, do not copy anything
                await IOUtils.makeDirectory(deepTutorDir, { ignoreExisting: true, permissions: 0o755 });
                Zotero.DataDirectory.set(deepTutorDir);
                markCompleted();
                restartNow();
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
                Zotero.DataDirectory.set(deepTutorDir);
                markCompleted();
                restartNow();
                return;
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

                <h2 style={styles.title}>Welcome to DeepTutor</h2>
                <div style={{ textAlign: "center", color: colors.text.primary, marginBottom: "0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>How would you like to set up your DeepTutor workspace?</div>
                <div style={{ textAlign: "center", color: colors.text.tertiary, marginBottom: "1.25rem" }}>First-time setup: {isFirstRun ? "Yes" : "No (showing for testing)"}</div>

                <div role="radiogroup" aria-label="Workspace setup options" style={{ marginTop: "1rem" }}>
                    <label style={styles.optionRow} onClick={() => setChoice("start")}> 
                        <input type="radio" name="dt-setup" checked={choice === "start"} onChange={() => setChoice("start")} />
                        <span style={styles.optionLabel}>Start New Workspace</span>
                    </label>

                    <label style={styles.optionRow} onClick={() => setChoice("copy")}> 
                        <input type="radio" name="dt-setup" checked={choice === "copy"} onChange={() => setChoice("copy")} />
                        <span style={styles.optionLabel}>Copy from Zotero</span>
                    </label>

                    <label style={styles.optionRow} onClick={() => setChoice("share")}> 
                        <input type="radio" name="dt-setup" checked={choice === "share"} onChange={() => setChoice("share")} />
                        <span style={styles.optionLabel}>Share with Zotero</span>
                    </label>
                    <div style={styles.hint}>Note: Sharing database with Zotero means you cant run both apps at the same time.</div>
                </div>

                {error ? <div style={styles.error}>{error}</div> : null}

                <div style={styles.actions}>
                    <button style={styles.secondary} onClick={onClose} disabled={isWorking}>Cancel</button>
                    <button style={styles.primary} onClick={handleContinue} disabled={isWorking}>{isWorking ? "Working..." : "Continue"}</button>
                </div>
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



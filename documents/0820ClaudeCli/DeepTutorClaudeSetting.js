import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';
const ClaudeCliWrapper = require('./ClaudeCliWrapper.js');

export default function DeepTutorClaudeSetting({ onClose, onSetSysPrompt, onSetAutoSaveNote, workingDirResolver, noteContainer, currentAutoSave }) {
	const { colors } = useDeepTutorTheme();

	const styles = {
		container: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0, 0, 0, 0.5)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		},
		form: {
			background: colors.background.primary,
			borderRadius: '0.5rem',
			padding: '2rem',
			maxWidth: '32rem',
			width: '100%',
			position: 'relative',
		},
		header: {
			width: '100%',
			textAlign: 'center',
			background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
			WebkitBackgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
			backgroundClip: 'text',
			color: '#0687E5',
			fontWeight: 700,
			fontSize: '1.5rem',
			lineHeight: '1.2',
			letterSpacing: '0%',
			marginBottom: '1.5rem'
		},
		closeButton: {
			all: 'revert',
			background: 'transparent',
			border: 'none',
			cursor: 'pointer',
			padding: '0.75rem',
			borderRadius: '0.25rem',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			color: colors.text.tertiary,
			fontSize: '2rem',
			lineHeight: 1,
			position: 'absolute',
			right: '0rem',
			top: '1rem',
		},
		section: {
			marginBottom: '1rem'
		},
		label: {
			fontWeight: 500,
			fontSize: '0.95rem',
			lineHeight: '135%',
			color: colors.text.secondary,
			marginBottom: '0.5rem',
			display: 'block'
		},
		input: {
			width: '100%',
			minHeight: '2.5rem',
			borderRadius: '0.625rem',
			border: `1px solid ${colors.border.primary}`,
			padding: '0.5rem',
			background: colors.background.tertiary,
			fontSize: '1rem',
			fontFamily: 'Roboto, sans-serif',
			outline: 'none',
			boxSizing: 'border-box',
			color: colors.text.allText
		},
		row: {
			display: 'flex',
			gap: '0.5rem'
		},
		button: {
			all: 'revert',
			width: '100%',
			borderRadius: '0.625rem',
			padding: '0.75rem 1rem',
			background: colors.button.primary,
			color: colors.button.primaryText,
			fontWeight: 700,
			fontSize: '1rem',
			border: 'none',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2
		},
		modelTypeRow: {
			display: 'flex',
			flexDirection: 'row',
			width: '100%',
			background: '#F8F6F7',
			marginBottom: '0.5rem',
			justifyContent: 'space-between',
			gap: '0.5rem',
			borderRadius: '0.625rem',
			boxSizing: 'border-box',
			padding: '0.25rem',
		},
		modelTypeButton: {
			flex: '1 1 0',
			minHeight: '3rem',
			borderRadius: '0.5rem',
			padding: '0.75rem 0.9375rem',
			border: 'none',
			fontWeight: 400,
			fontSize: '1rem',
			lineHeight: '180%',
			letterSpacing: '0%',
			verticalAlign: 'middle',
			cursor: 'pointer',
			background: '#F8F6F7',
			color: '#757575',
			transition: 'background 0.2s, color 0.2s',
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			minWidth: 0,
			width: 'auto',
			maxWidth: 'none',
		},
		modelTypeButtonSelected: {
			background: '#D9D9D9',
			color: '#292929',
			fontWeight: 400,
			fontSize: '1rem',
			lineHeight: '180%',
			letterSpacing: '0%',
			minHeight: '3rem',
			verticalAlign: 'middle',
		},
		desc: {
			fontSize: '0.9rem',
			color: colors.text.tertiary,
			marginTop: '0.25rem'
		}
	};

	const [apiKey, setApiKey] = useState('');
	const [sysPrompt, setSysPrompt] = useState(() => {
		try {
			// Initialize with current system prompt from Zotero preferences
			return Zotero.Prefs.get('deeptutor.claude.systemPrompt') || '';
		}
		catch (e) { 
			Zotero.debug(e); 
			return ''; 
		}
	});
	const [autoSave, setAutoSave] = useState(() => {
		try {
			// Initialize with current value or from Zotero preferences
			if (typeof currentAutoSave === 'boolean') return currentAutoSave;
			return Zotero.Prefs.get('deeptutor.claude.autoSaveResponse') === true;
		}
		catch (e) { 
			Zotero.debug(e); 
			return false; 
		}
	});
	const [checkResult, setCheckResult] = useState(null);
	const [busy, setBusy] = useState(false);

	const resolveWorkingDir = () => {
		try {
			if (typeof workingDirResolver === 'function') {
				return workingDirResolver();
			}
			const prefDir = Zotero.Prefs.get('dataDir') || Zotero.Prefs.get('lastDataDir');
			if (prefDir && typeof prefDir === 'string') return prefDir;
			if (Zotero.DataDirectory && typeof Zotero.DataDirectory.dir === 'string') return Zotero.DataDirectory.dir;
		}
		catch (e) { Zotero.debug(e); }
		return '/home/sherman01/Zotero';
	};

	const handleCheckClaude = async () => {
		if (busy) return;
		setBusy(true);
		try {
			const cwd = resolveWorkingDir();
			const res = await ClaudeCliWrapper.checkClaude(cwd);
			Zotero.debug(`DeepTutorClaudeSetting: checkClaude => ${JSON.stringify(res)}`);
			setCheckResult(res && res.exists === true ? 'claude exists' : 'claude does not exist');
		}
		catch (e) {
			Zotero.debug(`DeepTutorClaudeSetting: checkClaude error: ${e}`);
			setCheckResult('claude does not exist');
		}
		finally { setBusy(false); }
	};

	const handleInstallClaude = async () => {
		if (busy) return;
		
		// Check if API key is empty
		if (!apiKey || !apiKey.trim()) {
			Zotero.alert(null, 'Claude', 'Please enter your Anthropic API key before installing.');
			return;
		}
		
		setBusy(true);
		try {
			const cwd = resolveWorkingDir();
			const res = await ClaudeCliWrapper.installClaude(apiKey, cwd);
			Zotero.debug(`DeepTutorClaudeSetting: installClaude => ${JSON.stringify(res)}`);
			Zotero.alert(null, 'Claude', res && res.ok ? 'Install command executed' : 'Install failed');
		}
		catch (e) {
			Zotero.debug(`DeepTutorClaudeSetting: installClaude error: ${e}`);
			Zotero.alert(null, 'Claude', `Install failed: ${e}`);
		}
		finally { setBusy(false); }
	};

	const handleConfirmSysPrompt = () => {
		try {
			if (typeof onSetSysPrompt === 'function') {
				Zotero.debug(`DeepTutorClaudeSetting: Setting system prompt to: ${sysPrompt}`);
				onSetSysPrompt(sysPrompt);
				Zotero.debug('DeepTutorClaudeSetting: SysPrompt set successfully');
			}
		}
		catch (e) { Zotero.debug(e); }
	};

	const handleConfirmAutoSave = (value = autoSave) => {
		try {
			if (typeof onSetAutoSaveNote === 'function') {
				onSetAutoSaveNote(!!value);
				Zotero.debug('DeepTutorClaudeSetting: AutoSave set');
			}
		}
		catch (e) { Zotero.debug(e); }
	};

	const getModelTypeButtonStyle = (isSelected) => {
		return {
			...styles.modelTypeButton,
			...(isSelected ? styles.modelTypeButtonSelected : {}),
		};
	};

	return (
		<div style={styles.container}>
			<div style={styles.form}>
				{/* Header */}
				<div style={styles.header}>
					Claude CLI Settings
				</div>
				
				{/* Close button positioned at top right */}
				<button
					onClick={onClose}
					style={styles.closeButton}
				>
					×
				</button>

				<div style={styles.section}>
					<label style={styles.label}>Check Claude CLI</label>
					<div style={styles.row}>
						<button style={styles.button} onClick={handleCheckClaude} disabled={busy}>Check Claude CLI Exists</button>
					</div>
					{checkResult && (<div style={styles.desc}>{checkResult}</div>)}
				</div>

				<div style={styles.section}>
					<label style={styles.label}>Install Claude</label>
					<input
						style={styles.input}
						placeholder="Enter ANTHROPIC_API_KEY"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
					/>
					<div style={{ ...styles.row, marginTop: '0.5rem' }}>
						<button style={styles.button} onClick={handleInstallClaude} disabled={busy}>Confirm</button>
					</div>
				</div>

				<div style={styles.section}>
					<label style={styles.label}>Customize System Prompt</label>
					<input
						style={styles.input}
						placeholder="Enter system prompt"
						value={sysPrompt}
						onChange={(e) => setSysPrompt(e.target.value)}
					/>
					<div style={{ ...styles.row, marginTop: '0.5rem' }}>
						<button style={styles.button} onClick={handleConfirmSysPrompt} disabled={busy}>Confirm</button>
					</div>
				</div>

				<div style={styles.section}>
					<label style={styles.label}>AutoSave To Note</label>
					<div style={styles.modelTypeRow}>
						<button
							style={{
								all: 'revert',
								...getModelTypeButtonStyle(!autoSave)
							}}
							onClick={() => {
								setAutoSave(false);
								handleConfirmAutoSave(false);
							}}
							disabled={busy}
						>
							No
						</button>
						<button
							style={{
								all: 'revert',
								...getModelTypeButtonStyle(autoSave)
							}}
							onClick={() => {
								setAutoSave(true);
								handleConfirmAutoSave(true);
							}}
							disabled={busy}
						>
							Yes
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

DeepTutorClaudeSetting.propTypes = {
	onClose: PropTypes.func.isRequired,
	onSetSysPrompt: PropTypes.func.isRequired,
	onSetAutoSaveNote: PropTypes.func.isRequired,
	workingDirResolver: PropTypes.func,
	noteContainer: PropTypes.any,
	currentAutoSave: PropTypes.bool
};



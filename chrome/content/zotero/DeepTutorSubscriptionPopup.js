import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";

// Close icon path (matches other popups)
const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg";

/**
 * DeepTutorSubscriptionPopup
 * Popup to select plan: Free, Pro, Premium. Each tab shows different content and action.
 */
export default function DeepTutorSubscriptionPopup({ onClose, onAction }) {
	const { colors } = useDeepTutorTheme();
	const [activeTab, setActiveTab] = useState("premium"); // "free" | "pro" | "premium"

	const styles = {
		container: {
			background: colors.background.primary,
			borderRadius: "0.5rem",
			padding: "2rem 2rem 1rem 2rem",
			maxWidth: "28rem",
			width: "100%",
			position: "relative",
			boxSizing: "border-box"
		},
		title: {
			width: "100%",
			textAlign: "center",
			background: "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)",
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			backgroundClip: "text",
			color: "#0687E5",
			fontWeight: 700,
			fontSize: "1.5rem",
			lineHeight: "1.2",
			letterSpacing: "0%",
			marginBottom: "1.25rem"
		},
		closeButton: {
			all: "revert",
			background: "none",
			border: "none",
			cursor: "pointer",
			position: "absolute",
			right: "1rem",
			top: "1rem",
			width: "1rem",
			height: "1rem",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		tabs: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "0.375rem",
			marginBottom: "1rem"
		},
		tab: {
			flex: 1,
			padding: "0.5rem 0.75rem",
			textAlign: "center",
			borderRadius: "0.375rem",
			cursor: "pointer",
			fontWeight: 600,
			fontFamily: "Roboto, Inter, Arial, sans-serif",
			border: `1px solid ${colors.border.primary}`,
			background: colors.background.quaternary,
			color: colors.text.allText
		},
		tabActive: {
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: `1px solid ${colors.button.primary}`
		},
		content: {
			display: "flex",
			flexDirection: "column",
			gap: "0.75rem",
			marginBottom: "1rem"
		},
		planTitle: {
			color: "#0687E5",
			fontWeight: 700,
			fontSize: "1rem",
			lineHeight: "1.4375rem",
			textAlign: "left",
			width: "100%",
			marginBottom: "0.25rem"
		},
		priceRow: {
			display: "flex",
			flexDirection: "row",
			alignItems: "flex-end",
			gap: "0.5rem",
			marginBottom: "0.75rem"
		},
		price: {
			fontWeight: 700,
			fontSize: "2rem",
			color: colors.text.allText,
			margin: 0,
			display: "flex",
			alignItems: "center"
		},
		monthly: {
			color: colors.text.tertiary,
			fontWeight: 500,
			fontSize: "0.875rem",
			margin: 0
		},
		featureList: {
			display: "flex",
			flexDirection: "column",
			gap: "0.375rem"
		},
		feature: {
			fontSize: "0.9rem",
			lineHeight: "1.375rem",
			color: colors.text.allText,
			fontWeight: 500
		},
		footer: {
			display: "flex",
			flexDirection: "row",
			gap: "0.5rem",
			marginTop: "0.5rem"
		},
		primaryButton: {
			all: "revert",
			flex: 1,
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			borderRadius: "0.5rem",
			padding: "0.75rem 1rem",
			fontWeight: 700,
			fontSize: "1rem",
			cursor: "pointer",
			boxShadow: "0 0.0625rem 0.125rem rgba(0,0,0,0.08)",
			fontFamily: "Roboto, sans-serif"
		},
		secondaryButton: {
			all: "revert",
			flex: 1,
			background: colors.background.quaternary,
			color: colors.text.allText,
			border: `1px solid ${colors.border.primary}`,
			borderRadius: "0.5rem",
			padding: "0.75rem 1rem",
			fontWeight: 600,
			fontSize: "1rem",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif"
		}
	};

	const renderTabButton = (tabKey, label) => (
		<button
			key={tabKey}
			style={activeTab === tabKey ? { ...styles.tab, ...styles.tabActive } : styles.tab}
			onClick={() => setActiveTab(tabKey)}
		>
			{label}
		</button>
	);

	const renderFree = () => (
		<div style={styles.content}>
			<div style={styles.planTitle}>Free</div>
			<div style={styles.priceRow}>
				<p style={styles.price}>$0</p>
				<p style={styles.monthly}>per month</p>
			</div>
			<div style={styles.featureList}>
				<div style={styles.feature}>• Limited sessions</div>
				<div style={styles.feature}>• Lite Mode only</div>
				<div style={styles.feature}>• Smaller documents</div>
			</div>
		</div>
	);

	const renderPro = () => (
		<div style={styles.content}>
			<div style={styles.planTitle}>Pro</div>
			<div style={styles.priceRow}>
				<p style={styles.price}>$TBD</p>
				<p style={styles.monthly}>per month</p>
			</div>
			<div style={styles.featureList}>
				<div style={styles.feature}>• More sessions than Free</div>
				<div style={styles.feature}>• Standard Mode access</div>
				<div style={styles.feature}>• Larger document limits</div>
			</div>
		</div>
	);

	const renderPremium = () => (
		<div style={styles.content}>
			<div style={styles.planTitle}>Premium</div>
			<div style={styles.priceRow}>
				<p style={styles.price}>$14.99</p>
				<p style={styles.monthly}>monthly</p>
			</div>
			<div style={styles.featureList}>
				<div style={styles.feature}>✅ Unlimited Lite Mode</div>
				<div style={styles.feature}>✅ Unlimited Standard Mode sessions</div>
				<div style={styles.feature}>✅ Unlimited Advanced Mode sessions</div>
				<div style={styles.feature}>✅ Up to 100 pages and 30Mb/file</div>
			</div>
		</div>
	);

	const getPrimaryText = () => {
		if (activeTab === "free") return "Continue with Free";
		if (activeTab === "pro") return "Get Pro";
		return "Get Premium";
	};

	const handlePrimary = () => {
		try {
			onAction(activeTab);
		}
		catch { }
	};

	return (
		<div style={styles.container}>
			<div style={styles.title}>Upgrade Your Plan</div>
			<button style={styles.closeButton} onClick={onClose}>
				<img src={PopupClosePath} alt="Close" style={{ width: "1rem", height: "1rem" }} />
			</button>
			<div style={styles.tabs}>
				{renderTabButton("free", "Free")}
				{renderTabButton("pro", "Pro")}
				{renderTabButton("premium", "Premium")}
			</div>

			{activeTab === "free" && renderFree()}
			{activeTab === "pro" && renderPro()}
			{activeTab === "premium" && renderPremium()}

			<div style={styles.footer}>
				<button style={styles.secondaryButton} onClick={onClose}>Cancel</button>
				<button style={styles.primaryButton} onClick={handlePrimary}>{getPrimaryText()}</button>
			</div>
		</div>
	);
}


DeepTutorSubscriptionPopup.propTypes = {

	/** Called when the user presses close or cancel */
	onClose: PropTypes.func.isRequired,

	/** Called when user confirms on a plan; receives one of: "free" | "pro" | "premium" */
	onAction: PropTypes.func
};

DeepTutorSubscriptionPopup.defaultProps = {
	onAction: () => {}
};

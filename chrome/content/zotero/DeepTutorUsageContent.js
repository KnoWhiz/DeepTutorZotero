import React, { useEffect, useMemo, useState, useRef, memo, useCallback } from "react"; // eslint-disable-line no-unused-vars
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";
import { DT_BASE_URL } from "./api/libs/api.js";

/**
 * DeepTutorUsageContent
 * Inline, non-modal version of the usage UI for embedding in Settings.
 * Redesigned with 4 sections: Current Plan, Usage, Manage Subscription, and Promotion Code.
 */
function DeepTutorUsageContent({ onUpgrade, activeSubscription, usageSummary, onRefreshUsageSummary, onClose }) {
	const { colors, isDark } = useDeepTutorTheme();

	const [isLoading] = useState(false);
	const [error] = useState(null);
	const [usageData, setUsageData] = useState(usageSummary || null);
	const [copiedCode, setCopiedCode] = useState(false);
	const copiedTimeoutRef = useRef(null);
	const copiedStateRef = useRef(false);

	useEffect(() => {
		setUsageData(usageSummary || null);
	}, [usageSummary]);

	useEffect(() => {
		// Call refresh when component mounts - parent component will handle preventing duplicates
		if (onRefreshUsageSummary && typeof onRefreshUsageSummary === "function") {
			onRefreshUsageSummary();
		}
	}, [onRefreshUsageSummary]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) {
				clearTimeout(copiedTimeoutRef.current);
			}
		};
	}, []);

	const styles = {
		content: { textAlign: "left", color: colors.text.primary, fontSize: "1rem", lineHeight: "1.5" },
		section: {
			padding: "1.5rem 0",
			borderBottom: "1px solid " + (isDark ? "#4A4A4A" : "#D1D5DB")
		},
		sectionHeader: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			marginBottom: "1rem"
		},
		sectionTitle: {
			fontWeight: 600,
			fontSize: "1.125rem",
			color: colors.text.primary
		},
		sectionButton: {
			all: "revert",
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			borderRadius: "0.375rem",
			padding: "0.5rem 1rem",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif",
			fontSize: "0.9rem",
			fontWeight: 500
		},
		sectionButtonSecondary: {
			all: "revert",
			background: "transparent",
			color: "#0687E5",
			border: "1px solid #0687E5",
			borderRadius: "0.375rem",
			padding: "0.5rem 1rem",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif",
			fontSize: "0.9rem",
			fontWeight: 500
		},
		planInfo: {
			display: "flex",
			flexDirection: "column",
			gap: "0.25rem"
		},
		planType: {
			fontWeight: 600,
			fontSize: "1.125rem",
			color: colors.text.primary
		},
		planDate: {
			color: colors.text.tertiary,
			fontSize: "0.9rem"
		},
		usageContainer: {
			display: "flex",
			flexDirection: "column",
			gap: "1rem"
		},
		progressContainer: { width: "100%", height: "0.5rem", borderRadius: "9999px", background: isDark ? "#30363d" : "#E5E7EB", overflow: "hidden" },
		progressBar: { height: "100%", borderRadius: "9999px", transition: "width 0.3s ease" },
		upgradeButton: { all: "revert", background: "transparent", border: "none", color: "#0687E5", cursor: "pointer", textDecoration: "underline", fontFamily: "Roboto, sans-serif", fontSize: "1rem" },
		separator: { height: "1px", background: isDark ? colors.border.primary : "#E5E7EB", width: "100%", margin: "0.25rem 0 0.5rem 0" },
		promotionCodeContainer: {
			display: "flex",
			flexDirection: "column",
			gap: "0.75rem"
		},
		codeDisplay: {
			display: "flex",
			alignItems: "center",
			gap: "0.75rem"
		},
		codeText: {
			fontFamily: "monospace",
			fontSize: "1rem",
			fontWeight: 600,
			color: colors.text.primary,
			background: isDark ? "#3A3A3A" : "#F3F4F6",
			padding: "0.5rem 0.75rem",
			borderRadius: "0.375rem",
			border: "1px solid " + (isDark ? "#4A4A4A" : "#D1D5DB"),
			minWidth: "8rem"
		},
		copyButton: {
			all: "revert",
			background: "transparent",
			color: "#0687E5",
			border: "1px solid #0687E5",
			borderRadius: "0.375rem",
			padding: "0.5rem 0.75rem",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif",
			fontSize: "0.9rem",
			fontWeight: 500
		},
		promotionDescription: {
			color: colors.text.tertiary,
			fontSize: "0.9rem",
			lineHeight: "1.4"
		}
	};

	const getCurrentWeekRange = () => {
		const now = new Date();
		const startOfWeek = new Date(now);
		const dayOfWeek = now.getDay();
		const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
		startOfWeek.setDate(diff);
		const endOfWeek = new Date(startOfWeek);
		endOfWeek.setDate(startOfWeek.getDate() + 6);
		const formatDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		return formatDate(startOfWeek) + " - " + formatDate(endOfWeek);
	};

	const getSubscriptionDateRange = () => {
		if (!activeSubscription || !activeSubscription.startTime || !activeSubscription.endTime) {
			return getCurrentWeekRange();
		}
		const startDate = new Date(activeSubscription.startTime);
		const endDate = new Date(activeSubscription.endTime);
		const formatDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		return formatDate(startDate) + " - " + formatDate(endDate);
	};

	const getSubscriptionTypeDisplay = () => {
		if (!activeSubscription || !activeSubscription.id) {
			return "DeepTutor Free";
		}
		const t = (activeSubscription.type || "").toUpperCase();
		if (t === "BASIC" || t === "PLUS") return "DeepTutor Pro";
		if (t === "PREMIUM") return "DeepTutor Premium";
		return "DeepTutor Free";
	};

	const weeklyTotal = useMemo(() => {
		if (!usageData) return 0;
		const a = Number(usageData.weeklyLiteCount || 0);
		const b = Number(usageData.weeklyBasicCount || 0);
		return a + b;
	}, [usageData]);

	const cycleTotal = useMemo(() => {
		if (!usageData) return 0;
		const a = Number(usageData.liteCount || 0);
		const b = Number(usageData.basicCount || 0);
		return a + b;
	}, [usageData]);

	const renderProgressBar = (current, max, label, { disabled = false, gradient = false, showUnlimited = false } = {}) => {
		let percentage = 0;
		if (showUnlimited) {
			percentage = 100;
		}
		else if (typeof max === "number" && max > 0) {
			percentage = Math.min((current / max) * 100, 100);
		}

		let sessionText = "";
		if (disabled) {
			sessionText = "Not available";
		}
		else if (showUnlimited) {
			sessionText = current + " / unlimited sessions";
		}
		else {
			sessionText = current + " / " + max + " sessions";
		}

		const barStyle = { ...styles.progressBar };
		const useGradient = gradient || showUnlimited;
		if (disabled) {
			barStyle.background = isDark ? "#6B7280" : "#9CA3AF";
		}
		else if (useGradient) {
			barStyle.backgroundImage = "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)";
		}
		else if (percentage >= 100) {
			barStyle.background = "#10B981";
		}
		else {
			barStyle.background = colors.button.primary;
		}

		return (
			<div style={{ marginBottom: "1rem" }}>
				<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "1rem" }}>
					<span style={{ fontWeight: 400, color: disabled ? colors.text.tertiary : colors.text.primary }}>{label}</span>
					<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{sessionText}</span>
				</div>
				<div style={styles.progressContainer}>
					<div style={{ ...barStyle, width: percentage + "%" }} />
				</div>
			</div>
		);
	};

	const handleUpgrade = () => {
		try {
			if (typeof onUpgrade === "function") {
				onUpgrade();
			}
		}
		catch { /* noop */ }
	};

	const handleChangePlan = () => {
		if (!activeSubscription || !activeSubscription.id) {
			// User is not subscribed - show upgrade popup and close settings
			handleUpgrade();
			if (onClose) onClose();
		}
		else {
			// User is subscribed - show upgrade popup for plan change
			handleUpgrade();
		}
	};

	const handleManageSubscription = () => {
		try {
			let manageUrl = "https://" + DT_BASE_URL + "/dzSubscription?manage=true";
			const stripeCustomerIdParam = activeSubscription && activeSubscription.stripeCustomerId ? "&stripeCustomerId=" + encodeURIComponent(activeSubscription.stripeCustomerId) : "";
			manageUrl += stripeCustomerIdParam;
			Zotero.launchURL(manageUrl);
		}
		catch (error) {
			Zotero.debug("DeepTutor: Error opening manage subscription URL: " + error.message);
			// Fallback to clipboard if URL opening fails
			let manageUrl = "https://" + DT_BASE_URL + "/dzSubscription?manage=true";
			const stripeCustomerIdParam = activeSubscription && activeSubscription.stripeCustomerId ? "&stripeCustomerId=" + encodeURIComponent(activeSubscription.stripeCustomerId) : "";
			manageUrl += stripeCustomerIdParam;
			if (navigator.clipboard) {
				navigator.clipboard.writeText(manageUrl).then(() => {
					Zotero.alert(null, "DeepTutor", "Manage subscription URL copied to clipboard!");
				});
			}
			else {
				Zotero.alert(null, "DeepTutor", "Please manually visit this URL:\n" + manageUrl);
			}
		}
	};

	const handleCopyPromotionCode = useCallback(() => {
		const promotionCode = "DEEPTUTOR50"; // Placeholder code
		
		// Clear any existing timeout
		if (copiedTimeoutRef.current) {
			clearTimeout(copiedTimeoutRef.current);
		}
		
		try {
			if (navigator.clipboard) {
				navigator.clipboard.writeText(promotionCode).then(() => {
					copiedStateRef.current = true;
					setCopiedCode(true);
					copiedTimeoutRef.current = setTimeout(() => {
						copiedStateRef.current = false;
						setCopiedCode(false);
					}, 2000);
				}).catch((error) => {
					Zotero.debug("DeepTutor: Clipboard API failed: " + error.message);
					// Fallback to legacy method
					fallbackCopyToClipboard(promotionCode);
				});
			}
			else {
				// Fallback for older browsers
				fallbackCopyToClipboard(promotionCode);
			}
		}
		catch (error) {
			Zotero.debug("DeepTutor: Error copying promotion code: " + error.message);
			fallbackCopyToClipboard(promotionCode);
		}
	}, []);

	const fallbackCopyToClipboard = (text) => {
		try {
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
			copiedStateRef.current = true;
			setCopiedCode(true);
			copiedTimeoutRef.current = setTimeout(() => {
				copiedStateRef.current = false;
				setCopiedCode(false);
			}, 2000);
		}
		catch (error) {
			Zotero.debug("DeepTutor: Fallback copy failed: " + error.message);
		}
	};

	return (
		<div style={styles.content}>
			{/* Loading State */}
			{isLoading && (
				<div style={{ color: colors.text.primary, padding: "1rem 0" }}>Loading usage data...</div>
			)}

			{/* Error State */}
			{!isLoading && error && (
				<div style={{ color: isDark ? "#FCA5A5" : "#B91C1C", padding: "0.75rem", border: "1px solid " + (isDark ? "#7F1D1D" : "#FCA5A5"), background: isDark ? "#2B2B2B" : "#FEF2F2", borderRadius: "0.5rem", marginBottom: "1rem" }}>
					<div>Error loading usage data. Please try again later.</div>
				</div>
			)}

			{/* Main Content - 4 Sections */}
			{!isLoading && !error && (
				<div>
					{/* Section 1: Current Plan */}
					<div style={styles.section}>
						<div style={styles.sectionHeader}>
							<div style={styles.planInfo}>
								<div style={styles.planType}>{getSubscriptionTypeDisplay()}</div>
								<div style={styles.planDate}>
									{(!activeSubscription || !activeSubscription.id) ? getCurrentWeekRange() : getSubscriptionDateRange()}
								</div>
							</div>
							<button type="button" onClick={handleChangePlan} style={styles.sectionButton}>
								{(!activeSubscription || !activeSubscription.id) ? "Upgrade" : "Change Plan"}
							</button>
						</div>
					</div>

					{/* Section 2: Usage */}
					<div style={styles.section}>
						<div style={styles.sectionHeader}>
							<div style={styles.sectionTitle}>Usage</div>
						</div>
						<div style={styles.usageContainer}>
							{usageData
								? (
									<div>
										{/* Free Mode */}
										{(!activeSubscription || !activeSubscription.id) && (
											<div>
												{renderProgressBar(weeklyTotal, 5, "Standard Mode", { disabled: false, gradient: false })}
												{renderProgressBar(0, 0, "Advanced Mode", { disabled: true })}
												<div style={{ marginTop: "1rem" }}>
													<span style={{ color: colors.text.primary }}>
														Need more sessions? {" "}
														<button type="button" onClick={handleUpgrade} style={styles.upgradeButton}>Upgrade Plan</button>
													</span>
												</div>
											</div>
										)}

										{/* Pro Subscription */}
										{activeSubscription && activeSubscription.id && ["BASIC", "PLUS"].includes((activeSubscription.type || "").toUpperCase()) && (
											<div>
												<div style={{ marginBottom: "0.75rem" }}>
													<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
														<span style={{ fontWeight: 400, color: colors.text.primary }}>Standard Mode</span>
														<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.liteCount || 0)} sessions</span>
													</div>
													<div style={styles.separator} />
												</div>

												<div style={{ marginBottom: "0.75rem" }}>
													<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
														<span style={{ fontWeight: 400, color: colors.text.primary }}>Advanced Mode</span>
														<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.basicCount || 0)} sessions</span>
													</div>
													<div style={styles.separator} />
												</div>

												<div style={{ marginTop: "1rem" }}>
													{renderProgressBar(cycleTotal, 200, "Total Sessions", { disabled: false, gradient: false })}
												</div>

												<div style={{ marginTop: "1rem" }}>
													<span style={{ color: colors.text.primary }}>
														Need more sessions? {" "}
														<button type="button" onClick={handleUpgrade} style={styles.upgradeButton}>Upgrade Plan</button>
													</span>
												</div>
											</div>
										)}

										{/* Premium Subscription */}
										{activeSubscription && activeSubscription.id && (activeSubscription.type || "").toUpperCase() === "PREMIUM" && (
											<div>
												<div style={{ marginBottom: "0.75rem" }}>
													<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
														<span style={{ fontWeight: 400, color: colors.text.primary }}>Standard Mode</span>
														<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.liteCount || 0)} sessions</span>
													</div>
													<div style={styles.separator} />
												</div>

												<div style={{ marginBottom: "0.75rem" }}>
													<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
														<span style={{ fontWeight: 400, color: colors.text.primary }}>Advanced Mode</span>
														<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.basicCount || 0)} sessions</span>
													</div>
													<div style={styles.separator} />
												</div>

												<div style={{ marginTop: "1rem" }}>
													{renderProgressBar(cycleTotal, 200, "Total Sessions", { disabled: false, gradient: false, showUnlimited: true })}
												</div>
											</div>
										)}
									</div>
								)
								: (
									<div style={{ color: colors.text.tertiary, padding: "1rem 0" }}>No usage data available</div>
								)}
						</div>
					</div>

					{/* Section 3: Manage Subscription (only for subscribed users) */}
					{activeSubscription && activeSubscription.id && (
						<div style={styles.section}>
							<div style={styles.sectionHeader}>
								<div style={styles.sectionTitle}>Manage Subscription</div>
								<button type="button" onClick={handleManageSubscription} style={styles.sectionButtonSecondary}>
                                    Open in Browser
								</button>
							</div>
						</div>
					)}

					{/* Section 4: Promotion Code */}
					<div style={styles.section}>
						<div style={styles.sectionHeader}>
							<div style={styles.sectionTitle}>Promotion Code</div>
						</div>
						<div style={styles.promotionCodeContainer}>
							<div style={styles.codeDisplay}>
								<div style={styles.codeText}>DEEPTUTOR50</div>
								<button type="button" onClick={handleCopyPromotionCode} style={styles.copyButton}>
									{(copiedCode || copiedStateRef.current) ? "Copied!" : "Copy"}
								</button>
							</div>
							<div style={styles.promotionDescription}>
                                Share this promotion code with a friend and both of you will get 50% off your next month.
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

DeepTutorUsageContent.propTypes = {
	onUpgrade: PropTypes.func,
	activeSubscription: PropTypes.object,
	usageSummary: PropTypes.object,
	onRefreshUsageSummary: PropTypes.func,
	onClose: PropTypes.func,
};

// Memoize the component to prevent unnecessary re-renders
export default memo(DeepTutorUsageContent);

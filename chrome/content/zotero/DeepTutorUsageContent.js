import React, { useEffect, useMemo, useState } from "react"; // eslint-disable-line no-unused-vars
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";

/**
 * DeepTutorUsageContent
 * Inline, non-modal version of the usage UI for embedding in Settings.
 */
export default function DeepTutorUsageContent({ onUpgrade, activeSubscription, usageSummary, onRefreshUsageSummary }) {
    const { colors, isDark } = useDeepTutorTheme();

    const [isLoading] = useState(false);
    const [error] = useState(null);
    const [usageData, setUsageData] = useState(usageSummary || null);

    useEffect(() => {
        setUsageData(usageSummary || null);
    }, [usageSummary]);

    useEffect(() => {
        if (onRefreshUsageSummary && typeof onRefreshUsageSummary === "function") {
            onRefreshUsageSummary();
        }
    }, []);

    const styles = {
        content: { textAlign: "left", color: colors.text.primary, fontSize: "1rem", lineHeight: "1.5" },
        rowBetween: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "1rem", color: colors.text.primary },
        labelText: { fontWeight: 600, fontSize: "1.125rem" },
        mutedText: { color: colors.text.tertiary, fontSize: "1rem" },
        separator: { height: "1px", background: isDark ? colors.border.primary : "#E5E7EB", width: "100%", margin: "0.25rem 0 0.5rem 0" },
        progressContainer: { width: "100%", height: "0.5rem", borderRadius: "9999px", background: isDark ? "#30363d" : "#E5E7EB", overflow: "hidden" },
        progressBar: { height: "100%", borderRadius: "9999px", transition: "width 0.3s ease" },
        upgradeButton: { all: "revert", background: "transparent", border: "none", color: "#0687E5", cursor: "pointer", textDecoration: "underline", fontFamily: "Roboto, sans-serif", fontSize: "1rem" }
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
        return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
    };

    const getSubscriptionDateRange = () => {
        if (!activeSubscription || !activeSubscription.startTime || !activeSubscription.endTime) {
            return getCurrentWeekRange();
        }
        const startDate = new Date(activeSubscription.startTime);
        const endDate = new Date(activeSubscription.endTime);
        const formatDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
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
            sessionText = `${current} / unlimited sessions`;
        }
        else {
            sessionText = `${current} / ${max} sessions`;
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
                    <div style={{ ...barStyle, width: `${percentage}%` }} />
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

    return (
        <div style={styles.content}>
            {/* Loading State */}
            {isLoading && (
                <div style={{ color: colors.text.primary, padding: "1rem 0" }}>Loading usage data...</div>
            )}

            {/* Error State */}
            {!isLoading && error && (
                <div style={{ color: isDark ? "#FCA5A5" : "#B91C1C", padding: "0.75rem", border: `1px solid ${isDark ? "#7F1D1D" : "#FCA5A5"}`, background: isDark ? "#2B2B2B" : "#FEF2F2", borderRadius: "0.5rem", marginBottom: "1rem" }}>
                    <div>Error loading usage data. Please try again later.</div>
                </div>
            )}

            {/* Usage Data Display */}
            {!isLoading && !error && usageData && (
                <div>
                    <div style={styles.rowBetween}>
                        <span style={styles.labelText}>{getSubscriptionTypeDisplay()}</span>
                        <span style={styles.mutedText}>
                            {(!activeSubscription || !activeSubscription.id) ? getCurrentWeekRange() : getSubscriptionDateRange()}
                        </span>
                    </div>

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
            )}

            {/* No Data State */}
            {!isLoading && !error && !usageData && (
                <div style={{ color: colors.text.tertiary, padding: "1rem 0" }}>No usage data available</div>
            )}
        </div>
    );
}

DeepTutorUsageContent.propTypes = {
    onUpgrade: PropTypes.func,
    activeSubscription: PropTypes.object,
    usageSummary: PropTypes.object,
    onRefreshUsageSummary: PropTypes.func,
};



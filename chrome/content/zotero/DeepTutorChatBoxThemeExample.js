/**
 * Example: DeepTutorChatBox with Theme Support
 * This shows how to update existing components to use the theme system
 */

import React, { useState, useEffect } from "react";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";
import { generateDeepTutorStyles, generateMarkdownCSS } from "./theme/DeepTutorStyles.js";

// Example component showing how to integrate theme system
const DeepTutorChatBoxThemeExample = ({ sessionId, onSendMessage, messages = [] }) => {
	const { theme, colors, isDark } = useDeepTutorTheme();
	const [inputValue, setInputValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	
	// Generate theme-aware styles
	const styles = generateDeepTutorStyles(theme);
	
	// Generate theme-aware CSS for markdown content
	const markdownCSS = generateMarkdownCSS(theme);
	
	// Handle message sending
	const handleSendMessage = async () => {
		if (!inputValue.trim()) return;
		
		setIsLoading(true);
		try {
			await onSendMessage(inputValue);
			setInputValue("");
		} catch (error) {
			console.error("Error sending message:", error);
		} finally {
			setIsLoading(false);
		}
	};
	
	// Handle Enter key press
	const handleKeyPress = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};
	
	return (
		<div className="deeptutor-chat-box" style={styles.container}>
			{/* Theme-aware CSS styles */}
			<style dangerouslySetInnerHTML={{ __html: markdownCSS }} />
			
			{/* Session name */}
			<div style={styles.sessionNameDiv}>
				Session {sessionId}
			</div>
			
			{/* Session info */}
			<div style={styles.sessionInfo}>
				{messages.length} messages
			</div>
			
			{/* Chat log */}
			<div style={styles.chatLog}>
				{messages.map((message, index) => (
					<div key={index} style={styles.messageContainer}>
						<div
							style={{
								...styles.messageBubble,
								...(message.role === "USER" ? styles.userMessage : styles.botMessage)
							}}
						>
							<div style={styles.messageText}>
								{message.content}
							</div>
						</div>
					</div>
				))}
				
				{isLoading && (
					<div style={styles.messageContainer}>
						<div style={{ ...styles.messageBubble, ...styles.botMessage }}>
							<div style={styles.messageText}>
								Thinking...
							</div>
						</div>
					</div>
				)}
			</div>
			
			{/* Input area */}
			<div style={{
				display: "flex",
				gap: "0.5rem",
				padding: "1rem",
				borderTop: `1px solid ${colors.border.quaternary}`,
				background: colors.background.primary
			}}>
				<input
					type="text"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyPress={handleKeyPress}
					placeholder="Type your message..."
					style={styles.input}
					disabled={isLoading}
				/>
				<button
					onClick={handleSendMessage}
					disabled={isLoading || !inputValue.trim()}
					style={{
						...styles.button,
						width: "auto",
						padding: "0.75rem 1.5rem",
						opacity: (isLoading || !inputValue.trim()) ? 0.6 : 1
					}}
				>
					Send
				</button>
			</div>
		</div>
	);
};

export default DeepTutorChatBoxThemeExample; 
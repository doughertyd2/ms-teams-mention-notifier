// background.js - Background service worker for Teams Notification Email Sender

// Remove SMTP.js since we're using EmailJS now

// Configuration for email settings with EmailJS
const EMAIL_CONFIG = {
	// EmailJS Configuration
	emailJS: {
		service_id: "your_service_id", // e.g., "gmail" or the service name you set up in EmailJS
		template_id: "your_template_id", // Your EmailJS template ID
		user_id: "your_user_id", // Your EmailJS public user ID
	},

	// Email settings
	sender_email: "devbot9799@gmail.com",
	email_recipients: [], // Will support multiple recipients

	// Notification settings
	searchTerm: "devin", // Default search term, can be changed via popup
};

// Simple encryption/decryption functions (you can remove these if not needed for EmailJS)
// They are kept here for legacy storage handling if you want to obfuscate your keys.
function encryptData(data) {
	if (!data) return "";
	const encoded = btoa(data);
	return encoded.split("").reverse().join("");
}

function decryptData(encryptedData) {
	if (!encryptedData) return "";
	const reversed = encryptedData.split("").reverse().join("");
	try {
		return atob(reversed);
	} catch (e) {
		console.error("Error decrypting data:", e);
		return "";
	}
}

// Initialize storage with default values if not set
chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get(["emailConfig"], (result) => {
		if (!result.emailConfig) {
			chrome.storage.local.set({
				emailConfig: EMAIL_CONFIG,
				isEnabled: true,
			});
		}
	});
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "TEAMS_MESSAGE_DETECTED") {
		console.log("Background script received message:", message);

		// Get current configuration
		chrome.storage.local.get(["emailConfig", "isEnabled"], (result) => {
			if (result.isEnabled && result.emailConfig) {
				const config = result.emailConfig;

				// Check if the message contains the search term
				if (message.messageText.toLowerCase().includes(config.searchTerm.toLowerCase())) {
					console.log(`Message contains "${config.searchTerm}", sending email notification`);

					// Send email notification using EmailJS
					sendEmailNotification(config, `From: ${message.sender || "Unknown"}`, `${message.messageText}`);
				}
			}
		});

		// Always send a response to avoid "The message port closed before a response was received" error
		sendResponse({ status: "processing" });
		return true; // Indicates async response
	}
});

// Function to send email notification using EmailJS REST API
function sendEmailNotification(config, subject, body) {
	const { emailJS, sender_email, email_recipients } = config;

	// Check if required EmailJS credentials are set
	if (!emailJS || !emailJS.service_id || !emailJS.template_id || !emailJS.user_id || !email_recipients || email_recipients.length === 0) {
		console.error("Email configuration not complete. Please configure in extension popup.");
		return;
	}

	// Prepare payload for EmailJS
	const payload = {
		service_id: emailJS.service_id,
		template_id: emailJS.template_id,
		user_id: emailJS.user_id,
		template_params: {
			sender_email: sender_email,
			subject: subject,
			body: body.replace(/\n/g, "<br>"),
			recipient_email: "", // Will be set per recipient
		},
	};

	// Prepare email data for each recipient
	email_recipients.forEach((recipient) => {
		// Set the recipient for this email
		payload.template_params.recipient_email = recipient;

		fetch("https://api.emailjs.com/api/v1.0/email/send", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		})
			.then((response) => response.text())
			.then((result) => {
				console.log("Email sent successfully:", result);

				// Log the successful email attempt
				chrome.storage.local.get(["emailLogs"], (result) => {
					const logs = result.emailLogs || [];
					logs.push({
						timestamp: new Date().toISOString(),
						sender: sender_email,
						recipient: recipient,
						subject: subject,
						success: true,
						message: result,
					});

					// Store only the last 10 logs
					chrome.storage.local.set({
						emailLogs: logs.slice(-10),
					});
				});
			})
			.catch((error) => {
				console.error("Error sending email:", error);

				// Log the failed email attempt
				chrome.storage.local.get(["emailLogs"], (result) => {
					const logs = result.emailLogs || [];
					logs.push({
						timestamp: new Date().toISOString(),
						sender: sender_email,
						recipient: recipient,
						subject: subject,
						success: false,
						error: error.toString(),
					});

					// Store only the last 10 logs
					chrome.storage.local.set({
						emailLogs: logs.slice(-10),
					});
				});
			});

		// Log the attempt
		console.log("Sending email notification:", {
			from: sender_email,
			to: recipient,
			subject: subject,
			emailJS: emailJS,
		});
	});
}

// Set up an alarm to periodically check if Teams is open
chrome.alarms.create("checkTeamsStatus", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === "checkTeamsStatus") {
		// Check if Teams tab is open and inject content script if needed
		chrome.tabs.query({ url: "*://*.teams.microsoft.com/*" }, (tabs) => {
			if (tabs.length > 0) {
				// Teams is open, make sure content script is running
				tabs.forEach((tab) => {
					chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
						if (chrome.runtime.lastError) {
							// Content script not running, inject it
							chrome.scripting.executeScript({
								target: { tabId: tab.id },
								files: ["js/content.js"],
							});
						}
					});
				});
			}
		});
	}
});

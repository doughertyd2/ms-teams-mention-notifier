// popup.js - Script for the extension popup UI

document.addEventListener("DOMContentLoaded", function () {
	// Get UI elements for general settings
	const enableToggle = document.getElementById("enableToggle");
	const senderEmailInput = document.getElementById("senderEmail");
	const newRecipientInput = document.getElementById("newRecipient");
	const addRecipientBtn = document.getElementById("addRecipientBtn");
	const recipientsList = document.getElementById("recipientsList");
	const searchTermInput = document.getElementById("searchTerm");
	const saveButton = document.getElementById("saveButton");
	const statusDiv = document.getElementById("status");
	const logEntriesDiv = document.getElementById("logEntries");
	const tabs = document.querySelectorAll(".tab");
	const tabContents = document.querySelectorAll(".tab-content");

	// Get UI elements for EmailJS settings
	const emailjsServiceInput = document.getElementById("emailjsService");
	const emailjsTemplateInput = document.getElementById("emailjsTemplate");
	const emailjsUserInput = document.getElementById("emailjsUser");

	// Simple encryption function (if needed in future; not used for EmailJS)
	function encryptData(data) {
		if (!data) return "";
		const encoded = btoa(data);
		return encoded.split("").reverse().join("");
	}

	// Tab switching functionality
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			// Remove active class from all tabs and contents
			tabs.forEach((t) => t.classList.remove("active"));
			tabContents.forEach((content) => content.classList.remove("active"));

			// Add active class to clicked tab and corresponding content
			tab.classList.add("active");
			const tabName = tab.getAttribute("data-tab");
			document.getElementById(`${tabName}Tab`).classList.add("active");
		});
	});

	// Recipients array to store multiple recipients
	let recipients = [];

	// Function to render recipients list
	function renderRecipients() {
		recipientsList.innerHTML = "";

		if (recipients.length === 0) {
			const emptyMessage = document.createElement("div");
			emptyMessage.textContent = "No recipients added yet.";
			emptyMessage.style.color = "#666";
			emptyMessage.style.fontStyle = "italic";
			recipientsList.appendChild(emptyMessage);
			return;
		}

		recipients.forEach((recipient, index) => {
			const recipientItem = document.createElement("div");
			recipientItem.className = "recipient-item";

			const emailSpan = document.createElement("span");
			emailSpan.textContent = recipient;

			const removeBtn = document.createElement("button");
			removeBtn.className = "remove-btn";
			removeBtn.textContent = "×";
			removeBtn.addEventListener("click", () => {
				recipients.splice(index, 1);
				renderRecipients();
			});

			recipientItem.appendChild(emailSpan);
			recipientItem.appendChild(removeBtn);
			recipientsList.appendChild(recipientItem);
		});
	}

	// Add recipient button click handler
	addRecipientBtn.addEventListener("click", () => {
		const email = newRecipientInput.value.trim();
		if (email && isValidEmail(email)) {
			if (!recipients.includes(email)) {
				recipients.push(email);
				renderRecipients();
				newRecipientInput.value = "";
			} else {
				showStatus("This recipient is already added.", "error");
			}
		} else {
			showStatus("Please enter a valid email address.", "error");
		}
	});

	// Email validation function
	function isValidEmail(email) {
		const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return re.test(email);
	}

	// Load current settings from storage
	chrome.storage.local.get(["emailConfig", "isEnabled", "emailLogs"], function (result) {
		if (result.emailConfig) {
			// Set sender email
			senderEmailInput.value = result.emailConfig.sender_email || "devbot9799@gmail.com";

			// Set recipients
			if (result.emailConfig.email_recipients) {
				if (Array.isArray(result.emailConfig.email_recipients)) {
					recipients = [...result.emailConfig.email_recipients];
				} else if (typeof result.emailConfig.email_recipients === "string" && result.emailConfig.email_recipients) {
					recipients = [result.emailConfig.email_recipients];
				}
				renderRecipients();
			}

			// Set search term
			searchTermInput.value = result.emailConfig.searchTerm || "devin";

			// Set EmailJS settings
			if (result.emailConfig.emailJS) {
				emailjsServiceInput.value = result.emailConfig.emailJS.service_id || "";
				emailjsTemplateInput.value = result.emailConfig.emailJS.template_id || "";
				emailjsUserInput.value = result.emailConfig.emailJS.user_id || "";
			}
		}

		enableToggle.checked = result.isEnabled !== false;

		// Display logs if available
		if (result.emailLogs && result.emailLogs.length > 0) {
			displayLogs(result.emailLogs);
		} else {
			logEntriesDiv.textContent = "No notification logs yet.";
		}
	});

	// Save settings when button is clicked
	saveButton.addEventListener("click", function () {
		// Validate inputs
		if (recipients.length === 0) {
			showStatus("Please add at least one recipient email address.", "error");
			return;
		}

		if (!senderEmailInput.value) {
			showStatus("Please enter a sender email address.", "error");
			return;
		}

		// Validate EmailJS fields
		if (!emailjsServiceInput.value || !emailjsTemplateInput.value || !emailjsUserInput.value) {
			showStatus("Please fill in all EmailJS settings.", "error");
			return;
		}

		// Get current config first to preserve any other settings
		chrome.storage.local.get(["emailConfig"], function (result) {
			const currentConfig = result.emailConfig || {};

			// Create updated config with EmailJS settings
			const updatedConfig = {
				...currentConfig,
				sender_email: senderEmailInput.value,
				email_recipients: recipients,
				searchTerm: searchTermInput.value || "devin",
				emailJS: {
					service_id: emailjsServiceInput.value,
					template_id: emailjsTemplateInput.value,
					user_id: emailjsUserInput.value,
				},
			};

			// Save to storage
			chrome.storage.local.set(
				{
					emailConfig: updatedConfig,
					isEnabled: enableToggle.checked,
				},
				function () {
					// Notify content scripts of the update
					chrome.tabs.query({ url: "*://*.teams.microsoft.com/*" }, function (tabs) {
						tabs.forEach(function (tab) {
							chrome.tabs.sendMessage(tab.id, {
								type: "UPDATE_CONFIG",
								config: {
									searchTerm: updatedConfig.searchTerm,
								},
							});
						});
					});

					showStatus("Settings saved successfully!", "success");
				}
			);
		});
	});

	// Toggle extension enabled/disabled state
	enableToggle.addEventListener("change", function () {
		chrome.storage.local.set({ isEnabled: enableToggle.checked });

		if (enableToggle.checked) {
			showStatus("Notifications enabled", "success");
		} else {
			showStatus("Notifications disabled", "error");
		}
	});

	// Function to display status messages
	function showStatus(message, type) {
		statusDiv.textContent = message;
		statusDiv.className = "status " + type;

		// Clear status after 3 seconds
		setTimeout(function () {
			statusDiv.className = "status";
		}, 3000);
	}

	// Function to display email logs
	function displayLogs(logs) {
		logEntriesDiv.innerHTML = "";

		if (logs.length === 0) {
			logEntriesDiv.textContent = "No notification logs yet.";
			return;
		}

		// Display logs in reverse chronological order
		logs.slice()
			.reverse()
			.forEach(function (log) {
				const logEntry = document.createElement("div");
				logEntry.className = "log-entry";

				const date = new Date(log.timestamp);
				const formattedDate = date.toLocaleString();

				// Make sure we don't display any sensitive information in logs
				logEntry.textContent = `${formattedDate} - ${log.subject} to ${log.recipient}`;

				if (!log.success) {
					logEntry.style.color = "#dc3545";
				}

				logEntriesDiv.appendChild(logEntry);
			});
	}

	// Refresh logs every time popup is opened
	chrome.storage.local.get(["emailLogs"], function (result) {
		if (result.emailLogs) {
			displayLogs(result.emailLogs);
		}
	});
});

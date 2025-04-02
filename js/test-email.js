// Test script for SMTP.js email functionality
// This script simulates the email sending functionality using SMTP.js

// Import SMTP.js
importScripts('smtp.js');

// Test function to send an email
function testSendEmail() {
  console.log('Starting email test...');
  
  // Test configuration
  const testConfig = {
    Host: 'smtp.gmail.com',
    Port: 587,
    Username: 'test@example.com', // Replace with actual test email if available
    Password: 'password123',      // Replace with actual test password if available
    To: 'recipient@example.com',  // Replace with actual test recipient if available
    From: 'test@example.com',     // Replace with actual test email if available
    Subject: 'Test Email from Teams Notification Extension',
    Body: 'This is a test email sent from the Teams Notification Extension using SMTP.js. If you received this, the email functionality is working correctly!'
  };
  
  // Log the test configuration (without password)
  console.log('Test configuration:', {
    ...testConfig,
    Password: '********' // Hide password in logs
  });
  
  // Send test email using SMTP.js
  Email.send(testConfig)
    .then(message => {
      console.log('Test email sent successfully:', message);
      return {success: true, message: message};
    })
    .catch(error => {
      console.error('Error sending test email:', error);
      return {success: false, error: error.toString()};
    });
}

// Note: This is a test script and should be run in a controlled environment.
// In a real-world scenario, you would need to provide actual SMTP credentials.
// The SMTP.js library requires valid credentials to send emails.
// For testing purposes, you can use services like Mailtrap.io or a personal email account.

require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const app = express();

// Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

// Validate environment variables
if (!accountSid || !authToken || !twilioNumber) {
    console.error('Missing Twilio credentials in environment variables:', {
        accountSid: !!accountSid,
        authToken: !!authToken,
        twilioNumber: !!twilioNumber
    });
    process.exit(1);
}

// Predefined recipient numbers (replace with actual numbers in E.164 format)
const recipientNumbers = process.env.RECIPIENT_NUMBERS ? process.env.RECIPIENT_NUMBERS.split(',') : [
    '+919883995198'
];

// Default message if no custom message is provided
const defaultMessage = 'Emergency Alert! Please assist immediately.';

let client;
try {
    client = twilio(accountSid, authToken);
} catch (error) {
    console.error('Failed to initialize Twilio client:', error.message);
    process.exit(1);
}

app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' folder

// Debug middleware to log incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} Body:`, req.body);
    next();
});

app.post('/api/send-sms', async (req, res) => {
    const { message, location, mapsUrl } = req.body;

    if (!location || !mapsUrl) {
        console.error('Invalid request body:', { message, location, mapsUrl });
        return res.status(400).json({ error: 'Location and mapsUrl are required' });
    }

    const finalMessage = (message || defaultMessage) + ` ${location} Map: ${mapsUrl}`;

    try {
        // Validate recipient numbers
        const validNumbers = recipientNumbers.filter(to => /^\+\d{10,15}$/.test(to));
        if (validNumbers.length === 0) {
            throw new Error('No valid recipient numbers provided');
        }

        const promises = validNumbers.map(to =>
            client.messages.create({
                body: finalMessage,
                from: twilioNumber,
                to,
            }).catch(error => {
                console.error(`Failed to send SMS to ${to}:`, error.message);
                throw error;
            })
        );

        const results = await Promise.allSettled(promises);
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);

        if (errors.length > 0) {
            throw new Error(`Some SMS failed: ${errors.join(', ')}`);
        }

        console.log('SMS sent successfully to:', validNumbers);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('SMS Error:', error.message, error.stack);
        res.status(500).json({ error: `Failed to send SMS: ${error.message}` });
    }
});

app.post('/api/make-call', async (req, res) => {
    const { message, location, mapsUrl } = req.body;

    if (!location || !mapsUrl) {
        console.error('Invalid request body:', { message, location, mapsUrl });
        return res.status(400).json({ error: 'Location and mapsUrl are required' });
    }

    const finalMessage = (message || defaultMessage) + ` Location: ${location}. View on Google Maps at ${mapsUrl.replace('https://', '')}.`;

    try {
        // Validate recipient numbers
        const validNumbers = recipientNumbers.filter(to => /^\+\d{10,15}$/.test(to));
        if (validNumbers.length === 0) {
            throw new Error('No valid recipient numbers provided');
        }

        const promises = validNumbers.map(to =>
            client.calls.create({
                twiml: `<Response><Say voice="alice">${finalMessage}</Say></Response>`,
                from: twilioNumber,
                to,
            }).catch(error => {
                console.error(`Failed to initiate call to ${to}:`, error.message);
                throw error;
            })
        );

        const results = await Promise.allSettled(promises);
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);

        if (errors.length > 0) {
            throw new Error(`Some calls failed: ${errors.join(', ')}`);
        }

        console.log('Calls initiated successfully to:', validNumbers);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Call Error:', error.message, error.stack);
        res.status(500).json({ error: `Failed to initiate call: ${error.message}` });
    }
});

// Health check endpoint for debugging
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'Server is running',
        timestamp: new Date().toISOString(),
        twilioInitialized: !!client
    });
});

// Catch-all for undefined routes
app.use((req, res) => {
    console.warn(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
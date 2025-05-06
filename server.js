require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const app = express();
const port = 3000;

// Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

// Predefined recipient numbers (replace with actual numbers in E.164 format)
const recipientNumbers = [
    '+919883995198'
];

// Default message if no custom message is provided
const defaultMessage = 'Emergency Alert! Please assist immediately.';

const client = twilio(accountSid, authToken);

app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' folder

app.post('/send-sms', async (req, res) => {
    const { message, location, mapsUrl } = req.body;

    const finalMessage = (message || defaultMessage) + ` ${location} Map: ${mapsUrl}`;

    try {
        const promises = recipientNumbers.map(to =>
            client.messages.create({
                body: finalMessage,
                from: twilioNumber,
                to,
            })
        );
        await Promise.all(promises);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});

app.post('/make-call', async (req, res) => {
    const { message, location, mapsUrl } = req.body;

    const finalMessage = (message || defaultMessage) + ` Location: ${location}. View on Google Maps at ${mapsUrl.replace('https://', '')}.`;

    try {
        const promises = recipientNumbers.map(to =>
            client.calls.create({
                twiml: `<Response><Say voice="alice">${finalMessage}</Say></Response>`,
                from: twilioNumber,
                to,
            })
        );
        await Promise.all(promises);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to initiate call' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
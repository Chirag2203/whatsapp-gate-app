const getDB = require('../db');

async function handleCallback(req, res) {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
    console.log(VERIFY_TOKEN)
    // Parse query params
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Check if the mode and token are valid
    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        // Respond with the challenge token to verify the webhook
        console.log("Webhook verified successfully.");
        res.status(200).send(challenge);
    } else {
        // Respond with '403 Forbidden' if verification fails
        console.error("Webhook verification failed.");
        res.sendStatus(403);
    }
}   

module.exports = {
    handleCallback
};
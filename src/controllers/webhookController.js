const getDB = require('../db');
const axios = require('axios'); // Ensure axios is imported

const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;

// List of random questions
const questions = [
    "What is the capital of France?",
    "Solve: 5 + 3 * 2 - 8 / 4",
    "What is the square root of 81?",
    "Name the largest planet in our solar system.",
    "Who wrote 'Romeo and Juliet'?",
];

async function handleCallback(req, res) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully.");
        res.status(200).send(challenge);
    } else {
        console.error("Webhook verification failed.");
        res.sendStatus(403);
    }
}

async function handlePost(req, res) {
    const body_param = req.body;
    console.log(JSON.stringify(body_param, null, 2));

    if (body_param.object) {
        if (
            body_param.entry &&
            body_param.entry[0].changes &&
            body_param.entry[0].changes[0].value.messages &&
            body_param.entry[0].changes[0].value.messages[0]
        ) {
            const phon_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            const from = body_param.entry[0].changes[0].value.messages[0].from;
            const msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;

            console.log("phone number " + phon_no_id);
            console.log("from " + from);
            console.log("body param " + msg_body);

            let responseText;

            if (msg_body === "/practice") {
                // If the user sends "/practice", send a random question
                const randomIndex = Math.floor(Math.random() * questions.length);
                responseText = questions[randomIndex];
            } else {
                // Default response for other messages
                responseText = "Hi.. I'm Pranav, your message is: " + msg_body;
            }

            // Send a message back to the user
            try {
                await axios({
                    method: "POST",
                    url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                    data: {
                        messaging_product: "whatsapp",
                        to: from,
                        text: {
                            body: responseText,
                        },
                    },
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                console.log("Message sent successfully.");
            } catch (error) {
                console.error("Error sending message:", error);
            }

            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    }
}

module.exports = {
    handleCallback,
    handlePost,
};

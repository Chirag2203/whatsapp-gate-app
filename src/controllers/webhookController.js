const getDB = require('../db');
const axios = require('axios');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;

const SUPABASE_URL = process.env.SUPABASE_URL; 
// const SUPABASE_KEY = process.env.SUPABASE_KEY;
const db = getDB();

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

            console.log("Phone number ID:", phon_no_id);
            console.log("From:", from);
            console.log("Message body:", msg_body);

            // Check if the user already received a welcome message
            const { data: existingUser, error } = await db
                .from('users')
                .select('phone_number')
                .eq('phone_number', from);

            if (error) {
                console.error("Error checking user in database:", error);
                res.sendStatus(500);
                return;
            }

            if (!existingUser || existingUser.length === 0) {
                // New user, send a welcome message
                const welcomeMessage = "Welcome to Kalppo! How can we assist you today?";

                try {
                    // Save user in the database
                    const { error: insertError } = await db
                        .from('users')
                        .insert([{ phone_number: from }]);

                    if (insertError) {
                        console.error("Error inserting user into database:", insertError);
                        res.sendStatus(500);
                        return;
                    }

                    // Send welcome message
                    await axios({
                        method: "POST",
                        url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                        data: {
                            messaging_product: "whatsapp",
                            to: from,
                            text: {
                                body: welcomeMessage,
                            },
                        },
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });
                    console.log("Welcome message sent successfully.");
                } catch (error) {
                    console.error("Error sending welcome message:", error);
                    res.sendStatus(500);
                    return;
                }
            }

            // Handle "/practice" or other commands
            if (msg_body === "/practice") {
                const randomId = Math.floor(Math.random() * (2750 - 2600 + 1)) + 2600;
                const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/public_assets/whatsapp/question_${randomId}.png`;
                const responseText = "Here's a practice question for you!";

                try {
                    // Send an image with a caption
                    await axios({
                        method: "POST",
                        url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                        data: {
                            messaging_product: "whatsapp",
                            to: from,
                            type: "image",
                            image: {
                                link: imageUrl,
                                caption: responseText,
                            },
                        },
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });
                    console.log("Image with caption sent successfully.");
                } catch (error) {
                    console.error("Error sending image with caption:", error);
                }
            } else {
                const responseText = "Hi from Kalppo, your message is: " + msg_body;

                try {
                    // Send a text message
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

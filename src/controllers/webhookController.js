const getDB = require('../db');
const axios = require('axios');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;

const SUPABASE_URL = process.env.SUPABASE_URL;
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

            // Check if the user exists in the database
            const { data: existingUser, error } = await db
                .from('users')
                .select('phone_number')
                .eq('phone_number', from);

            if (error) {
                console.error("Error checking user in database:", error);
                res.sendStatus(500);
                return;
            }

            if (existingUser && existingUser.length > 0) {
                // User exists, send a welcome message
                const welcomeMessage = "Welcome back to Kalppo! How can we assist you today?";
                try {
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
            } else {
                // User does not exist, initiate onboarding flow
                const steps = [
                    "Please enter your name:",
                    "What is your branch?",
                    "Are you a student, professional, or other?",
                    "What type of user are you?",
                    "What are the subjects you find most challenging?",
                ];

                const responses = {};

                const handleNextStep = async (stepIndex) => {
                    if (stepIndex < steps.length) {
                        try {
                            await axios({
                                method: "POST",
                                url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                                data: {
                                    messaging_product: "whatsapp",
                                    to: from,
                                    text: {
                                        body: steps[stepIndex],
                                    },
                                },
                                headers: {
                                    "Content-Type": "application/json",
                                },
                            });
                        } catch (error) {
                            console.error(`Error sending onboarding question ${stepIndex}:`, error);
                        }
                    } else {
                        // Save user to database after collecting all responses
                        try {
                            const { data, error } = await db
                                .from('users')
                                .insert([
                                    {
                                        phone_number: from,
                                        name: responses.name,
                                        branch: responses.branch,
                                        aspirant_type: responses.aspirantType,
                                        user_type: responses.userType,
                                        challenging_subjects: responses.challengingSubjects,
                                    },
                                ]);

                            if (error) {
                                console.error("Error inserting user into database:", error);
                            } else {
                                console.log("User added successfully to database:", data);
                                const confirmationMessage = "Thank you for onboarding! We are excited to assist you.";
                                await axios({
                                    method: "POST",
                                    url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                                    data: {
                                        messaging_product: "whatsapp",
                                        to: from,
                                        text: {
                                            body: confirmationMessage,
                                        },
                                    },
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                });
                            }
                        } catch (error) {
                            console.error("Error during onboarding completion:", error);
                        }
                    }
                };

                if (!responses.name) responses.name = msg_body;
                else if (!responses.branch) responses.branch = msg_body;
                else if (!responses.aspirantType) responses.aspirantType = msg_body;
                else if (!responses.userType) responses.userType = msg_body;
                else if (!responses.challengingSubjects) responses.challengingSubjects = msg_body;

                const currentStepIndex = Object.keys(responses).length;
                await handleNextStep(currentStepIndex);
            }

            res.sendStatus(200);
        } else if (
            body_param.entry &&
            body_param.entry[0].changes &&
            body_param.entry[0].changes[0].value.statuses
        ) {
            console.log("Status update received:", body_param.entry[0].changes[0].value.statuses.status);
            res.sendStatus(200); // Acknowledge the status update
        } else {
            console.error("Unhandled webhook payload structure.");
            res.sendStatus(404);
        }
    }
}

module.exports = {
    handleCallback,
    handlePost,
};

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

// Updated `handlePost` function
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
            const { data: user, error } = await db
                .from('users')
                .select('*')
                .eq('phone_number', from);

            if (error) {
                console.error("Error checking user in database:", error);
                res.sendStatus(500);
                return;
            }

            if (user && user.length > 0) {
                if (user[0].onboarding_complete) {
                    // User exists and onboarding is complete
                    const welcomeMessage = "Welcome back to Kalppo! How can we assist you today?";
                    await sendMessage(phon_no_id, from, welcomeMessage);
                } else {
                    // User exists but onboarding is incomplete
                    await handleOnboarding(user[0], msg_body, phon_no_id, from);
                }
            } else {
                // User does not exist, start onboarding
                const steps = [
                    "Please enter your name:",
                    "What is your branch?",
                    "Are you a student, professional, or other?",
                    "What type of user are you?",
                    "What are the subjects you find most challenging?",
                ];

                // Insert a new user record with initial onboarding state
                const { error: insertError } = await db
                    .from('users')
                    .insert([
                        {
                            phone_number: from,
                            onboarding_step: 0, // Start from the first step
                            responses: {}, // Empty responses object
                        },
                    ]);

                if (insertError) {
                    console.error("Error adding new user:", insertError);
                    res.sendStatus(500);
                    return;
                }

                // Send the first onboarding question
                await sendMessage(phon_no_id, from, steps[0]);
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

// Helper function to handle onboarding
async function handleOnboarding(user, userResponse, phon_no_id, from) {
    const steps = [
        "Please enter your name:",
        "What is your branch?",
        "Are you a student, professional, or other?",
        "What type of user are you?",
        "What are the subjects you find most challenging?",
    ];

    const currentStep = user.onboarding_step;
    const responses = user.responses || {};

    // Update the responses for the current step
    switch (currentStep) {
        case 0:
            responses.name = userResponse;
            break;
        case 1:
            responses.branch = userResponse;
            break;
        case 2:
            responses.aspirantType = userResponse;
            break;
        case 3:
            responses.userType = userResponse;
            break;
        case 4:
            responses.challengingSubjects = userResponse;
            break;
        default:
            break;
    }

    // Check if onboarding is complete
    if (currentStep < steps.length - 1) {
        // Move to the next step
        const nextStep = currentStep + 1;
        const { error } = await db
            .from('users')
            .update({ onboarding_step: nextStep, responses })
            .eq('phone_number', from);

        if (error) {
            console.error("Error updating onboarding step:", error);
        } else {
            await sendMessage(phon_no_id, from, steps[nextStep]);
        }
    } else {
        // Onboarding complete, save user data and send confirmation
        const { error } = await db
            .from('users')
            .update({
                onboarding_complete: true,
                onboarding_step: null,
                responses,
            })
            .eq('phone_number', from);

        if (error) {
            console.error("Error completing onboarding:", error);
        } else {
            const confirmationMessage = "Thank you for onboarding! We are excited to assist you.";
            await sendMessage(phon_no_id, from, confirmationMessage);
        }
    }
}

// Helper function to send a WhatsApp message
async function sendMessage(phon_no_id, to, body) {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
            data: {
                messaging_product: "whatsapp",
                to,
                text: { body },
            },
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
}


module.exports = {
    handleCallback,
    handlePost,
};

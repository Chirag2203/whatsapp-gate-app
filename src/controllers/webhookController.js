const getDB = require('../db');
const axios = require('axios');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const NAMESPACE = process.env.NAMESPACE;
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
            const username = body_param.entry[0].changes[0].value.contacts[0].profile.name;
            console.log("Phone number ID:", phon_no_id);
            console.log("From:", from);
            console.log("Message body:", msg_body);
            console.log("username:", username);
            console.log("NAMESPACE:", NAMESPACE);

            // Check if the user exists in the database
            const { data: existingUser, error } = await db
                .from('users')
                .select('value')
                .eq('phone_number', from);

            if (error) {
                console.error("Error checking user in database:", error);
                res.sendStatus(500);
                return;
            }

            const steps = [
                {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: from,
                    type: "template",
                    template:{
                        name: "welcome_msg",
                        language: {
                            code: "en_US"
                        },
                        components:[
                            {
                                type: "body",
                                
                                parameters: [
                                    {
                                      type: "text",
                                      parameter_name: "username",
                                      text: username,
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: "Please enter your name:",
                    },
                },
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: "What is your branch?",
                    },
                },
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: "Are you a student, professional, or other?",
                    },
                },
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: "Please enter your email:",
                    },
                },
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: "What are the subjects you find most challenging?",
                    },
                },
            ];

            let userState = existingUser && existingUser[0] ? existingUser[0].value : {};
            let currentStepIndex = userState.currentStep || 0;
            userState.phoneNumber = from.slice(2);
            if (currentStepIndex < steps.length) {
                // Save the response to the appropriate step
                if(currentStepIndex === 0){
                    if(msg_body.trim().toLowerCase().includes("onboard")){
                        currentStepIndex++;
                    }
                }
                else if (currentStepIndex === 1) {
                    userState.name = msg_body;
                    currentStepIndex++;
                }else if (currentStepIndex === 2) {
                    userState.branch = msg_body;
                    currentStepIndex++;
                }else if (currentStepIndex === 3) {
                    userState.aspirantType = msg_body;
                    currentStepIndex++;
                }else if (currentStepIndex === 4){ 
                    userState.email = msg_body;
                    currentStepIndex++;
                }else if (currentStepIndex === 5) {
                    userState.challengingSubjects = msg_body.split(",");
                    currentStepIndex++;
                }

                userState.currentStep = currentStepIndex;

                // Update user state in the database
                try {
                    if (existingUser && existingUser.length > 0) {
                        userState.id = existingUser[0].id;
                        await db
                            .from('users')
                            .update({ value: userState })
                            .eq('phone_number', from);
                    } else {
                        const { data, error } = await db
                            .from('users')
                            .insert([{ phone_number: from, value: userState }]).select();
                        // userState.id = data.data[0].id;
                        // await db
                        //     .from('users')
                        //     .update({ value: userState })
                        //     .eq('phone_number', from);   
                    }
                } catch (updateError) {
                    console.error("Error updating user state in database:", updateError);
                    res.sendStatus(500);
                    return;
                }

                // Send the next question
                if (currentStepIndex < steps.length) {
                    try {
                        await axios({
                            method: "POST",
                            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                            data: JSON.stringify({
                                "messaging_product": "whatsapp",
                                "recipient_type": "individual",
                                "to": `${from}`,
                                "type": "template",
                                "template":{
                                    "name": "welcome_msg",
                                    "language": {
                                        "code": "en"
                                    },
                                    "components":[
                                        {
                                            "type": "body",
                                            "parameters": [
                                                {
                                                  "type": "text",
                                                  "parameter_name": "username",
                                                  "text": `${username}`,
                                                },
                                            ]
                                        }
                                    ]
                                },
                            }),
                            headers: {
                                "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                                "Content-Type": "application/json",
                            },
                        });
                        console.log("Next question sent successfully.");
                    } catch (error) {
                        console.error("Error sending next onboarding question:", error);
                        res.sendStatus(500);
                        return;
                    }
                } else {
                    // All steps completed, send confirmation message
                    try {
                        await axios({
                            method: "POST",
                            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                            data: {
                                messaging_product: "whatsapp",
                                to: from,
                                text: {
                                    body: "Thank you for onboarding! We are excited to assist you.",
                                },
                            },
                            headers: {
                                "Content-Type": "application/json",
                            },
                        });
                        console.log("Onboarding completion message sent successfully.");
                    } catch (error) {
                        console.error("Error sending onboarding completion message:", error);
                    }
                }
            }else{
            // Handle "/practice" or other commands
            if (msg_body === "/practice") {
                const randomId = Math.floor(Math.random() * (2750 - 2600 + 1)) + 2600;
                const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/public_assets/whatsapp/question_${randomId}.png`;
                const responseText = "Reply with";

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
            } 
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

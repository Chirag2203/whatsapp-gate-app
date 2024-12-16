const getDB = require('../db');
const axios = require('axios');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const NAMESPACE = process.env.NAMESPACE;
const questionsCount = 7; // Total number of questions

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
// "response_json": "{\"screen_0_Choose_your_branch_of_study_0\":\"1_CSE\",\"flow_token\":\"unused\"}",


async function handlePost(req, res) {
    const body_param = req.body;
    console.log(JSON.stringify(body_param, null, 2));
    // const parsed = JSON.parse(body_param.entry[0].changes[0].value.messages[0]?.interactive?.nfm_reply?.response_json);
    // console.log("parsed:", parsed);
    console.log("-------HERE-------");
    // console.log("branch:", parsed?.screen_0_Choose_your_branch_of_study_0?.slice(2));
    if (body_param.object) {
        if (
            body_param.entry &&
            body_param.entry[0].changes &&
            body_param.entry[0].changes[0].value.messages &&
            body_param.entry[0].changes[0].value.messages[0]
        ) {
            const phon_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            const from = body_param.entry[0].changes[0].value.messages[0].from;
            let msg_body = "";
            if(body_param.entry[0].changes[0].value.messages[0].type == "text"){
                msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;
            }
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
                },
                {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": `${from}`,
                    "type": "template",
                    "template":{
                        "name": "select_branch",
                        "language": {
                          "code": "en"
                        },
                        "components": [
                          {
                            "type": "button",
                            "sub_type": "flow",
                            "index": "0",
                            "parameters": [
                              {
                                "type": "action",
                                "action": {}
                              }
                            ]
                          }
                        ]
                    },
                },
            ];

            let userState = existingUser && existingUser[0] ? existingUser[0].value : {
                currentQuestionIndex: 0,
                correctAnswers: 0,
                isPracticing: false,
            };
            let currentStepIndex = userState.currentStep || 0;
            userState.phoneNumber = from.slice(2);
            if (currentStepIndex < steps.length) {
                // Save the response to the appropriate step
                if(currentStepIndex === 0){
                    // if(msg_body.trim().toLowerCase().includes("onboard")){
                    //     currentStepIndex++;
                    // }else{
                        await axios({
                            method: "POST",
                            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                            data: steps[currentStepIndex++],
                            headers: {
                                "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                                "Content-Type": "application/json",
                            },
                        });
                        // res.sendStatus(200);
                        // return;
                    // }
                }
                else if (currentStepIndex === 1) {
                    const msg = body_param.entry[0].changes[0].value.messages[0];
                
                    // Check if the message is of type "interactive"
                    if (msg.type === "interactive") {
                        userState.branch = JSON.parse(msg.interactive.nfm_reply.response_json)
                            .screen_0_Choose_your_branch_of_study_0.slice(2);
                        currentStepIndex += 1;
                        userState.deviationMessageSent = false; // Reset the flag for future steps
                        console.log("------user state------", userState);
                    } else {
                        if (!userState.deviationMessageSent) {
                            // Send deviation message only if not already sent
                            await axios({
                                method: "POST",
                                url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                                data: {
                                    messaging_product: "whatsapp",
                                    to: from,
                                    text: {
                                        body: "Please follow the above instructions 👆",
                                    },
                                },
                                headers: {
                                    "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                                    "Content-Type": "application/json",
                                },
                            });
                
                            userState.deviationMessageSent = true; // Mark as sent
                        }
                
                        // Update user state in the database before exiting
                        try {
                            if (existingUser && existingUser.length > 0) {
                                await db
                                    .from('users')
                                    .update({ value: userState })
                                    .eq('phone_number', from);
                            }
                        } catch (updateError) {
                            console.error("Error updating user state in database:", updateError);
                            res.sendStatus(500);
                            return;
                        }
                
                        res.sendStatus(200);
                        return;
                    }
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
                            data: JSON.stringify(steps[currentStepIndex]),
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
                                    body: "Thank you for onboarding! We are excited to assist you. 🤝",
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
                if (userState.isPracticing){
                    await sendMessage(from, "*You are already in a practice session!*\n\nReply with your answer to proceed.", phon_no_id);
                }
                else {
                    userState.questionIds = Array.from({ length: 7 }, generateRandomIds);
                    userState.currentQuestionIndex = 0;
                    userState.correctAnswers = 0;
                    userState.isPracticing = true;

                    await sendMessage(from, "*Welcome to the practice session!🎯*\n\nYou will receive 7 questions. Answer them with *A*, *B*, *C*, or *D*. Reply to each question to proceed.", phon_no_id);
            
                    // Send the first question
                    await sendQuestion(from, userState, phon_no_id);
                }
                await updateUserState(from, userState);

                return res.sendStatus(200);
                // const randomId = Math.floor(Math.random() * (2750 - 2600 + 1)) + 2600;
                // const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/public_assets/whatsapp/question_${randomId}.png`;
                // const responseText = "Reply with";

                // try {
                //     // Send an image with a caption
                //     await axios({
                //         method: "POST",
                //         url: `https://graph.facebook.com/v19.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                //         data: {
                //             messaging_product: "whatsapp",
                //             to: from,
                //             type: "image",
                //             image: {
                //                 link: imageUrl,
                //                 caption: responseText,
                //             },
                //         },
                //         headers: {
                //             "Content-Type": "application/json",
                //         },
                //     });
                //     console.log("Image with caption sent successfully.");
                // } catch (error) {
                //     console.error("Error sending image with caption:", error);
                // }
            } 
            // If user is in practice mode and responds to a question
            if (userState.isPracticing) {
                const userAnswer = msg_body.trim().toUpperCase();

                // Fetch the current question from the database
                const { data: questionData, error: questionError } = await db
                    .from("questions")
                    .select("value")
                    .eq("id", userState.currentQuestionIndex + 1);

                if (questionError || questionData.length === 0) {
                    await sendMessage(from, "*Error fetching question. Please try again later.*", phon_no_id);
                    return res.sendStatus(500);
                }

                const question = questionData[0].value;
                const correctOption = question.options.find(option => option.isCorrect);
                const isCorrect = correctOption.label === userAnswer;

                // Provide feedback
                if (isCorrect) {
                    userState.correctAnswers++;
                    await sendMessage(from, `✅ *Correct answer!*\n\n_Your Progress:_ ${generateProgressBar(userState.correctAnswers, userState.currentQuestionIndex + 1)}`, phon_no_id);
                } else {
                    const correctLabels = question.options.filter(opt => opt.isCorrect).map(opt => opt.label).join(", ");
                    await sendMessage(from, `❗ *Incorrect Answer* ❌\n\nThe correct answer is *option(s) ${correctLabels}*\n\n${question.explanation}\n\n_Your Progress:_ ${generateProgressBar(userState.correctAnswers, userState.currentQuestionIndex + 1)}`, phon_no_id);
                }

                // Check if more questions are remaining
                userState.currentQuestionIndex++;
                if (userState.currentQuestionIndex < questionsCount) {
                    await sendQuestion(from, userState, phon_no_id);
                } else {
                    // End the practice session
                    await sendMessage(from, `*Practice session completed!*\n\nYou got *${userState.correctAnswers}* out of *${questionsCount}* questions correct.`, phon_no_id);
                    userState.isPracticing = false;
                }

                // Update user state in the database
                await updateUserState(from, userState);
                return res.sendStatus(200);
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

// Helper function to send a question as an image
async function sendQuestion(to, userState, phon_no_id) {
    const questionIndex = userState.currentQuestionIndex + 1;

    // Construct the image URL dynamically
    const randomId = userState.questionIds[questionIndex]; // Assuming `randomId` is derived from the question index
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/public_assets/whatsapp/question_${randomId}.png`;

    // Prepare the caption text with progress
    const caption = `*Question ${questionIndex} out of ${questionsCount}*\n\n${generateProgressBar(userState.correctAnswers, questionsCount)}\n\nReply with A, B, C, or D to answer.`;

    try {
        // Send the image message
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
            data: {
                messaging_product: "whatsapp",
                to,
                type: "image",
                image: {
                    link: imageUrl,
                    caption,
                },
            },
            headers: {
                Authorization: `Bearer ${PERMANENT_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        // Update user state in the database
        await updateUserState(to, userState);
    } catch (error) {
        console.error("Error sending question image:", error);
        await sendMessage(to, "*Error sending question. Please try again later.*", phon_no_id);
    }
}


async function sendMessage(to, body, phon_no_id) {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
            data: {
                messaging_product: "whatsapp",
                to,
                text: { body },
            },
            headers: {
                Authorization: `Bearer ${PERMANENT_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// Helper function to update user state in the database
async function updateUserState(phoneNumber, userState) {
    try {
        await db
            .from("users")
            .update({ value: userState })
            .eq("phone_number", phoneNumber);
    } catch (error) {
        console.error("Error updating user state:", error);
    }
}

// Helper function to generate progress bar
function generateProgressBar(correctAnswers, totalQuestions) {
    const progress = Math.round((correctAnswers / totalQuestions) * 5);
    return "🔵".repeat(progress) + "⚪".repeat(5 - progress);
}

function generateRandomIds(){
    return Math.floor(Math.random() * (2750 - 2549 + 1)) + 2549;
}

module.exports = {
    handleCallback,
    handlePost,
};

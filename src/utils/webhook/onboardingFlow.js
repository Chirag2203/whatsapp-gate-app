const getDB = require('../../db');
const axios = require('axios');
const { updateUserState } = require('../webhook/updateUserState')
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const questionsCount = 5; // Total number of questions

const db = getDB();

async function onboardingFlow(currentStepIndex, steps, from, phon_no_id, body_param, userState, existingUser){
    // Save the response to the appropriate step
    if(currentStepIndex === 0){
        // if(msg_body.trim().toLowerCase().includes("onboard")){
        //     currentStepIndex++;
        // }else{
            await axios({
                method: "POST",
                url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                data: steps[currentStepIndex],
                headers: {
                    "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });
            currentStepIndex += 1;
            // res.sendStatus(200);
            // return;
        // }
    }
    else if (currentStepIndex === 1) {
        const msg = body_param.entry[0].changes[0].value.messages[0];
    
        // Check if the message is of type "interactive"
        if (msg.type == "interactive") {
            userState.branch = JSON.parse(msg.interactive.nfm_reply.response_json)
                .screen_0_Choose_your_branch_of_study_0.slice(2);
            currentStepIndex += 1;
            userState.deviationMessageSent = false; // Reset the flag for future steps
            console.log("------user state------", userState);
            await updateUserState(from, userState);
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
                        .from('whatsapp_user_activity')
                        .update({ value: userState })
                        .eq('phone_number', from.slice(2));
                }
            } catch (updateError) {
                console.error("Error updating user state in database:", updateError);
                // res.sendStatus(500);
                return;
            }
    
            // res.sendStatus(200);
            return;
        }
    }
    

    userState.currentStep = currentStepIndex;

    // Update user state in the database
    try {
        if (existingUser && existingUser.length > 0) {
            userState.id = existingUser[0].id;
            await db
                .from('whatsapp_user_activity')
                .update({ value: userState })
                .eq('phone_number', from.slice(2));
        } else {
            const { data, error } = await db
                .from('whatsapp_user_activity')
                .insert([{ phone_number: from.slice(2), value: userState }]).select();
            // const {data: forId, error: forIdError} = await db.from('users').select('id').eq('phone_number', from.slice(2));
            // userState.id = forId[0].id;
            // await updateUserState(from, userState);
            // userState.id = data.data[0].id;
            // await db
            //     .from('users')
            //     .update({ value: userState })
            //     .eq('phone_number', from);   
        }
    } catch (updateError) {
        console.error("Error updating user state in database:", updateError);
        // res.sendStatus(500);
        return;
    }

    // Send the next question
    if (currentStepIndex < steps.length && userState.toAskBranch) {
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
            // res.sendStatus(500);
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
            userState.currentStep = 2;
            await updateUserState(from, userState);
            console.log("Onboarding completion message sent successfully.");
        } catch (error) {
            console.error("Error sending onboarding completion message:", error);
        }
    }
}


module.exports = {
    onboardingFlow,
}
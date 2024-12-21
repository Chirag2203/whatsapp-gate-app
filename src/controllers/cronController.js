const getDB = require('../db');
const axios = require('axios');
const db = getDB();
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;

async function handleDailyChallenge(req, res) {

    const {data: userData, error: userError} = await db.from("whatsapp_user_activity").select('*');
    let dailyChallengeUsers = userData.filter(user => user.value.optedForDC === true);
    // console.log(dailyChallengeUsers);
    for(let user of dailyChallengeUsers){
        let qb = "CSE";
        switch (user.value.branch) {
            case "Mechanical_Engineering":
                qb = "ME";
                break;
            case "CSE":
                qb = "CSE";
                break;
            case "Civil":
                qb = "CE";
                break;
            case "Electrical":
                qb = "EE";
                break;
            case "Electronics":
                qb = "ECE";
                break;
            case "Mechanical":
                qb = "ME";
                break;
        }
        try {
            const response = await axios({
                method: "POST",
                url: `https://graph.facebook.com/v21.0/${user.value.phon_no_id}/messages`,
                data: {
                    "messaging_product": "whatsapp",
                    "to": `91${user.value.phoneNumber}`,
                    "type": "template",
                    "template": {
                        "name": "reminder_message",
                        "language": {
                          "code": "en"
                        },
                        "components": [
                          {
                            "type": "body",
                            "parameters": [
                              {
                                "type": "text",
                                "parameter_name": "name",
                                "text": `${user.value.name.split(" ")[0]}`
                              },
                              {
                                "type": "text",
                                "parameter_name": "time",
                                "text": "6PM"
                              }
                            ]
                          },
                          {
                            "type": "button",
                            "sub_type": "quick_reply",
                            "index": "0",
                            "parameters": [
                              {
                                "type": "payload",
                                "payload": "/start_challenge"
                              }
                            ]
                          }
                        ]
                    }                                        
                },
                headers: {
                    "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });
            const updatedValue = {
                ...user.value, // Clone existing value
                reminderMsgId: response.data.messages[0].id // Add or update reminderMsgId
            };
            await db
            .from("whatsapp_user_activity")
            .update({ value: updatedValue })
            .eq("phone_number", user.value.phoneNumber);
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }
    // const { data: courseData, error: courseError } = await db.from("courses").select('*').eq("branch", qb);
    // const { data: practice_questions, error: practice_questionsError } = await db.from('questions').select('*').in('course', userState.courseNames).eq('whatsapp_enabled', true);

    // await db.from('questions').select('*').limit(7);
    console.log("cron job called");
    res.send({hi: "message"})
}

module.exports = {
    handleDailyChallenge
}
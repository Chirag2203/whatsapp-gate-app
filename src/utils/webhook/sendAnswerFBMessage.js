const getDB = require('../../db');
const axios = require('axios');
const { generateExplanationProgressBar, generateProgressBar } = require('../webhook/progressBars')
const { updateUserState } = require('../webhook/updateUserState');

const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;


async function sendAnswerFBMessage(to, caption, phon_no_id, userState, templateName) {
    const questionIndex = userState.isDoingDC ? userState.dcCurrentQuestionIndex : userState.currentQuestionIndex;

    // Construct the image URL dynamically
    const randomId = userState.isDoingDC ? userState.dcQuestionIds[questionIndex] : userState.questionIds[questionIndex];
    // const imageResponse = await axios.get(`${API_BASE_URL_PROD}/image/${randomId}`);
    // const { explanationImageUrl } = imageResponse.data;
    // if (!explanationImageUrl) {
    //     throw new Error("Image URL not returned from the server.");
    // }
    // const imageUrl = explanationImageUrl;
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/public_assets/whatsapp/explanation_${randomId}.png`;
    let msgId = "";
    let params = [];
    if(templateName == "incorrect_answer_fb_msg" || templateName == "dc_incorrect_answer_fb_msg"){
        params = [
            {
                "type": "text",
                "parameter_name": "range",
                "text": caption,
            },
            {
            "type": "text",
            "parameter_name":"progress",
            "text": userState.isDoingDC ? generateExplanationProgressBar(userState.dcAnswers, userState.dcCurrentQuestionIndex+1) : generateExplanationProgressBar(userState.answers, userState.currentQuestionIndex+1),
            }
        ]
    }else{
        params = [
            {
            "type": "text",
            "parameter_name":"progress",
            "text": userState.isDoingDC ? generateExplanationProgressBar(userState.dcAnswers, userState.dcCurrentQuestionIndex+1) : generateExplanationProgressBar(userState.answers, userState.currentQuestionIndex+1),
            }
        ]
    }
    try {
        const response = await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
            data: {
                messaging_product: "whatsapp",
                to,
                type: "template",
                template:  {
                    "name": `${userState.isDoingDC ? `dc_${templateName}`: templateName}`,
                    "language": {
                      "code": "en"
                    },
                    "components": [
                      {
                        "type": "header",
                        "parameters": [
                          {
                            "type": "image",
                            "image": {
                              "link": imageUrl
                            }
                          }
                        ]
                      },
                      {
                        "type": "body",
                        "parameters": params,
                      },
                      {
                        "type": "button",
                        "sub_type": "quick_reply",
                        "index": "0",
                        "parameters": [
                          {
                            "type": "payload",
                            "payload": "next_question"
                          }
                        ]
                      },
                      {
                        "type": "button",
                        "sub_type": "quick_reply",
                        "index": "1",
                        "parameters": [
                          {
                            "type": "payload",
                            "payload": `${userState.isDoingDC ? "end_dc" : "end_practice"}`
                          }
                        ]
                      }
                    ]
                }
            },
            headers: {
                Authorization: `Bearer ${PERMANENT_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        msgId = response.data.messages[0].id;
        userState.nextQuestionMessageId = msgId;
        await updateUserState(to, userState);
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

module.exports = {
    sendAnswerFBMessage,
}
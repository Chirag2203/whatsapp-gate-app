const getDB = require('../../db');
const axios = require('axios');

const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;


async function handleFeedback(current_msg, userState){

    if(current_msg.context && current_msg.context.id == userState.feedbackMsgId){
        if(current_msg.type == "interactive"){
            fb = JSON.parse(current_msg.interactive.nfm_reply.response_json);
            function formatRating(value) {
                const parts = value.split("_•_");
                const stars = parts[0].split("_")[1]; // Extract stars (★★★★★)
                const description = parts[1]?.split(" ")[0]; // Extract description (e.g., "Excellent")
                return `${stars} - ${description}`;
            }
            const feedback = {
                questionVariety: formatRating(fb.screen_1_Question_Variety_0),
                explanationQuality: formatRating(fb.screen_1_Explanation_Quality_1),
                easeOfInteraction: formatRating(fb.screen_1_Ease_of_Interaction_2),
                usefulness: formatRating(fb.screen_1_Usefulness_3),
                choose: fb.screen_0_Choose_0.split("_")[1],
                featureImprovement: fb.screen_0_Suggest_a_feature_improvement_1,
            };
            userState.feedback = feedback;
            console.log("feedback:", userState.feedback );
            userState.isGivingFeedback = false;
            // if(feedback == "user_feedback"){
            await sendMessage(from, "Thank you for your feedback! 🙏", phon_no_id);
            // }
            await updateUserState(from, userState);
        }
    }else{
    console.log("in feedback msg else");
    const feedbackResp = await axios({
        method: "POST",
        url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
        data: {
            "messaging_product": "whatsapp",
            "to": `${from}`,
            "type": "template",
            "template": {
                "name": "user_feedback",
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
        headers: {
            "Authorization": `Bearer ${PERMANENT_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    userState.feedbackMsgId = feedbackResp.data.messages[0].id;
    userState.isGivingFeedback = true;
    await updateUserState(from, userState);
    }

}


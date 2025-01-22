const axios = require('axios');
const { updateUserState } = require('../../utils/webhook/updateUserState');
const { sendMessage } = require('./sendMessage');

const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const BACKEND_URL = "https://kalppo-backend.vercel.app";
const WHATSAPP_SECRET_KEY = process.env.WHATSAPP_BACKEND_SECRET;

async function askConversation(userState, body_param, from, phon_no_id){
    if(!userState.jwt){
        const getTokenData = {
            phoneNumber: userState.phoneNumber,
            secretKey: WHATSAPP_SECRET_KEY,
        };
        const tokenResponse = await axios.post(`${BACKEND_URL}/auth/token/get`, getTokenData, {
          headers: {
            'content-type': 'application/json'
          }
        });
        const jwtToken = tokenResponse.data.jwtToken;
        userState.jwt = jwtToken;
        await updateUserState(from, userState);
    }

    if(body_param.entry[0].changes[0].value.messages[0].type == "image"){
        const imageData = body_param.entry[0].changes[0].value.messages[0].image;
        const imageId = imageData.id;

        // Download image from WhatsApp Media API
        const imageResponse = await axios({
            method: 'GET',
            url: `https://graph.facebook.com/v22.0/${imageId}`,
            headers: {
                'Authorization': `Bearer ${PERMANENT_TOKEN}`
            }
        });

        // Get image URL from the response
        const imageUrl = imageResponse.data.url;
        console.log("IMG URL:", imageUrl);
        const imageBuffer = await axios({
            method: 'GET',
            url: imageUrl,
            headers: {
                'Authorization': `Bearer ${PERMANENT_TOKEN}`
            },
            responseType: 'arraybuffer'
        });
        console.log("imageBuffer:", imageBuffer);


        const base64Image = Buffer.from(imageBuffer.data).toString('base64');
        const base64EncodedImage = `data:${imageData.mime_type};base64,${base64Image}`;

        const createAskConversationData = {
            base64EncodedImage
        };
        const conversationResponse = await axios.post(
            `${BACKEND_URL}/askConversations`, 
            createAskConversationData, 
            {
                headers: {
                    'content-type': 'application/json',
                    'Authorization': `Bearer ${userState.jwt}`
                }
            }
        );
        console.log('Ask conversation (image): ', JSON.stringify(conversationResponse.data));
        await sendMessage(from, JSON.stringify(conversationResponse.data), phon_no_id);
    }
    else if(body_param.entry[0].changes[0].value.messages[0].type == "text"){
        const createAskConversationData = {
            content: `${body_param.entry[0].changes[0].value.messages[0].text.body}`
        }
        
        const conversationResponse = await axios.post(`${BACKEND_URL}/askConversations`, createAskConversationData, {
            headers: {
                'content-type': 'application/json',
                'Authorization': `Bearer ${userState.jwt}`
            }
        })
        console.log('Ask conversation (text): ', JSON.stringify(conversationResponse.data));
        const formatMessage = (conversationResponse) => {
            const explanationSteps = conversationResponse.data.askConversation.explanationSteps;
            let formattedMessage = `*LRU Page Replacement Algorithm Simulation*\n\n`;
            explanationSteps.forEach((step, index) => {
                formattedMessage += `*Step ${index + 1}:* ${step.briefExplanation}\n\n`;
            });
            return formattedMessage.trim();
        };
        const formattedMsg = formatMessage(conversationResponse);

        await sendMessage(from, formattedMsg, phon_no_id);
    }
    userState.isInAskConv = false;
    await updateUserState(from, userState);   
}

module.exports = {
    askConversation,
}
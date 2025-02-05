const axios = require('axios');
const { updateUserState } = require('../../utils/webhook/updateUserState');
const { sendMessage } = require('./sendMessage');

const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const BACKEND_URL = "https://kalppo-backend.vercel.app";
const WHATSAPP_SECRET_KEY = process.env.WHATSAPP_BACKEND_SECRET;
const API_BASE_URL_PROD = process.env.BASE_URL_PROD;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function askConversation(userState, body_param, from, phon_no_id){
    // if(!userState.jwt){
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
    // }

    if(body_param.entry[0].changes[0].value.messages[0].type == "image"){
        console.log("inside ask conv (image)")

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
        // console.log("IMG URL:", imageUrl);
        const imageBuffer = await axios({
            method: 'GET',
            url: imageUrl,
            headers: {
                'Authorization': `Bearer ${PERMANENT_TOKEN}`
            },
            responseType: 'arraybuffer'
        });
        // console.log("imageBuffer:", imageBuffer);


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
        const formatQuestionMessage = (conversationResponse) => {
            const { question, options, explanationSteps } = conversationResponse.data.askConversation;
            let formattedMessage = `*Question:*\n${question}\n\n*Options:*\n`;
            
            options.forEach(option => {
                formattedMessage += `${option.isCorrect ? `*${option.text}*` : `${option.text}`}`;
                if (option.isCorrect) {
                    formattedMessage += ` (✅ Correct Answer)`;
                }
                formattedMessage += `\n`;
            });
        
            formattedMessage += `\n*Explanation:*\n`;
            explanationSteps.forEach((step, index) => {
                formattedMessage += `*Step ${index + 1}:* ${step.briefExplanation}\n\n`;
            });
        
            return formattedMessage.trim();
        };
        // const formattedMsg = formatQuestionMessage(conversationResponse);
        
        // await sendMessage(from, formattedMsg, phon_no_id);
        const generateImageResponse = await axios.post(
            `${API_BASE_URL_PROD}image/askAI`,
            { conversation: conversationResponse.data.askConversation },
            {
            headers: {
                'content-type': 'application/json',
                'Authorization': `Bearer ${userState.jwt}`
            }
            }
        );
        const generateImageUrl = generateImageResponse.data.imageUrl;
        console.log("image url: ", generateImageUrl)
        await delay(2000);
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
            data: {
                messaging_product: "whatsapp",
                to: `${from}`,
                type: "image",
                image: {
                    link: generateImageUrl,
                    caption: "",
                },
            },
            headers: {
                Authorization: `Bearer ${PERMANENT_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
    }
    else if(body_param.entry[0].changes[0].value.messages[0].type == "text"){
        console.log("inside ask conv (text)")

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
            let formattedMessage = `*Here's how you can tackle the question:*\n\n`;
            explanationSteps.forEach((step, index) => {
                formattedMessage += `*Step ${index + 1}:* ${step.briefExplanation}\n\n`;
            });
            return formattedMessage.trim();
        };
        // const formattedMsg = formatMessage(conversationResponse);

        // await sendMessage(from, formattedMsg, phon_no_id);
        const generateImageResponse = await axios.post(
            `${API_BASE_URL_PROD}image/askAI`,
            { conversation: conversationResponse.data.askConversation },
            {
            headers: {
                'content-type': 'application/json',
                'Authorization': `Bearer ${userState.jwt}`
            }
            }
        );
        const generateImageUrl = generateImageResponse.data.imageUrl;
        console.log("image url: ", generateImageUrl)
        await delay(2000);
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
            data: {
                messaging_product: "whatsapp",
                to: `${from}`,
                type: "image",
                image: {
                    link: generateImageUrl,
                    caption: "",
                },
            },
            headers: {
                Authorization: `Bearer ${PERMANENT_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
    }
    userState.isInAskConv = false;
    await updateUserState(from, userState);   
    return;
}

module.exports = {
    askConversation,
}
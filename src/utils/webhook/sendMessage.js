const axios = require('axios');

const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;


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

module.exports = {
    sendMessage,
};
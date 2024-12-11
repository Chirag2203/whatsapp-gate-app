const getDB = require('../db');

async function handleCallback(req, res) {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
    // console.log(VERIFY_TOKEN)
    // Parse query params
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Check if the mode and token are valid
    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        // Respond with the challenge token to verify the webhook
        console.log("Webhook verified successfully.");
        res.status(200).send(challenge);
    } else {
        // Respond with '403 Forbidden' if verification fails
        console.error("Webhook verification failed.");
        res.sendStatus(403);
    }
}   
async function handlePost(req, res){ //i want some 

    let body_param=req.body;

    console.log(JSON.stringify(body_param,null,2));

    if(body_param.object){
        console.log("inside body param");
        if(body_param.entry && 
            body_param.entry[0].changes && 
            body_param.entry[0].changes[0].value.messages && 
            body_param.entry[0].changes[0].value.messages[0]  
            ){
               let phon_no_id=body_param.entry[0].changes[0].value.metadata.phone_number_id;
               let from = body_param.entry[0].changes[0].value.messages[0].from; 
               let msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;

               console.log("phone number "+phon_no_id);
               console.log("from "+from);
               console.log("boady param "+msg_body);

               axios({
                   method:"POST",
                   url:"https://graph.facebook.com/v13.0/"+phon_no_id+"/messages?access_token="+token,
                   data:{
                       messaging_product:"whatsapp",
                       to:from,
                       text:{
                           body:"Hi.. I'm Pranav, your message is "+msg_body
                       }
                   },
                   headers:{
                       "Content-Type":"application/json"
                   }

               });

               res.sendStatus(200);
            }else{
                res.sendStatus(404);
            }

    }

}
module.exports = {
    handleCallback,
    handlePost,
};
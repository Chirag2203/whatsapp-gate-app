const getDB = require('../../db');
const axios = require('axios');
const { updateUserState } = require('../webhook/updateUserState')
const { sendMessage } = require('../webhook/sendMessage')
const { generateProgressBar } = require('../webhook/progressBars');
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const questionsCount = 5; // Total number of questions

const db = getDB();

// Helper function to send a question as an image
async function sendQuestion(to, userState, phon_no_id) {
    const questionIndex = userState.isDoingDC ? userState.dcCurrentQuestionIndex : userState.currentQuestionIndex;

    // Construct the image URL dynamically
    const randomId = userState.isDoingDC ? userState.dcQuestionIds[questionIndex] : userState.questionIds[questionIndex]; // Assuming `randomId` is derived from the question index
    const { data: questionData, error: questionError } = await db
    .from("questions")
    .select("value")
    .eq("id", randomId);
    const question = questionData[0].value;
    let qtype = question.type;
    const allCorrectOptions = question.options.filter(option => option.isCorrect)
    const noOfCorrectOptions = allCorrectOptions.length;
    
    const source = question.source;

    // const imageResponse = await axios.get(`${API_BASE_URL_PROD}image/${randomId}`);
    // const { questionImageUrl } = imageResponse.data;
    // if (!questionImageUrl) {
    //     throw new Error("Image URL not returned from the server.");
    // }
    // const imageUrl = questionImageUrl;
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/public_assets/whatsapp/question_${randomId}.png`;
    // Prepare the caption text with progress
    let pyqtype = "";
    // let pqtype = qtype.split("_").map((z)=>z[0].toUpperCase()+z.slice(1));
    // let pyqtype = pqtype.join(" ")
    if(noOfCorrectOptions>=2){
        pyqtype = "Multiple Correct";
    }else if(noOfCorrectOptions == 1){
        pyqtype = "Single Correct";
    }else if(noOfCorrectOptions == 0){
        pyqtype = "Numerical";
    }else{
        pyqtype = "Multiple Choice";
    }
    let caption = `\`${source}\` · _${pyqtype}_\n\n*Question ${questionIndex+1} out of ${questionsCount}*\n\n${generateProgressBar(questionIndex+1, questionsCount)}\n\n`;
    if(pyqtype == "Numerical"){
        caption += "Reply with a numeric value. For example, 42.";
    }else if(pyqtype == "Multiple Correct" || pyqtype == "Multiple Choice"){
        caption += "Reply with ACB or A CB or A C B or AC B etc. Only alphabets, no special characters!";
    }else if(pyqtype == "Single Correct"){
        caption += "Reply with A, B, C, or D.";
    }
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

module.exports = {
    sendQuestion,
}
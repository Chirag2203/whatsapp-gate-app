const getDB = require('../db');
const axios = require('axios');
const db = getDB();
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const { updateUserState } = require('../utils/webhook/updateUserState');


(async () => {
const {data: userData, error: userError} = await db.from("whatsapp_user_activity").select('*');
for(let user of userData){
    if(user.value.phoneNumber == "9175510124"){
        let userState = { ...user.value, 
            isPracticing: false, 
            subjectOfPracticeQSent: false,
            subjectOfPracticeMsgId: "",
            currentQuestionIndex: 0,
            nextQuestionMessageId: "",
            practiceSessionStartedAt: "",
            practiceSessionEndedAt: "",
        }
        await updateUserState(`91${user.value.phoneNumber}`, userState);
        console.log(userState, "done");
    }
}
})();

// module.exports = {
//     resetOldDates
// }
const getDB = require('../db');
const axios = require('axios');
const { getOnboardingSteps } = require('../utils/webhook/onboardingSteps');
const { generateExplanationProgressBar, generateProgressBar } = require('../utils/webhook/progressBars')
const { sendMessage } = require('../utils/webhook/sendMessage');
const { sendQuestion } = require('../utils/webhook/sendQuestion');
const { updateUserState } = require('../utils/webhook/updateUserState');
const { sendAnswerFBMessage } = require('../utils/webhook/sendAnswerFBMessage');
const { onboardingFlow } = require('../utils/webhook/onboardingFlow');
const VERIFY_TOKEN = process.env.VERIFY_TOKEN_WAPP;
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const NAMESPACE = process.env.NAMESPACE;
const questionsCount = 5; // Total number of questions
const API_BASE_URL_PROD = process.env.BASE_URL_PROD
const API_BASE_URL_DEV = "https://localhost:300/"
// Create an Intl.DateTimeFormat object for IST
const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});
// console.log(courses.map((c) => c.split("&").map((x)=>x.trim())))
const db = getDB();

async function handleCallback(req, res) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully.");
        res.status(200).send(challenge);
    } else {
        console.error("Webhook verification failed.");
        res.sendStatus(403);
    }
}
// "response_json": "{\"screen_0_Choose_your_branch_of_study_0\":\"1_CSE\",\"flow_token\":\"unused\"}",


async function handlePost(req, res) {
    const body_param = req.body;
    // console.log(JSON.stringify(body_param, null, 2));
    // const parsed = JSON.parse(body_param.entry[0].changes[0].value.messages[0]?.interactive?.nfm_reply?.response_json);
    // console.log("parsed:", parsed);
    // console.log("-------HERE-------");
    // console.log("branch:", parsed?.screen_0_Choose_your_branch_of_study_0?.slice(2));
    if (body_param.object) {
        if (
            body_param.entry &&
            body_param.entry[0].changes &&
            body_param.entry[0].changes[0].value.messages &&
            body_param.entry[0].changes[0].value.messages[0]
        ) {
            const current_msg = body_param.entry[0].changes[0].value.messages[0];
            const phon_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            const from = body_param.entry[0].changes[0].value.messages[0].from;
            let msg_body = "";
            if(body_param.entry[0].changes[0].value.messages[0].type == "text"){
                msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;
            }
            const username = body_param.entry[0].changes[0].value.contacts[0].profile.name;
            console.log("Phone number ID:", phon_no_id);
            console.log("From:", from);
            console.log("Message body:", msg_body);
            console.log("username:", username);
            console.log("NAMESPACE:", NAMESPACE);

            // Check if the user exists in the database
            const { data: existingUser, error } = await db
                .from('whatsapp_user_activity')
                .select('value')
                .eq('phone_number', from.slice(2));
            
            const { data: existingInUsersTable, existingInUsersTableError } = await db
                .from('users')
                .select('value')
                .eq('phone_number', from.slice(2));
            
            if (error) {
                console.error("Error checking user in database:", error);
                res.sendStatus(500);
                return;
            }

            const steps = getOnboardingSteps(from, username);

            // console.log("-----existingUser-----", existingUser)
            let userState = existingUser && existingUser[0] 
            ? { ...existingUser[0].value } // Create a shallow copy of the userState
            : {
                name: username,
                currentQuestionIndex: 0,
                correctAnswers: 0,
                isPracticing: false,
                branchOfPractice: false,
                subjectOfPractice: false,
                currentStep: 0,
                toAskBranch: true,
            };
        
            // Only add the `id` if it exists (ensuring we're not overwriting it)
            // if (existingUser && existingUser[0]) {
            //     userState = { ...userState, id: existingUser[0].value.id }; // Add `id` without overwriting existing `userState`
            // }
            if(existingInUsersTable && existingInUsersTable.length > 0){
                userState = {...userState, branch : existingInUsersTable[0].value.branch, toAskBranch: false};
            }
            if (existingUser && existingUser[0] && existingUser[0].value) {
            //
            }
            // Create a copy of the `currentStepIndex` value to avoid modifying the original object
            let currentStepIndex = userState.currentStep;
            
            // Update the `phoneNumber` and `phon_no_id` properties without mutating the existing `userState` object
            userState = { ...userState, phoneNumber: from.slice(2), phon_no_id: phon_no_id };
            
            if (currentStepIndex < steps.length) {
                await onboardingFlow(currentStepIndex, steps, from, phon_no_id, body_param, userState, existingUser);
                // Save the response to the appropriate step
                // if(currentStepIndex === 0){
                //     // if(msg_body.trim().toLowerCase().includes("onboard")){
                //     //     currentStepIndex++;
                //     // }else{
                //         await axios({
                //             method: "POST",
                //             url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                //             data: steps[currentStepIndex],
                //             headers: {
                //                 "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                //                 "Content-Type": "application/json",
                //             },
                //         });
                //         currentStepIndex += 1;
                //         // res.sendStatus(200);
                //         // return;
                //     // }
                // }
                // else if (currentStepIndex === 1) {
                //     const msg = body_param.entry[0].changes[0].value.messages[0];
                
                //     // Check if the message is of type "interactive"
                //     if (msg.type === "interactive") {
                //         userState.branch = JSON.parse(msg.interactive.nfm_reply.response_json)
                //             .screen_0_Choose_your_branch_of_study_0.slice(2);
                //         currentStepIndex += 1;
                //         userState.deviationMessageSent = false; // Reset the flag for future steps
                //         console.log("------user state------", userState);
                //         await updateUserState(from, userState);
                //     } else {
                //         if (!userState.deviationMessageSent) {
                //             // Send deviation message only if not already sent
                //             await axios({
                //                 method: "POST",
                //                 url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                //                 data: {
                //                     messaging_product: "whatsapp",
                //                     to: from,
                //                     text: {
                //                         body: "Please follow the above instructions 👆",
                //                     },
                //                 },
                //                 headers: {
                //                     "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                //                     "Content-Type": "application/json",
                //                 },
                //             });
                
                //             userState.deviationMessageSent = true; // Mark as sent
                //         }
                
                //         // Update user state in the database before exiting
                //         try {
                //             if (existingUser && existingUser.length > 0) {
                //                 await db
                //                     .from('whatsapp_user_activity')
                //                     .update({ value: userState })
                //                     .eq('phone_number', from.slice(2));
                //             }
                //         } catch (updateError) {
                //             console.error("Error updating user state in database:", updateError);
                //             res.sendStatus(500);
                //             return;
                //         }
                
                //         res.sendStatus(200);
                //         return;
                //     }
                // }
                

                // userState.currentStep = currentStepIndex;

                // // Update user state in the database
                // try {
                //     if (existingUser && existingUser.length > 0) {
                //         userState.id = existingUser[0].id;
                //         await db
                //             .from('whatsapp_user_activity')
                //             .update({ value: userState })
                //             .eq('phone_number', from.slice(2));
                //     } else {
                //         const { data, error } = await db
                //             .from('whatsapp_user_activity')
                //             .insert([{ phone_number: from.slice(2), value: userState }]).select();
                //         // const {data: forId, error: forIdError} = await db.from('users').select('id').eq('phone_number', from.slice(2));
                //         // userState.id = forId[0].id;
                //         // await updateUserState(from, userState);
                //         // userState.id = data.data[0].id;
                //         // await db
                //         //     .from('users')
                //         //     .update({ value: userState })
                //         //     .eq('phone_number', from);   
                //     }
                // } catch (updateError) {
                //     console.error("Error updating user state in database:", updateError);
                //     res.sendStatus(500);
                //     return;
                // }

                // // Send the next question
                // if (currentStepIndex < steps.length && userState.toAskBranch) {
                //     try {
                //         await axios({
                //             method: "POST",
                //             url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                //             data: JSON.stringify(steps[currentStepIndex]),
                //             headers: {
                //                 "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                //                 "Content-Type": "application/json",
                //             },
                //         });
                //         console.log("Next question sent successfully.");
                //     } catch (error) {
                //         console.error("Error sending next onboarding question:", error);
                //         res.sendStatus(500);
                //         return;
                //     }
                // } else {
                //     // All steps completed, send confirmation message
                //     try {
                //         await axios({
                //             method: "POST",
                //             url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages?access_token=${PERMANENT_TOKEN}`,
                //             data: {
                //                 messaging_product: "whatsapp",
                //                 to: from,
                //                 text: {
                //                     body: "Thank you for onboarding! We are excited to assist you. 🤝",
                //                 },
                //             },
                //             headers: {
                //                 "Content-Type": "application/json",
                //             },
                //         });
                //         userState.currentStep = 2;
                //         await updateUserState(from, userState);
                //         console.log("Onboarding completion message sent successfully.");
                //     } catch (error) {
                //         console.error("Error sending onboarding completion message:", error);
                //     }
                // }
            }else{
            // Handle "/practice" or other commands
            if ((msg_body == "/practice" || userState.isPracticing) && !userState.isDoingDC) {
                if (msg_body == "/practice" && userState.isPracticing){
                    console.log("Already in practice session");
                    // await sendMessage(from, "*You are already in a practice session!*\n\nReply with your answer to proceed.", phon_no_id);
                }
                else {
                    if(!userState.subjectOfPracticeQSent){
                        let qb = "CSE";
                        switch (userState.branch) {
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
                        const { data: courseData, error } = await db.from("courses").select('*').eq("branch", qb);
                        console.log("courseData",courseData)
                        const coursesData = courseData.map(row => ({
                            id: row.value.id,
                            name: row.value.name
                        }));
                        let courses = coursesData.map(course => course.name);
                        
                        // Club names until there are exactly 10 items
                        if (courses.length > 10) {
                            const clubbedCourses = [];
                            const clubbedCourseIds = [];
                            let index = 0;
                        
                            while (clubbedCourses.length < 10) {
                                if (courses.length - index > 10 - clubbedCourses.length) {
                                    // Combine two names
                                    const combinedName = courses[index] + " & " + courses[index + 1];
                                    const combinedIds = `${coursesData[index].id},${coursesData[index + 1].id}`;
                                    clubbedCourses.push(combinedName);
                                    clubbedCourseIds.push(combinedIds);
                                    index += 2; // Skip the combined items
                                } else {
                                    // Add remaining names one by one
                                    clubbedCourses.push(courses[index]);
                                    clubbedCourseIds.push(`${coursesData[index].id}`);
                                    index++;
                                }
                            }
                        
                            courses = clubbedCourses;
                            coursesData.length = 0; // Clear the array and rebuild it for the clubbed items
                            for (let i = 0; i < clubbedCourses.length; i++) {
                                coursesData.push({
                                    id: clubbedCourseIds[i],
                                    name: clubbedCourses[i]
                                });
                            }
                        }
                        const subjectOfPractice = await axios({
                            method: "POST",
                            url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                            data: {
                                "messaging_product": "whatsapp",
                                "recipient_type": "individual",
                                "to": from,
                                "type": "interactive",
                                "interactive":{
                                    "type": "list",
                                    "body": {
                                        "text": "Now choose the topic you want to practice 🎯"
                                    },
                                    "action": {
                                        "button": "Select a Topic",
                                        "sections":[
                                        {
                                            "title":"Topic",
                                            "rows": coursesData.map(course => ({
                                                id: course.id, // Use combined or single ID
                                                title: course.name
                                                    .split(" ")
                                                    .map(word => word[0].toUpperCase())
                                                    .join('')
                                                    .replace("&", " & "),
                                                description: course.name,
                                            }))
                                        }
                                        ]
                                    }
                                }   
                            },
                            headers: {
                                Authorization: `Bearer ${PERMANENT_TOKEN}`,
                                "Content-Type": "application/json",
                            },
                        });
                        userState.subjectOfPracticeQSent = true;
                        userState.subjectOfPracticeMsgId = subjectOfPractice.data.messages[0].id;
                        userState.isPracticing = true;
                        await updateUserState(from, userState);   
                    }  
                    console.log("current_msg:", current_msg);
                    if(current_msg.context && current_msg.context.id == userState.subjectOfPracticeMsgId){
                        console.log("inside spm");
                        if(current_msg.type == "interactive"){
                            userState.courseId = current_msg.interactive.list_reply.id.split(",").map((x)=>x.trim());
                            userState.courseNames = current_msg.interactive.list_reply.description.split("&").map((x)=>x.trim());

                            console.log("userState.courseId: ", userState.courseId);
                            const { data: practice_questions, error } = await db.from('questions').select('*').in('course', userState.courseNames).eq('whatsapp_enabled', true);

                            // Randomly select "questionsCount" questions
                            const shuffledQuestions = practice_questions.sort(() => Math.random() - 0.5);
                            const selectedQuestionIds = shuffledQuestions.slice(0, questionsCount).map((q) => q.id);
                            console.log("SELECTED QIDS:", selectedQuestionIds);
                            userState.questionIds = selectedQuestionIds;
                            userState.currentQuestionIndex = 0;
                            userState.correctAnswers = 0;
                            userState.isPracticing = true;
                            userState.answers = Array.from({ length: questionsCount }, () => 'na');
                            await sendMessage(from, `*Welcome to the practice session!🎯*\n\nYou will receive ${questionsCount} questions. These questions can be *Single Correct*, *Multiple Correct* or *Numerical* type. Instructions to answer will be mentioned for each question.`, phon_no_id);
                    
                            // Send the first question
                            await sendQuestion(from, userState, phon_no_id);
                            const now = new Date();
                            const parts = formatter.formatToParts(now);
                            const formattedDate = `${parts[4].value}-${parts[0].value}-${parts[2].value} ${parts[6].value}:${parts[8].value}:${parts[10].value}`;
                                    
                            userState.practiceSessionStartedAt = formattedDate;
                        }
                    }else{
                        if (userState.isPracticing) {
                            
                            // Check if more questions are remaining
                            if (userState.currentQuestionIndex < questionsCount && current_msg.context && current_msg.context.id == userState.nextQuestionMessageId) {
                                if(current_msg.button && current_msg.button.payload == "end_practice"){
                                     // End the practice session
                                     await sendMessage(from, `*Practice session ended ❕*\n\nYou got *${userState.correctAnswers}* out of *${questionsCount}* questions correct.`, phon_no_id);
                                    
                                     const now = new Date();
                                     // Format the date
                                     const parts = formatter.formatToParts(now);
                                     const formattedDate = `${parts[4].value}-${parts[0].value}-${parts[2].value} ${parts[6].value}:${parts[8].value}:${parts[10].value}`;
                                     
                                     userState.practiceSessionEndedAt = formattedDate;
                                     if (!Array.isArray(userState.allPracticeSets)) {
                                         userState.allPracticeSets = [];
                                     }
                                     const allPracticeSets = [ 
                                         {
                                             takenOn: {
                                                 start: userState.practiceSessionStartedAt,
                                                 end: userState.practiceSessionEndedAt,
                                             },
                                             questionIds: userState.questionIds,
                                             answers: userState.answers,
                                             courseId: userState.courseId,
                                             courseNames: userState.courseNames,
                                             currentQuestionIndex: userState.currentQuestionIndex,
                                         }
                                     ]
                                     userState.allPracticeSets = [...userState.allPracticeSets, ...allPracticeSets];
                                     
                                     userState.isPracticing = false;
                                     userState.subjectOfPracticeQSent = false;
                                     userState.subjectOfPracticeMsgId = "";
                                     userState.currentQuestionIndex = 0;
                                     userState.nextQuestionMessageId = "";
                                     // userState.courseId = []
                                     // userState.courseNames = []
                                     // questionIds
                                     // currentQuestionIndex
                                     // answers
                                     await updateUserState(from, userState);
                                }else{
                                    await sendQuestion(from, userState, phon_no_id);
                                }
                            } else {
                                
                                if(userState.currentQuestionIndex >= questionsCount){
                                    // End the practice session
                                    await sendMessage(from, `*Practice session completed ✅*\n\nYou got *${userState.correctAnswers}* out of *${questionsCount}* questions correct.`, phon_no_id);
                                    
                                    const now = new Date();
                                    // Format the date
                                    const parts = formatter.formatToParts(now);
                                    const formattedDate = `${parts[4].value}-${parts[0].value}-${parts[2].value} ${parts[6].value}:${parts[8].value}:${parts[10].value}`;
                                    
                                    userState.practiceSessionEndedAt = formattedDate;
                                    if (!Array.isArray(userState.allPracticeSets)) {
                                        userState.allPracticeSets = [];
                                    }
                                    const allPracticeSets = [ 
                                        {
                                            takenOn: {
                                                start: userState.practiceSessionStartedAt,
                                                end: userState.practiceSessionEndedAt,
                                            },
                                            questionIds: userState.questionIds,
                                            answers: userState.answers,
                                            courseId: userState.courseId,
                                            courseNames: userState.courseNames,
                                            currentQuestionIndex: userState.currentQuestionIndex,
                                        }
                                    ]
                                    userState.allPracticeSets = [...userState.allPracticeSets, ...allPracticeSets];
                                    
                                    userState.isPracticing = false;
                                    userState.subjectOfPracticeQSent = false;
                                    userState.subjectOfPracticeMsgId = "";
                                    userState.currentQuestionIndex = 0;
                                    userState.nextQuestionMessageId = "";
                                    // userState.courseId = []
                                    // userState.courseNames = []
                                    // questionIds
                                    // currentQuestionIndex
                                    // answers
                                    await updateUserState(from, userState);
                                }else{
                                    const userAnswer = msg_body.trim().toUpperCase();
                                    
                                    if(userAnswer != "" && !current_msg.context && userAnswer != "/practice" && current_msg.text.body != "/practice"){
                                        // Fetch the current question from the database
                                        const { data: questionData, error: questionError } = await db
                                            .from("questions")
                                            .select("value")
                                            .eq("id", userState.questionIds[userState.currentQuestionIndex]);
                        
                                        if (questionError || questionData.length === 0) {
                                            // await sendMessage(from, "*Error fetching question. Please try again later.*", phon_no_id);
                                            return res.sendStatus(500);
                                        }
                        
                        
                                        const question = questionData[0].value;
                                        if(question.type == "multiple_choice"){
                                            const correctOptions = question.options.filter(option => option.isCorrect).map(option => option.label)
                                            const userAnswerLabels = userAnswer.toUpperCase().replace(/\s+/g, "").split("");
                                            const isCorrect = correctOptions.every(label => userAnswerLabels.includes(label)) && userAnswerLabels.every(label => correctOptions.includes(label));
                                            // Provide feedback
                                            if (isCorrect) {
                                                userState.answers[userState.currentQuestionIndex] = 'correct';
                                                userState.correctAnswers++;
                                                await sendAnswerFBMessage(from, ``, phon_no_id, userState, "correct_answer_fb_msg");
                                            } else {
                                                userState.answers[userState.currentQuestionIndex] = 'wrong';
                                                const correctLabels = question.options.filter(opt => opt.isCorrect).map(opt => opt.label).join(", ");
                                                await sendAnswerFBMessage(from, `is/are *option(s) ${correctLabels}*`, phon_no_id, userState, "incorrect_answer_fb_msg");
                                            }
                                            userState.currentQuestionIndex++;
                                        }else if (question.type == "numerical"){
                                            let isCorrect = false;
                                            const correctRange = question.answerRange;
                                            const lowerBound = parseFloat(correctRange.lowerBound);
                                            const upperBound = parseFloat(correctRange.upperBound);
                                            const userResponseNumeric = parseFloat(msg_body);
                                    
                                            // Check if the user's response falls within the correct range
                                            if (userResponseNumeric >= lowerBound && userResponseNumeric <= upperBound) {
                                                isCorrect = true;
                                            }
                                            // Provide feedback
                                            if (isCorrect) {
                                                userState.answers[userState.currentQuestionIndex] = 'correct';
                                                userState.correctAnswers++;
                                                await sendAnswerFBMessage(from, ``, phon_no_id, userState, "correct_answer_fb_msg");
                                            } else {
                                                userState.answers[userState.currentQuestionIndex] = 'wrong';
                                                await sendAnswerFBMessage(from, `${lowerBound==upperBound ? `is *${upperBound}` : `range is ${lowerBound} to ${upperBound}`}`, phon_no_id, userState, "incorrect_answer_fb_msg");
                                            }
                                            userState.currentQuestionIndex++;
                                        }
                                    }
                                }
                            }
            
                            // Update user state in the database
                            await updateUserState(from, userState);
                            return res.sendStatus(200);
                        }
                    }
                    // await updateUserState(from, userState);
                    // if(current_msg.context && current_msg.context.id == userState.topicOfPracticeMsgId){
                    //     if(current_msg.type == "interactive"){
                    //         userState.topicId = current_msg.interactive.list_reply.id.split(",").map((x)=>x.trim());
                    //         userState.topicNames = current_msg.interactive.list_reply.description.split("&").map((x)=>x.trim());
                    //         const { data: practice_questions, error } = await db.from('questions').select('*').in('topic', userState.topicNames).eq('whatsapp_enabled', true);

                    //         // Randomly select "questionsCount" questions
                    //         const shuffledQuestions = practice_questions.sort(() => Math.random() - 0.5);
                    //         const selectedQuestionIds = shuffledQuestions.slice(0, questionsCount).map((q) => q.id);
                    //         console.log("SELECTED QIDS:", selectedQuestionIds);
                    //         userState.questionIds = selectedQuestionIds;
                    //         userState.currentQuestionIndex = 0;
                    //         userState.correctAnswers = 0;
                    //         userState.isPracticing = true;
                    //         userState.answers = Array.from({ length: questionsCount }, () => 'na');
                    //         await sendMessage(from, `*Welcome to the practice session!🎯*\n\nYou will receive ${questionsCount} questions. These questions can be *Single Correct*, *Multiple Correct* or *Numerical* type. Instructions to answer will be mentioned for each question.`, phon_no_id);
                    
                    //         // Send the first question
                    //         await sendQuestion(from, userState, phon_no_id);
                    //     }
                    // }
                    // }else{
                    //     await sendMessage(from, "Please follow the above instructions to proceed 👆", phon_no_id);
                    // }
                                // If user is in practice mode and responds to a question
                    
                }
                await updateUserState(from, userState);
                
                return res.sendStatus(200);
            }else if ((msg_body == "/challenge" || userState.isOptingForDC || (current_msg.button && current_msg.button.payload == "/start_challenge" && userState.optedForDC)) && !userState.isPracticing){
                console.log("inside challenge block");
                if(!userState.isOptedForDCMsgSent || (msg_body == "/challenge" && !userState.optedForDC)){
                    const daily_challenge_time = await axios({
                        method: "POST",
                        url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                        data: {
                            "messaging_product": "whatsapp",
                            "to": `${from}`,
                            "type": "template",
                            "template":{
                                "name": "daily_challenge",
                                "language": {
                                  "code": "en"
                                },
                                "components": [
                                  {
                                    "type": "body",
                                    "parameters": [
                                      {
                                        "type": "text",
                                        "parameter_name": "branch",
                                        "text": `${userState.branch}`,
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
                                        "payload": "JC"
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
                                        "payload": "WDL"
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
                    userState.isOptedForDCMsgSent = true;
                    userState.isOptingForDC = true;
                    userState.isOptingForDCMsgId = daily_challenge_time.data.messages[0].id;
                    await updateUserState(from, userState);
                }else{
                    if(current_msg.context && current_msg.context.id == userState.isOptingForDCMsgId){
                        if(current_msg.type == "button"){
                            const wantsToJoin = current_msg.button.text;
                            console.log("wantsToJoin:", wantsToJoin);
                            if(wantsToJoin == "Join Challenge"){
                                userState.optedForDC = true;
                                // const selectTime = await axios({
                                //     method: "POST",
                                //     url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                                //     data: {
                                //         "messaging_product": "whatsapp",
                                //         "to": `${from}`,
                                //         "type": "template",
                                //         "template": {
                                //             "name": "challenge_select_time",
                                //             "language": {
                                //               "code": "en"
                                //             },
                                //             "components": [
                                //               {
                                //                 "type": "button",
                                //                 "sub_type": "quick_reply",
                                //                 "index": "0",
                                //                 "parameters": [
                                //                   {
                                //                     "type": "payload",
                                //                     "payload": "09:00:00"
                                //                   }
                                //                 ]
                                //               },
                                //               {
                                //                 "type": "button",
                                //                 "sub_type": "quick_reply",
                                //                 "index": "1",
                                //                 "parameters": [
                                //                   {
                                //                     "type": "payload",
                                //                     "payload": "13:00:00"
                                //                   }
                                //                 ]
                                //               },
                                //               {
                                //                 "type": "button",
                                //                 "sub_type": "quick_reply",
                                //                 "index": "2",
                                //                 "parameters": [
                                //                   {
                                //                     "type": "payload",
                                //                     "payload": "18:00:00"
                                //                   }
                                //                 ]
                                //               }
                                //             ]
                                //         }                                          
                                //     },
                                //     headers: {
                                //         "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                                //         "Content-Type": "application/json",
                                //     },
                                // });
                                userState.preferredTimeForDC = "18:00:00";
                                await updateUserState(from, userState);
                                
                                await axios({
                                        method: "POST",
                                        url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                                        data: {
                                            "messaging_product": "whatsapp",
                                            "to": `${from}`,
                                            "type": "template",
                                            "template": {
                                                "name": "challenge_reminder_confirmation",
                                                "language": {
                                                  "code": "en"
                                                },
                                                "components": [
                                                  {
                                                    "type": "body",
                                                    "parameters": [
                                                      {
                                                        "type": "text",
                                                        "parameter_name": "selected_time",
                                                        "text": `6PM`
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
                                userState.isSelectTimeMsgSent = true;
                                userState.isOptingForDC = true;
                                // userState.isSelectTimeMsgId = selectTime.data.messages[0].id;
                                await updateUserState(from, userState);
                            }else{
                                userState.optedForDC = false;
                                userState.isOptingForDC = true;
                                await sendMessage(from, "You have opted out of the Daily Challenge. You can opt in anytime by typing /challenge", phon_no_id);
                            }
                            await updateUserState(from, userState);
                        }
                    }
                    // if(current_msg.context && current_msg.context.id == userState.isSelectTimeMsgId){
                    //     if(current_msg.type == "button"){
                    //         const preferredTime = current_msg.button.payload;
                    //         const preferredTimeText = current_msg.button.text;
                    //         userState.preferredTimeForDC = preferredTime;
                    //         await updateUserState(from, userState);
                            
                    //         await axios({
                    //                 method: "POST",
                    //                 url: `https://graph.facebook.com/v21.0/${phon_no_id}/messages`,
                    //                 data: {
                    //                     "messaging_product": "whatsapp",
                    //                     "to": `${from}`,
                    //                     "type": "template",
                    //                     "template": {
                    //                         "name": "challenge_reminder_confirmation",
                    //                         "language": {
                    //                           "code": "en"
                    //                         },
                    //                         "components": [
                    //                           {
                    //                             "type": "body",
                    //                             "parameters": [
                    //                               {
                    //                                 "type": "text",
                    //                                 "parameter_name": "selected_time",
                    //                                 "text": `${preferredTimeText}`
                    //                               }
                    //                             ]
                    //                           }
                    //                         ]
                    //                     }                                        
                    //                 },
                    //                 headers: {
                    //                     "Authorization": `Bearer ${PERMANENT_TOKEN}`,
                    //                     "Content-Type": "application/json",
                    //                 },
                    //             });
                    //     }
                    // }
                }
                if(current_msg.context && current_msg.context.id == userState.reminderMsgId){
                    if(current_msg.type == "button"){
                        if(current_msg.button.payload == "/start_challenge"){
                            const { data: allUserData, error: userError } = await db.from("whatsapp_user_activity").select('*');
                            // let dailyChallengeUsers = allUserData.filter(user => user.value.optedForDC === true);
                            const currentUser = allUserData.find(user => user.value.reminderMsgId === current_msg.context.id);
                            if (!currentUser) {
                                console.error("User not found for the given reminderMsgId.");
                                return;
                            }
                            
                            let localBranch = "CSE";
                            switch (currentUser.value.branch) {
                                case "Mechanical_Engineering":
                                    localBranch = "ME";
                                    break;
                                case "CSE":
                                    localBranch = "CSE";
                                    break;
                                case "Civil":
                                    localBranch = "CE";
                                    break;
                                case "Electrical":
                                    localBranch = "EE";
                                    break;
                                case "Electronics":
                                    localBranch = "ECE";
                                    break;
                                case "Mechanical":
                                    localBranch = "ME";
                                    break;
                            }
                            const { data: practice_questions, error: practice_questionsError } = await db.from('questions').select('*').eq('branch', localBranch).eq('whatsapp_enabled', true);
                            if (!practice_questions || practice_questions.length === 0) {
                                console.log(`No questions found for branch ${qb}`);
                                
                            }else{
                                // Select 5 random questions
                                const shuffledQuestions = practice_questions.sort(() => Math.random() - 0.5);
                                const selectedQuestions = shuffledQuestions.slice(0, 5);
                                userState.dcQuestionIds = selectedQuestions.map((ques) => ques.value.id);
                                console.log("DC SELECTED QIDS:", userState.dcQuestionIds);
                                userState.dcCurrentQuestionIndex = 0;
                                userState.dcCorrectAnswers = 0;
                                userState.isDoingDC = true;
                                userState.dcAnswers = Array.from({ length: questionsCount }, () => 'na');
                                await sendMessage(from, `*Welcome to the Daily Challenge!🎯*\n\nYou will receive ${questionsCount} questions. These questions can be *Single Correct*, *Multiple Correct* or *Numerical* type. Instructions to answer will be mentioned for each question.`, phon_no_id);
                        
                                // Send the first question
                                await sendQuestion(from, userState, phon_no_id);
                                const now = new Date();
                                const parts = formatter.formatToParts(now);
                                const formattedDate = `${parts[4].value}-${parts[0].value}-${parts[2].value} ${parts[6].value}:${parts[8].value}:${parts[10].value}`;
                                        
                                userState.dcSessionStartedAt = formattedDate;
                                await updateUserState(from, userState);
                            }      
                        }
                    }
                }else{
                    if (userState.isDoingDC) {
                        // console.log()
                        if (userState.dcCurrentQuestionIndex < questionsCount && current_msg.context && current_msg.context.id == userState.nextQuestionMessageId) {
                            if(current_msg.button && current_msg.button.payload == "end_dc"){
                               // End the DC session
                               await sendMessage(from, `*Daily Challenge ended.*\n\nYou got *${userState.dcCorrectAnswers}* out of *${questionsCount}* questions correct.`, phon_no_id);
                               userState.isDoingDC = false;
                               const now = new Date();
                               // Format the date
                               const parts = formatter.formatToParts(now);
                               const formattedDate = `${parts[4].value}-${parts[0].value}-${parts[2].value} ${parts[6].value}:${parts[8].value}:${parts[10].value}`;
                               
                               userState.dcSessionEndedAt = formattedDate;
                               if (!Array.isArray(userState.allDCSets)) {
                                   userState.allDCSets = [];
                               }
                               const allDCSets = [ 
                                   {
                                       takenOn: {
                                           start: userState.dcSessionStartedAt,
                                           end: userState.dcSessionEndedAt,
                                       },
                                       questionIds: userState.dcQuestionIds,
                                       answers: userState.dcAnswers,
                                       currentQuestionIndex: userState.dcCurrentQuestionIndex,
                                   }
                               ]
                               userState.allDCSets = [...userState.allDCSets, ...allDCSets];
                              
                               userState.dcCurrentQuestionIndex = 0;
                               userState.nextQuestionMessageId = "";
                               await updateUserState(from, userState); 
                            }else{
                                await sendQuestion(from, userState, phon_no_id);
                            }
                        } else {
                            if(userState.dcCurrentQuestionIndex >= questionsCount){
                                // End the DC session
                                await sendMessage(from, `*Daily Challenge completed ✅*\n\nYou got *${userState.dcCorrectAnswers}* out of *${questionsCount}* questions correct.`, phon_no_id);
                                userState.isDoingDC = false;
                                const now = new Date();
                                // Format the date
                                const parts = formatter.formatToParts(now);
                                const formattedDate = `${parts[4].value}-${parts[0].value}-${parts[2].value} ${parts[6].value}:${parts[8].value}:${parts[10].value}`;
                                
                                userState.dcSessionEndedAt = formattedDate;
                                if (!Array.isArray(userState.allDCSets)) {
                                    userState.allDCSets = [];
                                }
                                const allDCSets = [ 
                                    {
                                        takenOn: {
                                            start: userState.dcSessionStartedAt,
                                            end: userState.dcSessionEndedAt,
                                        },
                                        questionIds: userState.dcQuestionIds,
                                        answers: userState.dcAnswers,
                                        currentQuestionIndex: userState.dcCurrentQuestionIndex,
                                    }
                                ]
                                userState.allDCSets = [...userState.allDCSets, ...allDCSets];
                               
                                userState.dcCurrentQuestionIndex = 0;
                                userState.nextQuestionMessageId = "";
                                await updateUserState(from, userState);
                                // userState.courseId = []
                                // userState.courseNames = []
                                // questionIds
                                // currentQuestionIndex
                                // answers
                            }else{
                                const userAnswer = msg_body.trim().toUpperCase();
                                // console.log("user answer")
                                if(userAnswer != "" && !current_msg.context && userAnswer != "/challenge" && current_msg.text.body != "/practice"){

                                    // Fetch the current question from the database
                                    const { data: questionData, error: questionError } = await db
                                        .from("questions")
                                        .select("value")
                                        .eq("id", userState.dcQuestionIds[userState.dcCurrentQuestionIndex]);
                    
                                    if (questionError || questionData.length === 0) {
                                        // await sendMessage(from, "*Error fetching question. Please try again later.*", phon_no_id);
                                        return res.sendStatus(500);
                                    }
                    
                    
                                    const question = questionData[0].value;
                                    console.log("question type", question.type);
                                    console.log("type outside mc block", typeof(question))
                                    console.log("question type", question['type']);
                                    if(question.type == "multiple_choice"){
                                        console.log("type inside mc block", typeof(question))
                                        const correctOptions = question.options.filter(option => option.isCorrect).map(option => option.label)
                                        const userAnswerLabels = userAnswer.toUpperCase().replace(/\s+/g, "").split("");
                                        const isCorrect = correctOptions.every(label => userAnswerLabels.includes(label)) && userAnswerLabels.every(label => correctOptions.includes(label));
                                        // Provide feedback
                                        if (isCorrect) {
                                            userState.dcAnswers[userState.dcCurrentQuestionIndex] = 'correct';
                                            userState.dcCorrectAnswers++;
                                            await sendAnswerFBMessage(from, ``, phon_no_id, userState, "correct_answer_fb_msg");
                                        } else {
                                            userState.dcAnswers[userState.dcCurrentQuestionIndex] = 'wrong';
                                            const correctLabels = question.options.filter(opt => opt.isCorrect).map(opt => opt.label).join(", ");
                                            await sendAnswerFBMessage(from, `is/are *option(s) ${correctLabels}*`, phon_no_id, userState, "incorrect_answer_fb_msg");
                                        }
                                        // Check if more questions are remaining
                                        userState.dcCurrentQuestionIndex++;
                                    }else if (question.type == "numerical"){
                                        let isCorrect = false;
                                        const correctRange = question.answerRange;
                                        const lowerBound = parseFloat(correctRange.lowerBound);
                                        const upperBound = parseFloat(correctRange.upperBound);
                                        const userResponseNumeric = parseFloat(msg_body);
                                
                                        // Check if the user's response falls within the correct range
                                        if (userResponseNumeric >= lowerBound && userResponseNumeric <= upperBound) {
                                            isCorrect = true;
                                        }
                                        // Provide feedback
                                        if (isCorrect) {
                                            userState.dcAnswers[userState.dcCurrentQuestionIndex] = 'correct';
                                            userState.dcCorrectAnswers++;
                                            await sendAnswerFBMessage(from, ``, phon_no_id, userState, "correct_answer_fb_msg");
                                        } else {
                                            userState.dcAnswers[userState.dcCurrentQuestionIndex] = 'wrong';
                                            await sendAnswerFBMessage(from, `${lowerBound==upperBound ? `is *${upperBound}` : `range is ${lowerBound} to ${upperBound}`}`, phon_no_id, userState, "incorrect_answer_fb_msg");
                                        }
                                        // Check if more questions are remaining
                                        userState.dcCurrentQuestionIndex++;
                                    }else{
                                        console.log("invalid question type");
                                    }
                                    await updateUserState(from, userState);
                                }
                            }
                        }
        
                        // Update user state in the database
                        await updateUserState(from, userState);
                        return res.sendStatus(200);
                    }
                }
            } 
            if(msg_body == "/feedback" || userState.isGivingFeedback){
                console.log("in feedback condn");
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

            }

            res.sendStatus(200);
        } else if (
            body_param.entry &&
            body_param.entry[0].changes &&
            body_param.entry[0].changes[0].value.statuses
        ) {
            console.log("Status update received:", body_param.entry[0].changes[0].value.statuses.status);
            res.sendStatus(200); // Acknowledge the status update
        } else {
            console.error("Unhandled webhook payload structure.");
            res.sendStatus(404);
        }
    }
}

module.exports = {
    handleCallback,
    handlePost,
};


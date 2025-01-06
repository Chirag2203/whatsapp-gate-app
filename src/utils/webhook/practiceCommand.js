const getDB = require('../../db');
const axios = require('axios');
const { updateUserState } = require('../webhook/updateUserState')
const { sendMessage } = require('../webhook/sendMessage')
const { sendQuestion } = require('../webhook/sendQuestion')
const { sendAnswerFBMessage } = require('../webhook/sendAnswerFBMessage')
const PERMANENT_TOKEN = process.env.PERMANENT_TOKEN;

const questionsCount = 5; // Total number of questions

const db = getDB();
const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});

async function initiatePracticeSession(msg_body, userState, phon_no_id, from, current_msg, ){
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
                                return;
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
                return;
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
    
    return;
}

module.exports = {
    initiatePracticeSession,
}
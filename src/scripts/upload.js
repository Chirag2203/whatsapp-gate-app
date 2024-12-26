const axios = require("axios");
const getDB = require("../db");
// problem course - 51, 56, 57
(async () => {
    try {
        // Initialize the Supabase client
        const db = await getDB();
        let topicsDone = 0;
        // Retrieve all topics from the "courses" table
        const { data: topics, error: coursesError } = await db.from("topics").select("*");
        console.log(topics)
        if (coursesError) {
            throw new Error(`Error fetching courses: ${coursesError.message}`);
        }

        if (!topics || topics.length === 0) {
            console.log("No topics found in the database.");
            return;
        }

        console.log(`Found ${topics.length} topics. Starting image generation process...`);

        // Iterate over each course to process its topic
        for (const topic of topics) {
            const t = topic.value?.name;

            if (!t) {
                console.warn("Skipping course with missing topic name:", topic);
                continue;
            }

            console.log(`Processing topic: ${t}`);

            const { data: oldQuestions, error: countError } = await db
                .from("questions")
                .select("*")
                .eq("topic", t)
                .eq("whatsapp_enabled", true);

            if (countError) {
                console.error(`Error counting questions for topic "${t}": ${countError.message}`);
                continue;
            }

            // if (count >= 5) {
            //     topicsDone += 1;
            //     console.log(`Topic "${t}" already has ${count} questions marked as "whatsapp_enabled". Skipping...`);
            //     continue;
            // }
            // console.log(`Topic "${t}" has only ${count} enabled questions. Processing the remaining ${5 - count}...`);

            // Fetch up to the remaining number of questions to enable
            // const remainingCount = 5 - count;
            // const { data: questions, error: questionsError } = await db
            //     .from("questions")
            //     .select("id")
            //     .eq("topic", t)
            //     .limit(remainingCount);

            // if (questionsError) {
            //     console.error(`Error fetching questions for topic "${t}": ${questionsError.message}`);
            //     continue;
            // }

            if (!oldQuestions || oldQuestions.length === 0) {
                console.log(`No questions found for topic "${t}".`);
                continue;
            }

            console.log(`Found ${oldQuestions.length} questions for topic "${t}". Starting upload process...`);
            for(const question of oldQuestions){
                console.log("ID:", question.id);
            }
            // Iterate over each question and send a request to the endpoint
            for (const question of oldQuestions) {
                const questionId = question.id;
                try {
                    console.log(`Processing question ID: ${questionId} for topic: ${t}`);

                    const response = await axios.get(`http://localhost:3000/image/${questionId}`);

                    if (response.status === 200) {
                        const { error: updateError } = await db.from("questions").update({ whatsapp_enabled: true }).eq("id", questionId);
                        console.log(`Successfully processed question ID: ${questionId} for topic: ${topic}. Image URL:`, response.data.questionImageUrl, `Explanation URL:`, response.data.explanationImageUrl);
                    } else {
                        console.log(`Failed to process question ID: ${questionId} for topic: ${topic}. Response:`, response.data);
                    }

                } catch (error) {
                    console.error(`Error processing question ID: ${questionId} for topic: ${topic}`, error.message);
                }
            }
            topicsDone += 1;
            console.log("topics done:", topicsDone, "out of: ", topics.length);
        }

        console.log("Image generation process completed.");

    } catch (error) {
        console.error("Error initializing script:", error.message);
    }
})();

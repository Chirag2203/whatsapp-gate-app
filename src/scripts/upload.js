const axios = require("axios");
const getDB = require("../db"); // Assuming this initializes Supabase client

(async () => {
    try {
        // Initialize the Supabase client
        const db = await getDB();

        // Retrieve all topics from the "courses" table
        const { data: courses, error: coursesError } = await db.from("courses").select("value");

        if (coursesError) {
            throw new Error(`Error fetching courses: ${coursesError.message}`);
        }

        if (!courses || courses.length === 0) {
            console.log("No courses found in the database.");
            return;
        }

        console.log(`Found ${courses.length} topics. Starting image generation process...`);

        // Iterate over each course to process its topic
        for (const course of courses) {
            const topic = course.value?.name;

            if (!topic) {
                console.warn("Skipping course with missing topic name:", course);
                continue;
            }

            console.log(`Processing topic: ${topic}`);

            // Fetch up to 100 question IDs for the current topic
            const { data: questions, error: questionsError } = await db
                .from("questions")
                .select("id")
                .eq("course", topic) // Assuming "topic" column links questions to topics
                .limit(100);

            if (questionsError) {
                console.error(`Error fetching questions for topic "${topic}": ${questionsError.message}`);
                continue;
            }

            if (!questions || questions.length === 0) {
                console.log(`No questions found for topic "${topic}".`);
                continue;
            }

            console.log(`Found ${questions.length} questions for topic "${topic}". Starting upload process...`);

            // Iterate over each question and send a request to the endpoint
            for (const question of questions) {
                const questionId = question.id;

                try {
                    console.log(`Processing question ID: ${questionId} for topic: ${topic}`);

                    const response = await axios.get(`http://localhost:3000/image/${questionId}`);

                    if (response.status === 200) {
                        console.log(`Successfully processed question ID: ${questionId} for topic: ${topic}. Image URL:`, response.data.imageUrl);
                    } else {
                        console.log(`Failed to process question ID: ${questionId} for topic: ${topic}. Response:`, response.data);
                    }

                } catch (error) {
                    console.error(`Error processing question ID: ${questionId} for topic: ${topic}`, error.message);
                }
            }
        }

        console.log("Image generation process completed.");

    } catch (error) {
        console.error("Error initializing script:", error.message);
    }
})();

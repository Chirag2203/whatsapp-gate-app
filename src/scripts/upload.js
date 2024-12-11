const axios = require("axios");
const getDB = require("../db"); // Assuming this initializes Supabase client

(async () => {
    try {
        // Initialize the Supabase client
        const db = await getDB();

        // Retrieve all question IDs from the "questions" table
        const { data: questions, error } = await db.from("questions").select("id");

        if (error) {
            throw new Error(`Error fetching questions: ${error.message}`);
        }

        if (!questions || questions.length === 0) {
            console.log("No questions found in the database.");
            return;
        }

        console.log(`Found ${questions.length} questions. Starting upload process...`);

        // Iterate over each question and send a request to the endpoint
        for (const question of questions) {
            const questionId = question.id;

            try {
                console.log(`Processing question ID: ${questionId}`);

                const response = await axios.get(`http://localhost:3000/image/${questionId}`);

                if (response.status === 200) {
                    console.log(`Successfully processed question ID: ${questionId}. Image URL:`, response.data.imageUrl);
                } else {
                    console.log(`Failed to process question ID: ${questionId}. Response:`, response.data);
                }

            } catch (error) {
                console.error(`Error processing question ID: ${questionId}`, error.message);
            }
        }

        console.log("Upload process completed.");

    } catch (error) {
        console.error("Error initializing script:", error.message);
    }
})();

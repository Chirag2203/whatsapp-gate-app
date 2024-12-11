const getDB = require('../db');

var protobuf = require("protobufjs");
var proto = protobuf.Root.fromJSON(require("../proto/bundle.json"));

var Question = proto.lookup("question.Question");

// var ListQuestionsRequest = proto.lookup("question_service.ListQuestionsRequest");
var ListQuestionsResponse = proto.lookup("question_service.ListQuestionsResponse");

async function listQuestions(req, res) {
    try {
        // const listQuestionsRequest = ListQuestionsRequest.create(req.body);

        const db = await getDB();
        const { data, error } = await db.from('questions').select('*').limit(7);
        if (error) {
            throw error;
        }

        let questions = [];
        for (const row of data) {
            let question = Question.create(row['value']);

            // Copy supabase ID over data-generation-pipeline's ID.
            question.id = row['id'];

            for (let i = 0; i < question.images.length; i++) {
                question.images[i] = process.env.SUPABASE_URL + "/storage/v1/object/public/public_assets/" + question.images[i];
            }

        
            for (let i = 0; i < question.options.length; i++) {
                for (let j = 0; j < question.options[i].images.length; j++) {
                    question.options[i].images[j] =  process.env.SUPABASE_URL + "/storage/v1/object/public/public_assets/" + question.options[i].images[j];
                }
            }
        
            questions.push(question);
        }

        let response = ListQuestionsResponse.create({questions: questions});        
        res.status(200).json(ListQuestionsResponse.toObject(response));
    } catch (error) {
        res.status(500).json({error: error.message });
    }
}

module.exports = {
    listQuestions
};
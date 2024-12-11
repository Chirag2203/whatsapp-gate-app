const express = require('express');

const router = express.Router();

const questionController = require("../src/controllers/questionController");

router.get("/list", questionController.listQuestions);

module.exports = router;
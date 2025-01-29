const express = require('express');

const router = express.Router();

const imageController = require("../src/controllers/imageController");

router.get("/list", imageController.listQuestions);
router.get("/:id", imageController.getImageById);
router.post("/:slug", imageController.getImageForAskAI);

module.exports = router;
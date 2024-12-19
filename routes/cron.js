const express = require('express');

const router = express.Router();

const cronController = require("../src/controllers/cronController");

router.get("/dailyChallenge", cronController.handleDailyChallenge);

module.exports = router;
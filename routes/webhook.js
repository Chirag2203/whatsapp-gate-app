const express = require('express');
const router = express.Router();

const webhookController = require("../src/controllers/webhookController");

router.post("/webhook", webhookController.handlePost);



module.exports = router;
const express = require('express');
const router = express.Router();

const webhookController = require("../src/controllers/webhookController");

router.get("/callback", webhookController.handleCallback);
router.post("/callback", webhookController.handlePost);


module.exports = router;
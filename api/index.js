const express = require("express");
const app = express();


const webhookRoutes = require("../routes/webhook");
const imageRoutes = require("../routes/image");
const questionRoutes = require("../routes/question");
const cronRoutes = require("../routes/cron");


require('dotenv').config();

var cors = require('cors');
app.use(cors({
    origins: ['http://localhost', 'https://app.kalppo.com', 'http://kalppowhatsapp.kalppo.com', 'https://kalppowhatsapp.kalppo.com', '*', 'https://*']
}));

app.use(express.json()) // for parsing application/json

app.get("/", (req, res) => res.send("Hello Kalppo!"));

app.use("/webhook", webhookRoutes);
app.use("/image",imageRoutes);
app.use("/questions", questionRoutes);
app.use("/cron", cronRoutes);

app.listen(3000, () => console.log("Server ready on port 3000"));

module.exports = app;
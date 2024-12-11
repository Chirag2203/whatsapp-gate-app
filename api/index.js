const express = require("express");
const app = express();


const webhookRoutes = require("../routes/webhook");
const imageRoutes = require("../routes/image");
const questionRoutes = require("../routes/question");


require('dotenv').config();

var cors = require('cors');
app.use(cors({
    origins: ['http://localhost', 'https://app.kalppo.com', 'https://whatsapp.kalppo.com']
}));

app.use(express.json()) // for parsing application/json

app.get("/", (req, res) => res.send("Hello Kalppo!"));

app.use("/webhook", webhookRoutes);
app.use("/image",imageRoutes);
app.use("/questions", questionRoutes);

app.listen(3000, () => console.log("Server ready on port 3000"));

module.exports = app;
const puppeteer = require("puppeteer");
const katex = require("katex");
const path = require('path');
const getDB = require("../db"); // Assuming this initializes Supabase client


async function listQuestions(req, res) {
    // Implement if needed, such as fetching a list of available images
    res.status(200).json({ message: "Endpoint under construction" });
}

async function getImageById(req, res) {
    try {
        const db = await getDB();
        const questionId = req.params.id;

        // Query Supabase for the question
        const { data, error } = await db.from("questions").select("*").eq("id", questionId).single();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({ error: "Question not found" });
        }

        const questionText = data.value.question; // Assuming `text` contains the question with LaTeX
        const options = data.value.options; // The options for the question

        const latexMatches = [...questionText.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
        let processedText = questionText;

        latexMatches.forEach(match => {
            const latexContent = match[1];
            const latexHtml = katex.renderToString(latexContent, {
                throwOnError: false,
                displayMode: true,
            });
            processedText = processedText.replace(match[0], latexHtml);
        });

        const processedOptions = options.map(option => {
            const latexMatches = [...option.text.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
            let processedOptionText = option.text;

            latexMatches.forEach(match => {
                const latexContent = match[1];
                const latexHtml = katex.renderToString(latexContent, {
                    throwOnError: false,
                    displayMode: false,
                });
                processedOptionText = processedOptionText.replace(match[0], latexHtml);
            });

            return {
                ...option,
                processedText: processedOptionText,
            };
        });

        const htmlContent = `
        <html>
        <head>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.15/dist/katex.min.css">
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    background-color: #f9f9f9;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    max-width: 600px;
                    margin: auto;
                    padding: 20px;
                    background-color: #ffffff;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .question {
                    margin-bottom: 20px;
                    font-size: 18px;
                }
                .options {
                    list-style-type: none;
                    padding: 0;
                }
                .option {
                    margin-bottom: 10px;
                    padding: 10px;
                    background-color: #f1f8ff;
                    border: 1px solid #cce7ff;
                    border-radius: 4px;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="question">
                    <p>${processedText}</p>
                </div>
                <ul class="options">
                    ${processedOptions.map(option => `
                        <li class="option">
                            <strong>${option.label}:</strong> ${option.processedText}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </body>
        </html>
        `;

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const boundingBox = await page.evaluate(() => {
            const container = document.querySelector('.container');
            const rect = container.getBoundingClientRect();
            return {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
            };
        });

        const imageBuffer = await page.screenshot({
            clip: {
                x: boundingBox.x,
                y: boundingBox.y,
                width: Math.ceil(boundingBox.width),
                height: Math.ceil(boundingBox.height),
            },
        });

        await browser.close();

        const fileName = `whatsapp/question_${questionId}.png`;
        const { data: uploadData, error: uploadError } = await db.storage
            .from("public_assets") 
            .upload(fileName, imageBuffer, {
                contentType: "image/png",
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: publicURL, error: urlError } = db.storage.from("public_assets").getPublicUrl(fileName);
        if (urlError) {
            throw urlError;
        }

        res.status(200).json({ imageUrl: publicURL });
    } catch (error) {
        console.error("Error generating image:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    listQuestions,
    getImageById,
};

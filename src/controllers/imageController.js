const puppeteer = require("puppeteer");
const katex = require("katex");
const path = require('path');
const fs = require("fs");
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

        console.log("QT: ", questionText);
        const latexMatches = [...questionText.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];

        // if (!latexMatches.length) {
        //     return res.status(200).json({ message: "No LaTeX content found in question" });
        // }

        let processedText = questionText;

        latexMatches.forEach(match => {
            const latexContent = match[1];
            const latexHtml = katex.renderToString(latexContent, {
                throwOnError: false,
                displayMode: true,
            });
            // Replace the original [latex]...[/latex] block with the rendered HTML
            processedText = processedText.replace(match[0], latexHtml);
        });
        // Handle LaTeX rendering in options
        const processedOptions = options.map(option => {
            const latexMatches = [...option.text.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
            let processedOptionText = option.text;

            latexMatches.forEach(match => {
                const latexContent = match[1];
                const latexHtml = katex.renderToString(latexContent, {
                    throwOnError: false,
                    displayMode: false, // Inline display for options
                });
                processedOptionText = processedOptionText.replace(match[0], latexHtml);
            });

            return {
                ...option,
                processedText: processedOptionText,
            };
        });
        // Combine the question text and rendered options into HTML
        const htmlContent = `
        <html>
        <head>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.15/dist/katex.min.css">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                .question {
                    margin-bottom: 20px;
                }
                .option {
                    margin-bottom: 10px;
                }
                .option span.label {
                    font-weight: bold;
                    margin-right: 10px;
                }
            </style>
        </head>
        <body>
            <div class="question">
                <p>${processedText}</p>
            </div>
            <div class="options">
                ${processedOptions.map(option => `
                    <div class="option">
                        <span class="label">${option.label}:</span>
                        <span class="text">${option.processedText}</span>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
        `;


        // Generate an image using Puppeteer
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.setContent(htmlContent);

        // Dynamically determine the height of the content
        const boundingBox = await page.evaluate(() => {
            const body = document.body;
            const html = document.documentElement;
            const height = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                html.clientHeight,
                html.scrollHeight,
                html.offsetHeight
            );
            return { width: html.clientWidth, height };
        });

        // Set the viewport to fit the content
        await page.setViewport({
            width: 800, // Or any desired width
            height: boundingBox.height,
        });

        // Take a cropped screenshot of the content
        const imageBuffer = await page.screenshot({
            clip: {
                x: 0,
                y: 0,
                width: boundingBox.width,
                height: boundingBox.height,
            },
        });

        await browser.close();
        // Upload image to Supabase Storage
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
        console.log("uploadData: ", uploadData);

        const { data: publicURL, error: urlError } = db.storage.from("public_assets").getPublicUrl(fileName);
        if (urlError) {
            throw urlError;
        }
        // Save the image to the server (e.g., public/images folder)
        // const imagePath = path.join(__dirname, "../public/images", `${questionId}.png`);
        // fs.writeFileSync(imagePath, imageBuffer);
        console.log("publicURL: ", publicURL);
        // Return the URL of the saved image
        // const imageUrl = `/images/${questionId}.png`;
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


const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer");
const puppeteerCore = require("puppeteer-core");
const katex = require("katex");
const path = require("path");
const getDB = require("../db"); // Assuming this initializes Supabase client

async function listQuestions(req, res) {
  res.status(200).json({ message: "Endpoint under construction" });
}

async function getImageById(req, res) {
  try {
    const db = await getDB();
    const questionId = req.params.id;
    
    // Check if images already exist in Supabase storage
    const questionFileName = `whatsapp/question_${questionId}.png`;
    const expFileName = `whatsapp/explanation_${questionId}.png`;

    const questionFileUrl = db.storage
      .from("public_assets")
      .getPublicUrl(questionFileName).data.publicUrl;

    const explanationFileUrl = db.storage
      .from("public_assets")
      .getPublicUrl(expFileName).data.publicUrl;

    // Perform a HEAD request to check if the files exist
    const checkFileExists = async (url) => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        return response.ok; // Returns true if the file exists
      } catch {
        return false;
      }
    };

    const questionExists = await checkFileExists(questionFileUrl);
    const explanationExists = await checkFileExists(explanationFileUrl);

    // If both images exist, return the URLs directly
    if (questionExists && explanationExists) {
      return res.status(200).json({
        questionImageUrl: questionFileUrl,
        explanationImageUrl: explanationFileUrl,
      });
    }
    // Query Supabase for the question
    const { data, error } = await db
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: "Question not found" });
    }

    const questionText = data.value.question;
    const questionImages = data.value.images || []; // Images for the question
    const qImgUrls = [];
    console.log(questionImages);
    questionImages.forEach((img) => {
        console.log("img", img);
        qImgUrls.push(db.storage.from("public_assets").getPublicUrl("questions/"+img).data.publicUrl)
    });
    console.log(qImgUrls);
    
    console.log(db.storage.from("public_assets").getPublicUrl("questions/CSE/images/General Aptitude- CSE162-question.jpeg").data.publicUrl)
    const options = data.value.options;

    // Process LaTeX in the question
    const latexMatches = [...questionText.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
    let processedText = questionText;

    latexMatches.forEach((match) => {
      const latexContent = match[1];
      const latexHtml = katex.renderToString(latexContent, {
        throwOnError: false,
        displayMode: true,
      });
      processedText = processedText.replace(match[0], latexHtml);
    });

    // Process LaTeX in options
    const processedOptions = options.map((option) => {
      const latexMatches = [...option.text.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
      let processedOptionText = option.text;

      latexMatches.forEach((match) => {
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
        images: option.images || [],
      };
    });

    // Construct the HTML with question and images
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
                max-width: 800px;
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
            .images {
                margin-bottom: 20px;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            .images img {
                max-width: 100%;
                height: auto;
                border: 1px solid #ddd;
                border-radius: 4px;
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
            ${
              qImgUrls.length > 0
                ? `<div class="images">
                    ${qImgUrls
                      .map(
                        (img, i) =>
                          `<img key="${i}" src="${img}" width="100%" height="100%" alt="Question Image">`
                      )
                      .join("")}
                   </div>`
                : ""
            }
            <ul class="options">
                ${processedOptions
                  .map(
                    (option) => `
                        <li class="option">
                            <strong>${option.label}:</strong> ${option.processedText}
                            ${
                              option.images.length > 0
                                ? `<div class="images">
                                    ${option.images
                                      .map(
                                        (img) =>
                                          `<img src="${db.storage
                                            .from("public_assets")
                                            .getPublicUrl(img).data.publicUrl}" alt="Option Image">`
                                      )
                                      .join("")}
                                   </div>`
                                : ""
                            }
                        </li>`
                  )
                  .join("")}
            </ul>
        </div>
    </body>
    </html>
    `;
    const explanationText = data.value.explanation || "No explanation provided.";
    const explanationLatexMatches = [...explanationText.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
    let processedExplanationText = explanationText;

    explanationLatexMatches.forEach((match) => {
      const latexContent = match[1];
      const latexHtml = katex.renderToString(latexContent, {
        throwOnError: false,
        displayMode: true,
      });
      processedExplanationText = processedExplanationText.replace(match[0], latexHtml);
    });
    const explanationHTML = `
    <html>
    <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.15/dist/katex.min.css">
        <style>
            body { width: 100%; height: 100%; font-family: 'Arial'; background-color: #f9f9f9; padding: 20px; color: #333; }
            .container { width: fit-content; height: fit-content; margin: auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
            .explanation { font-size: 18px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="explanation">
                <p>${processedExplanationText}</p>
            </div>
        </div>
    </body>
    </html>
    `;
    // Generate the image
    let browser = null;

    if (process.env.NODE_ENV === 'development') {
      console.log('Development browser: ');
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
    }
    if (process.env.NODE_ENV === 'production') {
      console.log('Development production: ');
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    }
    let page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const boundingBox = await page.evaluate(() => {
      const container = document.querySelector(".container");
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
    // Generate and upload explanation image
    await page.setContent(explanationHTML, { waitUntil: "networkidle0" });
    const explanationBoundingBox = await page.evaluate(() => {
        const container = document.querySelector(".container");
        const rect = container.getBoundingClientRect();
        return {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        };
      });
     
    const explanationBuffer = await page.screenshot({
        clip: {
          x: explanationBoundingBox.x,
          y: explanationBoundingBox.y,
          width: Math.ceil(explanationBoundingBox.width),
          height: Math.ceil(explanationBoundingBox.height),
        },
      });

    await browser.close();
    // Upload the image to Supabase storage
    const fileName = `whatsapp/question_${questionId}.png`;
    const { data: uploadData, error: uploadError } = await db.storage
      .from("public_assets")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    
      const explanationFileName = `whatsapp/explanation_${questionId}.png`;
      await db.storage
        .from("public_assets")
        .upload(explanationFileName, explanationBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      const explanationImageUrl = db.storage
        .from("public_assets")
        .getPublicUrl(explanationFileName).data.publicUrl;
    if (uploadError) {
      throw uploadError;
    }

    const questionImageUrl = db.storage
      .from("public_assets")
      .getPublicUrl(fileName).data.publicUrl;

  
    res.status(200).json({ questionImageUrl, explanationImageUrl });
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listQuestions,
  getImageById,
};

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
    // if (questionExists && explanationExists) {
    //   return res.status(200).json({
    //     questionImageUrl: questionFileUrl,
    //     explanationImageUrl: explanationFileUrl,
    //   });
    // }
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
    console.log("Question's images: ",questionImages);
    questionImages.forEach((img) => {
        console.log("img", img);
        qImgUrls.push(db.storage.from("public_assets").getPublicUrl("questions/"+img).data.publicUrl)
    });
    console.log("URLS: ",qImgUrls);
    
    const options = data.value.options;
    const questionCode = data.value.code || null; // Code for the question

    // Process LaTeX in the question
    const latexMatches = [...questionText.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
    let processedText = questionText;

    latexMatches.forEach((match) => {
      const latexContent = match[1];
      const latexHtml = katex.renderToString(latexContent, {
        throwOnError: false,
        displayMode: false,
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
            .code {
                margin-bottom: 20px;
                background-color: #f4f4f4;
                border-left: 4px solid #007ACC;
                padding: 10px;
                font-family: 'Courier New', monospace;
                white-space: pre-wrap;
                overflow-x: auto;
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.4/latest.js?config=AM_CHTML"></script>
    </head>
    <body>
        <div class="container">
            <div class="question">
                <p>${processedText}</p>
            </div>
            ${
                questionCode
                  ? `<div class="code"><pre>${questionCode}</pre></div>`
                  : ""
              }
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
        displayMode: false,
      });
      processedExplanationText = processedExplanationText.replace(match[0], latexHtml);
    });
    processedExplanationText = processedExplanationText.replaceAll("$", "`");
    // console.log(processedExplanationText)
    const explanationHTML = `
    <html>
    <head>
        <style>
            body { width: 100%; height: 100%; font-family: 'Arial'; background-color: #f9f9f9; padding: 20px; color: #333; }
            .container { width: fit-content; height: fit-content; margin: auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
            .explanation { font-size: 18px; }
        </style>
        <script type="text/javascript">
            MathJax = {
                loader: {load: ["input/asciimath", "output/chtml"]},
                asciimath: {
                    delimiters: [["\`", "\`"]]
                }
            };
        </script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-chtml.min.js"></script>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.15/dist/katex.min.css">
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
    // identify whether we are running locally or in AWS
    let browser;
    console.log("VERCEL ENV:", process.env.VERCEL_ENV)
    if (process.env.VERCEL_ENV === 'production') {
      const executablePath = await chromium.executablePath()
      browser = await puppeteerCore.launch({
        executablePath,
        args: chromium.args,
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport
      })
    } else {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('Development browser: ');
    //   browser = await puppeteer.launch({
    //     args: ['--no-sandbox', '--disable-setuid-sandbox'],
    //     headless: true,
    //   });
    // }
    // if (process.env.NODE_ENV === 'production') {
    //   console.log('Development production: ');
    //   browser = await puppeteerCore.launch({
    //     args: chromium.args,
    //     defaultViewport: chromium.defaultViewport,
    //     executablePath: await chromium.executablePath(),
    //     headless: true,
    //   });
    // }
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
        MathJax.typeset();
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

  
    return res.status(200).json({ questionImageUrl, explanationImageUrl });
  } catch (error) {
    console.error("Error generating image:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function getImageForAskAI(req, res){
  const slug = req.params.slug;

  if(slug === "askAI"){
    const askAIContent = req.body;
    if (!askAIContent || !askAIContent.conversation) {
      return res.status(400).json({ error: "Missing conversation content" });
    }

    const { question, options, explanationSteps } = askAIContent.conversation;
    
    // Process LaTeX in content
    const processLatex = (text) => {
      const latexMatches = [...text.matchAll(/\[latex\](.*?)\[\/latex\]/gs)];
      let processedText = text;

      latexMatches.forEach((match) => {
        const latexContent = match[1];
        const latexHtml = katex.renderToString(latexContent, {
          throwOnError: false,
          displayMode: false,
        });
        processedText = processedText.replace(match[0], latexHtml);
      });
      return processedText;
    };

    // Process all content
    const processedQuestion = question ? processLatex(question) : '';
    const processedOptions = options ? options.map(option => ({
      ...option,
      text: processLatex(option.text),
    })) : [];
    const processedExplanation = explanationSteps ? explanationSteps.map(step => ({
      ...step,
      briefExplanation: processLatex(step.briefExplanation),
    })) : [];

    // Generate HTML for the content
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
                font-weight: bold;
            }
            .options {
                margin-bottom: 20px;
            }
            .option {
                margin-bottom: 10px;
                padding: 10px;
                background-color: #f1f8ff;
                border: 1px solid #cce7ff;
                border-radius: 4px;
            }
            .correct-answer {
                background-color: #e7ffe7;
                border-color: #b3ffb3;
            }
            .explanation {
                margin-top: 20px;
            }
            .step {
                margin-bottom: 15px;
                padding: 10px;
                background-color: #fff;
                border-left: 4px solid #007ACC;
            }
            .code {
                background-color: #f4f4f4;
                padding: 10px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                white-space: pre-wrap;
            }
        </style>
    </head>
    <body>
        <div class="container">
            ${question ? `
                <div class="question">
                    <p>${processedQuestion}</p>
                </div>
            ` : ''}
            
            ${options && options.length > 0 ? `
                <div class="options">
                    <h3>Options:</h3>
                    ${processedOptions.map(option => `
                        <div class="option ${option.isCorrect ? 'correct-answer' : ''}">
                            ${option.text}
                            ${option.isCorrect ? ' ✅' : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${explanationSteps && explanationSteps.length > 0 ? `
                <div class="explanation">
                    <h3>Explanation:</h3>
                    ${processedExplanation.map((step, index) => `
                        <div class="step">
                            <strong>Step ${index + 1}:</strong>
                            <p>${step.briefExplanation}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    </body>
    </html>`;

    // Launch browser and generate image
    let browser;
    if (process.env.VERCEL_ENV === 'production') {
      const executablePath = await chromium.executablePath();
      browser = await puppeteerCore.launch({
        executablePath,
        args: chromium.args,
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport
      });
    } else {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

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

    // Upload to Supabase with a unique name for askAI content
    const timestamp = Date.now();
    const fileName = `whatsapp/askAI_${timestamp}.png`;
    const { data: uploadData, error: uploadError } = await db.storage
      .from('public_assets')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const imageUrl = db.storage
      .from('public_assets')
      .getPublicUrl(fileName).data.publicUrl;

    return res.status(200).json({ imageUrl });
  }else{
    return res.status(400).json({ error: "missing url" });
  }
}

module.exports = {
  listQuestions,
  getImageById,
  getImageForAskAI,
};

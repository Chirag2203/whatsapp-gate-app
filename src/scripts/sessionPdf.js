const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const blobStream = require('blob-stream');
const sharp = require('sharp');
const getDB = require('../db');
const db = getDB();

// Function to fetch image buffers and metadata
const fetchImageBuffer = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const imageBuffer = response.data;
  const metadata = await sharp(imageBuffer).metadata();
  return { image: imageBuffer, width: metadata.width, height: metadata.height };
};

// Function to generate the PDF
const generatePDF = async (questions) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  let pageCount = 0;

  doc.on('pageAdded', () => {
    pageCount++;
    console.log(`Page ${pageCount} added.`);
  });

  const pdfPath = 'GATE_Practice_Session.pdf';
  const stream = doc.pipe(blobStream());
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.info.Title = 'GATE Practice Session';
  doc.info.Author = 'Your Name or Organization';

  const pageWidth = doc.page.width - doc.options.margin * 2;
  const pageHeight = doc.page.height - doc.options.margin * 2;

  for (const [index, question] of questions.entries()) {
    if (index > 0) {
      doc.addPage();
    }

    try {
      // Fetch the images
      const questionImageBuffer = await fetchImageBuffer(question.questionImage);
      const answerImageBuffer = await fetchImageBuffer(question.answerImage);

      // Calculate scale for both images to fit within half the page height
      const maxImageHeight = pageHeight / 2;
      const questionScale = Math.min(pageWidth / questionImageBuffer.width, maxImageHeight / questionImageBuffer.height);
      const answerScale = Math.min(pageWidth / answerImageBuffer.width, maxImageHeight / answerImageBuffer.height);

      const questionImageWidth = questionImageBuffer.width * questionScale;
      const questionImageHeight = questionImageBuffer.height * questionScale;

      const answerImageWidth = answerImageBuffer.width * answerScale;
      const answerImageHeight = answerImageBuffer.height * answerScale;

      // Center and add question image
      doc.image(questionImageBuffer.image, {
        fit: [pageWidth, maxImageHeight],
        align: 'center',
        valign: 'top',
        x: (pageWidth - questionImageWidth) / 2 + doc.options.margin,
        y: doc.options.margin,
      });

      // Add padding between images
      const padding = 20;

      // Center and add answer image
      doc.image(answerImageBuffer.image, {
        fit: [pageWidth, maxImageHeight],
        align: 'left',
        valign: 'top',
        x: (pageWidth - questionImageWidth) / 2 + doc.options.margin,
        y: questionImageHeight + doc.options.margin + padding,
      });
    } catch (error) {
      console.error(`Error fetching images for Question ${index + 1}:`, error);
      doc.text('Error loading images.', { align: 'center', color: 'red' });
    }
  }

  // Finalize the document
  doc.end();
  stream.on('finish', function () {
    const blob = stream.toBlob('application/pdf');
    const url = stream.toBlobURL('application/pdf');
    console.log('PDF blob URL:', url);
  });
  console.log(`PDF Generated: ${pdfPath}`);
};

// Function to fetch questions and generate the PDF
const getQuestions = async (questions) => {
  const { data: ques, error: quesError } = await db.from('questions').select('id').eq('whatsapp_enabled', true).limit(5);
  if (quesError) {
    console.error('Error fetching questions:', quesError);
    return;
  }

  for (let i = 0; i < ques.length; i++) {
    questions.push({
      questionImage: `https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_${ques[i].id}.png`,
      answerImage: `https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_${ques[i].id}.png`,
    });
  }

  console.log('Fetched questions:', questions);
  await generatePDF(questions);
};

// Start the process
getQuestions([]);

// console.log("questions ",questions);


// Questions array with Supabase-hosted images

// {
//   questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_5555.png',
//   answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_5555.png',
// },
// {
//   questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_963.png',
//   answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_963.png',
// },
// {
//   questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_963.png',
//   answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_963.png',
// },
// {
//   questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_963.png',
//   answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_963.png',
// },

// console.log(questions)
// const PDFDocument = require('pdfkit');
// const fs = require('fs');
// const axios = require('axios');
// const blobStream  = require('blob-stream');
// const sharp = require('sharp');

// // Function to fetch image buffers
// const fetchImageBuffer = async (url) => {
//   const response = await axios.get(url, { responseType: 'arraybuffer' });
//   const imageBuffer = response.data;
//   const metadata = await sharp(imageBuffer).metadata();
//   return { image: imageBuffer, width: metadata.width, height: metadata.height };
// };
// // Function to add a recurring watermark
// const addWatermark = (doc, text = 'Kalppo') => {
//   doc.save(); // Save the current drawing state
//   doc.opacity(0.1); // Set opacity for the watermark
//   doc.fontSize(50); // Set font size for the watermark
//   doc.fillColor('gray'); // Set color of the watermark
  
//   const pageWidth = doc.page.width;
//   const pageHeight = doc.page.height;

//   // Loop to create a grid of watermark text
//   for (let x = -50; x < pageWidth; x += 50) {
//     for (let y = -50; y < pageHeight; y += 50) {
//       doc.rotate(-45, { origin: [x, y] }) // Rotate watermark text
//         .text(text, x, y, { align: 'center', valign: 'center' })
//         .rotate(-45, { origin: [x, y] }); // Restore rotation
//     }
//   }
//   // doc.opacity(1);
//   doc.restore(); // Restore the previous drawing state
// };
// // Function to generate the PDF
// const generatePDF = async (questions) => {
//   const doc = new PDFDocument({ margin: 50 ,size: 'A3'});
//   let pageCount = 0;

//   // Listen for the 'pageAdded' event
//   doc.on('pageAdded', () => {
//     pageCount++;
//     console.log(`Page ${pageCount} added.`);
//   });
//   const pdfPath = 'GATE_Practice_Session.pdf';
//   const stream = doc.pipe(blobStream());
//   doc.pipe(fs.createWriteStream(pdfPath));

//   doc.info.Title = 'GATE Practice Session';
//   doc.info.Author = 'Your Name or Organization';
//   doc.fontSize(24).image('/Users/pranavsalunkhe/Development/mentara/plpm/kalppo-whatsapp/src/scripts/logo.png', doc.page.width/2-90, 47, {width: 24, height: 24, align: 'center',}).text("Kalppo", 0, 50, {align: 'center',})
//   doc.fontSize(8).text("Chirag Rajput", 0, 60, {align: "right", oblique: true})
//   // doc.moveDown(1);
//   for (const [index, question] of questions.entries()) {
//     // Add a new page after the first
//     if (index > 0){
//       doc.addPage();
//     }

//     // Add a header for the question
//     index == 0 ? doc.fontSize(16).text(`Question ${index + 1}`, 50, 80, { align: 'left' }) : doc.fontSize(16).text(`Question ${index + 1}`, 50, 80, { align: 'left' });
//     doc.moveDown(1);

//     try {
//       // Fetch and embed the question image
//       const questionImageBuffer = await fetchImageBuffer(question.questionImage);
//       const answerImageBuffer = await fetchImageBuffer(question.answerImage);

//       doc.image(questionImageBuffer.image, {
//         fit: [questionImageBuffer.width, answerImageBuffer.height+questionImageBuffer.height < 1190 ? questionImageBuffer.height : questionImageBuffer.height/2 ], // Adjust width and height while keeping aspect ratio
//         align: 'center',
//         valign: 'center',
//         // x: doc.page.width / 2 - 250, // Center horizontally
//         y: index == 0 ? 100 : 50, // Position below the header
//       });

//       // Add some space between question and answer images
//       // doc.moveDown(5);

//       // Fetch and embed the answer image
//       doc.rect(answerImageBuffer.height+questionImageBuffer.height < 1190 ? 50 : 50, answerImageBuffer.height+questionImageBuffer.height < 1190 ? questionImageBuffer.height+55 : questionImageBuffer.height/2+55, questionImageBuffer.width, answerImageBuffer.height).stroke().image(answerImageBuffer.image, {
//         fit: [questionImageBuffer.width, answerImageBuffer.height+questionImageBuffer.height < 1190 ? answerImageBuffer.height : answerImageBuffer.height/2], // Adjust width and height while keeping aspect ratio
//         align: 'center',
//         valign: 'center',
//         // x: doc.page.width / 2 - 250, // Center horizontally
//         y: answerImageBuffer.height+questionImageBuffer.height < 1190 ? questionImageBuffer.height+50 : questionImageBuffer.height/2+50, // Position below the question image
//       });
//     } catch (error) {
//       console.error(`Error fetching images for Question ${index + 1}:`, error);
//       doc.text('Error loading images.', { align: 'center', color: 'red' });
//     }
//   }

//   // Finalize the document
//   doc.end();
//   stream.on('finish', function() {
//     // get a blob you can do whatever you like with
//     const blob = stream.toBlob('application/pdf');
  
//     // or get a blob URL for display in the browser
//     const url = stream.toBlobURL('application/pdf');
//     // iframe.src = url;
//     console.log(blob)
//   });
//   console.log(`PDF Generated: ${pdfPath}`);
// };

// // Questions array with Supabase-hosted images
// const questions = [
//   {
//     questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_5555.png',
//     answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_5555.png',
//   },
//   {
//     questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_963.png',
//     answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_963.png',
//   },
// ];

// // Generate the PDF
// generatePDF(questions);

const PDFKit = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const doc = new PDFKit();

const fetchImageBuffer = async (url) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
  };

// Sample data (replace with your actual data)
const data = [
    {
      questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_5555.png',
      answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_5555.png',
    },
    {
      questionImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/question_1625.png',
      answerImage: 'https://awfofpvjnfpmmgcosjzc.supabase.co/storage/v1/object/public/public_assets/whatsapp/explanation_1625.png',
    },
  ];
  

const itemsPerPage = 1; // Number of items to display per page

// Calculate the total number of pages
const totalPages = data.length

// Function to generate a single page of content
async function generatePage(page) {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, data.length);

  page == 1 ? doc.fontSize(16).text(`Question ${page + 1}`, 50, 80, { align: 'left' }) : doc.fontSize(16).text(`Question ${page + 1}`, 50, 80, { align: 'left' });
    console.log("page:", page)
  for (let i = startIndex; i < endIndex; i++) {
    console.log(i)
    const questionImageBuffer = await fetchImageBuffer(data[i].questionImage);
      doc.image(questionImageBuffer, {
        fit: [500, 300], // Adjust width and height while keeping aspect ratio
        align: 'center',
        valign: 'center',
        x: doc.page.width / 2 - 250, // Center horizontally
        y: page == 1 ? 100 : 10, // Position below the header
      });
      const answerImageBuffer = await fetchImageBuffer(data[i].answerImage);
      doc.rect(doc.page.width / 2 - 250, 400, 500, 400).stroke().image(answerImageBuffer, {
        fit: [500, 400], // Adjust width and height while keeping aspect ratio
        align: 'center',
        valign: 'center',
        x: doc.page.width / 2 - 250, // Center horizontally
        y: 300, // Position below the question image
      });
  }

  if (page <= totalPages) {
    doc.addPage(); // Add a new page for the next iteration
  }
}


doc.info.Title = 'GATE Practice Session';
doc.info.Author = 'Your Name or Organization';
doc.fontSize(24).image('/Users/pranavsalunkhe/Development/mentara/plpm/kalppo-whatsapp/src/scripts/logo.png', doc.page.width/2-90, 47, {width: 24, height: 24, align: 'center',}).text("Kalppo", 0, 50, {align: 'center',})
doc.fontSize(8).text("Chirag Rajput", 0, 60, {align: "right", oblique: true})
// Iterate through each page and generate content
for (let page = 1; page <= totalPages; page++) {
    generatePage(page);
  }
// Pipe the generated PDF to a file or stream
doc.pipe(fs.createWriteStream('output.pdf'));
doc.end();
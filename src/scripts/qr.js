const QRCode = require('qrcode');

const generateQRCode = async (link) => {
  try {
    const qrCode = await QRCode.toDataURL(link);
    console.log('QR Code Generated');
    return qrCode;
  } catch (error) {
    console.error('Error generating QR Code:', error);
  }
};

const whatsappLink = "https://wa.me/message/AZBPWRR2G4ZRO1";
generateQRCode(whatsappLink).then((qrCode) => {
  // Save this QR Code URL or embed it in your webpage
  console.log(qrCode); 
});

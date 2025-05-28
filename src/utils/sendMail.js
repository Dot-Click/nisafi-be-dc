const emailjs = require("@emailjs/nodejs");

const sendMail = async (email, code) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  const templateParams = {
    email: email,
    otp: code,
  };

  try {
    await emailjs.send(serviceId, templateId, templateParams, {
      publicKey,
    });
  } catch (error) {
    console.error("EmailJS Error:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = { sendMail };

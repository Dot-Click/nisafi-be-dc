// utils/sendMail.js
const { Resend } = require("resend");
const resend = new Resend("re_ipn5PbL1_NxSq4u9p3Qcw7MM61DaVv4AS");

const sendMail = async (to, code) => {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: "Password Reset Code",
      text: `Your OTP code is: ${code}`,
    });
  } catch (error) {
    console.error("Resend Error:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = { sendMail };

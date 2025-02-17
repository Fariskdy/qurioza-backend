const nodemailer = require("nodemailer");

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// HTML email template for password reset
const getPasswordResetTemplate = (resetLink) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      font-family: Arial, sans-serif;
      line-height: 1.6;
    }
    .header {
      background-color: #7c3aed;
      color: white;
      padding: 20px;
      text-align: center;
    }
    .content {
      padding: 20px;
      background-color: #f9fafb;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #7c3aed;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      padding: 20px;
      text-align: center;
      font-size: 0.875rem;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>
      <p>This link will expire in 1 hour for security reasons.</p>
      <p>If you didn't request this password reset, you can safely ignore this email.</p>
      <p>
        <small>If the button doesn't work, copy and paste this link into your browser:</small><br>
        <small>${resetLink}</small>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated email, please do not reply.</p>
      <p>&copy; ${new Date().getFullYear()} Qurioza. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const sendResetPasswordEmail = async (to, resetLink) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: "Reset Your Password - Qurioza",
      html: getPasswordResetTemplate(resetLink),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

module.exports = {
  sendResetPasswordEmail,
};

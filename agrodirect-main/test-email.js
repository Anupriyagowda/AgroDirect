const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

console.log('Testing connection with:');
console.log('Host:', process.env.EMAIL_HOST);
console.log('Port:', process.env.EMAIL_PORT);
console.log('User:', process.env.EMAIL_USER);

transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ Connection Error:');
    console.error(error);
    process.exit(1);
  } else {
    console.log('✅ Server is ready to take our messages');
    process.exit(0);
  }
});

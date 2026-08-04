import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import multer from "multer";
import dotenv from "dotenv";
import { processExcelUpload, processJsonUpload } from "./server/upload.ts";


dotenv.config();

const app = express();
const PORT = 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload-excel", upload.single("excel"), processExcelUpload);
app.post("/api/upload-json", upload.single("json"), processJsonUpload);

app.post("/api/send-report", upload.single("pdf"), async (req, res) => {
  try {
    const { emails, subject, text } = req.body;
    const file = req.file;

    if (!emails || !file) {
       return res.status(400).json({ error: "Missing emails or pdf file" });
    }

    const emailList = JSON.parse(emails);

    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.warn("Using Ethereal Email for testing. Provide SMTP variables in .env for production.");
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Andbank Reports" <reports@andbank.com>',
      to: emailList.join(", "),
      subject: subject || "Reporte de Inversión",
      text: text || "Adjunto el reporte de inversión solicitado.",
      attachments: [
        {
          filename: "Reporte_Inversion.pdf",
          content: file.buffer,
          contentType: "application/pdf"
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    
    res.json({ success: true, message: "Emails sent successfully", previewUrl });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

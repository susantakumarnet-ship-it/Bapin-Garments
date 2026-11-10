import { config } from '../config.js';

let transporter = null;

async function getTransporter() {
  if (!config.smtp.host) return null;
  if (!transporter) {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/** Sends an email when SMTP is configured; otherwise logs it to the console (dev). */
export async function sendMail({ to, subject, text, html }) {
  const t = await getTransporter();
  if (!t) {
    console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { delivered: false };
  }
  await t.sendMail({ from: config.smtp.from, to, subject, text, html });
  return { delivered: true };
}

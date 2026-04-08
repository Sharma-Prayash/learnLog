import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Check if SMTP is configured
const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;

if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('📧 Email service configured');
} else {
  console.log('📧 Email service in dry-run mode (no SMTP configured)');
}

const FROM_EMAIL = process.env.SMTP_FROM || 'LearnLog <noreply@learnlog.app>';

/**
 * Send email or log to console in dry-run mode.
 */
async function sendEmail(to, subject, html) {
  if (!smtpConfigured || !transporter) {
    console.log(`📧 [DRY RUN] Email to: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${html.replace(/<[^>]*>/g, '').substring(0, 200)}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.warn(`⚠️ Failed to send email to ${to}:`, err.message);
  }
}

/**
 * Notify the classroom owner about a new join request.
 */
export async function sendJoinRequestEmail(ownerEmail, studentName, classroomName) {
  const subject = `New Join Request – ${classroomName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">🔔 New Join Request</h2>
      <p><strong>${studentName}</strong> has requested to join your classroom <strong>"${classroomName}"</strong>.</p>
      <p>Log in to LearnLog to approve or reject the request.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">This is an automated message from LearnLog.</p>
    </div>
  `;
  await sendEmail(ownerEmail, subject, html);
}

/**
 * Notify the student that their membership was approved.
 */
export async function sendApprovalEmail(studentEmail, classroomName) {
  const subject = `You're In! – ${classroomName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #22c55e;">✅ Membership Approved</h2>
      <p>Your request to join <strong>"${classroomName}"</strong> has been approved!</p>
      <p>Log in to LearnLog to start learning.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">This is an automated message from LearnLog.</p>
    </div>
  `;
  await sendEmail(studentEmail, subject, html);
}

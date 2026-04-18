/**
 * Email sending service
 * This is a placeholder that can be integrated with SendGrid, SES, or other providers
 */

interface EmailOptions {
  to: string
  subject: string
  htmlBody: string
  textBody: string
}

/**
 * Send email (currently logs to console for development)
 * In production, integrate with SendGrid, AWS SES, Resend, or similar
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, htmlBody, textBody } = options

  // TODO: Integrate with actual email provider
  // Options:
  // 1. SendGrid: npm install @sendgrid/mail
  // 2. AWS SES: Already available via AWS SDK
  // 3. Resend: npm install resend
  // 4. Nodemailer: npm install nodemailer

  // For now, log to console and simulate success
  if (process.env.NODE_ENV === "development") {
    console.info("📧 [EMAIL] Development Mode - Not actually sending")
    console.info(`   To: ${to}`)
    console.info(`   Subject: ${subject}`)
    console.info(`   HTML Length: ${htmlBody.length} chars`)
    console.info(`   Text Length: ${textBody.length} chars`)
    return
  }

  // In production, implement actual email sending here
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to,
  //   from: process.env.FROM_EMAIL || 'noreply@kuaminisystems.com',
  //   subject,
  //   html: htmlBody,
  //   text: textBody,
  // });

  console.warn("⚠️ [EMAIL] Email provider not configured. Email sending will fail in production.")
}

/**
 * Verify email was sent (for testing)
 */
export async function sendVerificationEmail(
  to: string,
  fullName: string,
  organizationName: string,
  verificationLink: string,
  htmlTemplate: string,
  textTemplate: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Verify Your Email - Kuamini Threat Protection`,
    htmlBody: htmlTemplate,
    textBody: textTemplate,
  })
}

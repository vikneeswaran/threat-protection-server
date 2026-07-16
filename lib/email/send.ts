/**
 * Email sending service
 * This is a placeholder that can be integrated with SendGrid, SES, or other providers
 */

import nodemailer from "nodemailer"

interface EmailOptions {
  to: string
  subject: string
  htmlBody: string
  textBody: string
  replyTo?: string
}

/**
 * Send email (currently logs to console for development)
 * In production, integrate with SendGrid, AWS SES, Resend, or similar
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, htmlBody, textBody, replyTo } = options

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || "587")
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true"
  const fromEmail = process.env.FROM_EMAIL || "noreply@kuaminisystems.com"

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    console.info("[EMAIL] Attempting SMTP send", {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpSecure,
      fromEmail,
      to,
      subject
    })

    try {
      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html: htmlBody,
        text: textBody,
        replyTo,
      })
      console.info("[EMAIL] Email sent successfully")
    } catch (err) {
      console.error("[EMAIL] Error sending email:", err)
      throw err
    }
    return
  }

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

  throw new Error("Email provider not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and FROM_EMAIL.")
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

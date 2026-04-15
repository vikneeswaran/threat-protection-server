import { createHash, randomBytes } from "crypto"

/**
 * Generate a verification token and its hash
 * Token is sent to user, hash is stored in DB
 */
export function generateVerificationToken() {
  const token = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  return { token, tokenHash }
}

/**
 * Generate HTML email template for email verification
 */
export function getVerificationEmailTemplate(
  verificationLink: string,
  userFullName: string,
  organizationName: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verify Your Email</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
          .greeting { font-size: 18px; font-weight: 600; margin-bottom: 15px; }
          .message { margin: 20px 0; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; padding: 12px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 25px 0; }
          .button-container { text-align: center; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; }
          .divider { border-top: 1px solid #e5e7eb; margin: 30px 0; }
          .security-note { background: #fef3c7; padding: 15px; border-radius: 6px; font-size: 13px; color: #92400e; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🛡️ Kuamini Threat Protection</div>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${userFullName},</p>
            
            <p class="message">
              Thank you for registering your organization <strong>${organizationName}</strong> with Kuamini Threat Protection. 
              To complete your account setup and gain access to your security console, please verify your email address.
            </p>
            
            <div class="button-container">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </div>
            
            <p class="message">
              Or copy and paste this link in your browser:<br>
              <code style="word-break: break-all; font-size: 12px; color: #4b5563; background: #fff; padding: 2px 4px;">${verificationLink}</code>
            </p>
            
            <p class="message">
              This verification link will expire in 24 hours.
            </p>
            
            <div class="divider"></div>
            
            <div class="security-note">
              <strong>⚠️ Security Notice:</strong> If you did not create this account, please ignore this email or contact our support team immediately.
            </div>
            
            <p class="message">
              Best regards,<br>
              The Kuamini Security Team
            </p>
          </div>
          
          <div class="footer">
            <p>© 2026 Kuamini Systems. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Generate plain text email template as fallback
 */
export function getVerificationEmailPlainText(
  verificationLink: string,
  userFullName: string,
  organizationName: string
): string {
  return `
Hello ${userFullName},

Thank you for registering your organization ${organizationName} with Kuamini Threat Protection. 
To complete your account setup and gain access to your security console, please verify your email address.

Visit this link to verify:
${verificationLink}

This verification link will expire in 24 hours.

If you did not create this account, please ignore this email or contact our support team.

Best regards,
The Kuamini Security Team

© 2026 Kuamini Systems. All rights reserved.
This is an automated email. Please do not reply to this message.
  `.trim()
}

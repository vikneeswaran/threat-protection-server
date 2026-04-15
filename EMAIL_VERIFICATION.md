# Email Verification Implementation

## Overview

This document describes the email verification flow implemented for new user registration in the Kuamini Threat Protection console. When users register, they receive an email with a verification link. They cannot log in until they click the link to verify their email address.

## Features

- **Secure Token Generation**: Uses cryptographically secure tokens with SHA-256 hashing
- **24-Hour Expiry**: Verification links expire after 24 hours for security
- **One-Time Use**: Each token can only be used once
- **Email Template**: Professional HTML and plain text email templates
- **User-Friendly Flow**: Clear messaging and status pages for users
- **Database Cleanup**: Automatic cleanup of expired tokens

## User Flow

### Registration Flow
1. User fills out registration form with organization name, full name, email, password, and license tier
2. User clicks "Create Account"
3. Backend:
   - Validates all required fields
   - Checks if email already exists
   - Hashes password with bcrypt
   - Creates user account with `email_verified = FALSE`
   - Creates organization account and admin profile
   - Generates secure verification token
   - Stores token hash in database with 24-hour expiry
   - Sends verification email with verification link
4. Frontend shows success page with email address and instructions
5. User receives email with verification link

### Email Verification Flow
1. User clicks verification link in email
2. Browser navigates to `/securityAgent/auth/verify-email?token=XXX&email=user@example.com`
3. Page automatically verifies the token:
   - Shows loading state
   - Validates token hasn't expired
   - Matches email to user account
   - Updates `email_verified = TRUE` in database
   - Marks token as used
   - Creates session (automatically logs in user)
4. Shows success page and redirects to dashboard after 3 seconds

### Login Flow
1. User attempts to log in with email and password
2. Backend checks:
   - Email exists
   - Password is correct
   - User is active
   - **Email is verified** ← NEW CHECK
3. If email not verified: Returns 403 error with message to check inbox
4. If all checks pass: Creates session and redirects to dashboard

## Database Schema

### New Table: `email_verification_tokens`
```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
```

### Updated Table: `app_users`
- `email_verified BOOLEAN` (already exists in schema, now used actively)
  - Default: `FALSE` for new registrations
  - Set to `TRUE` after email verification
  - Checked during login

## File Structure

### Database Migration
- **File**: `scripts/008_email_verification.sql`
- **Purpose**: Creates `email_verification_tokens` table and cleanup function
- **Run**: Once during database setup

### Email Services
- **File**: `lib/email/verification.ts`
  - `generateVerificationToken()`: Generates secure token and hash
  - `getVerificationEmailTemplate()`: HTML email template
  - `getVerificationEmailPlainText()`: Plain text email template

- **File**: `lib/email/send.ts`
  - `sendEmail()`: Main email sending function (placeholder for integration)
  - `sendVerificationEmail()`: Wrapper for verification emails

### API Endpoints
- **File**: `app/api/auth/local/register/route.ts`
  - `POST /api/auth/local/register`
  - Creates user with `email_verified = FALSE`
  - Generates token and sends verification email
  - Returns success message instead of creating session

- **File**: `app/api/auth/local/verify-email/route.ts`
  - `GET /api/auth/local/verify-email?token=XXX&email=user@example.com`
  - Validates token and email
  - Marks user as verified
  - Creates session (logs in user)
  - Returns success or error response

- **File**: `app/api/auth/local/login/route.ts`
  - Updated to check `email_verified = TRUE`
  - Returns 403 error if email not verified

### Frontend Pages
- **File**: `app/securityAgent/auth/register/page.tsx`
  - Shows registration form
  - After successful registration, displays success page
  - Instructs user to check email for verification link
  - Shows helper text for spam folder

- **File**: `app/securityAgent/auth/verify-email/page.tsx`
  - Shows verification status (loading, success, error)
  - Automatically calls verification API
  - Auto-redirects to dashboard on success
  - Shows error details and next steps on failure

## Integration: Email Provider Setup

Currently, the email service logs to console in development. To send actual emails in production, integrate with one of these providers:

### Option 1: SendGrid (Recommended)
```bash
npm install @sendgrid/mail
```

Update `lib/email/send.ts`:
```typescript
import sgMail from '@sendgrid/mail';

export async function sendEmail(options: EmailOptions): Promise<void> {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  
  await sgMail.send({
    to: options.to,
    from: process.env.FROM_EMAIL || 'noreply@kuaminisystems.com',
    subject: options.subject,
    html: options.htmlBody,
    text: options.textBody,
  });
}
```

### Option 2: AWS SES
Use AWS SDK (already available if running on EC2):
```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: process.env.AWS_REGION });

export async function sendEmail(options: EmailOptions): Promise<void> {
  const command = new SendEmailCommand({
    Source: process.env.FROM_EMAIL || 'noreply@kuaminisystems.com',
    Destination: { ToAddresses: [options.to] },
    Message: {
      Subject: { Data: options.subject },
      Body: {
        Html: { Data: options.htmlBody },
        Text: { Data: options.textBody },
      },
    },
  });
  
  await sesClient.send(command);
}
```

### Option 3: Resend (Next.js Optimized)
```bash
npm install resend
```

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(options: EmailOptions): Promise<void> {
  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@kuaminisystems.com',
    to: options.to,
    subject: options.subject,
    html: options.htmlBody,
    text: options.textBody,
  });
}
```

### Environment Variables
Add to `.env.local` or EC2 deployment:
```
FROM_EMAIL=noreply@kuaminisystems.com
SENDGRID_API_KEY=your_key_here  # If using SendGrid
RESEND_API_KEY=your_key_here    # If using Resend
AWS_REGION=us-east-1             # If using SES
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Security Considerations

1. **Token Storage**: Tokens are hashed with SHA-256 before storing in database
   - Raw token is only shown to user in email
   - Hash stored in database can't be reversed
   - Even if DB is compromised, tokens remain secure

2. **Token Expiry**: 24-hour expiration
   - Reduces window of vulnerability
   - Auto-cleanup removes expired tokens

3. **One-Time Use**: Tokens marked as used after verification
   - Prevents token reuse attacks
   - Improves security if token is compromised

4. **Email Verification Check**: Login requires verified email
   - Prevents account takeover via unverified email
   - Forces legitimate email delivery before account access

5. **HTTPS Only**: Ensure all verification links use HTTPS
   - Set `NEXT_PUBLIC_APP_URL` to HTTPS URL in production

## Testing

### Manual Testing
1. Register new account
2. Check console logs (development) or email provider logs (production)
3. Click verification link in email
4. Verify redirected to dashboard and logged in
5. Test expired token: Manually set `expires_at` to past time
6. Try logging in without verifying: Should see error message

### API Testing
```bash
# Register
curl -X POST http://localhost:3000/api/auth/local/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123",
    "fullName": "Test User",
    "organizationName": "Test Org",
    "licenseTier": "free"
  }'

# Verify (use token from console logs)
curl -X GET "http://localhost:3000/api/auth/local/verify-email?token=YOUR_TOKEN&email=test@example.com"
```

## Monitoring & Maintenance

### Check Pending Verifications
```sql
SELECT 
  evt.id,
  au.email,
  evt.created_at,
  evt.expires_at,
  CASE 
    WHEN evt.verified_at IS NOT NULL THEN 'VERIFIED'
    WHEN evt.expires_at < NOW() THEN 'EXPIRED'
    ELSE 'PENDING'
  END as status
FROM email_verification_tokens evt
JOIN app_users au ON au.id = evt.user_id
ORDER BY evt.created_at DESC;
```

### Clean Up Expired Tokens
```sql
-- Run periodically (daily scheduled task)
SELECT cleanup_expired_verification_tokens();
```

### Monitor Failed Verifications
```sql
SELECT 
  au.email,
  COUNT(*) as failed_attempts,
  MAX(evt.created_at) as last_attempt
FROM email_verification_tokens evt
JOIN app_users au ON au.id = evt.user_id
WHERE evt.expires_at < NOW()
  AND evt.verified_at IS NULL
GROUP BY au.email
ORDER BY failed_attempts DESC;
```

## Troubleshooting

### User Not Receiving Email
1. Check `FROM_EMAIL` configuration
2. Verify email provider API keys are correct
3. Check spam/junk folder
4. Review email provider logs for failures

### Token Verification Fails
1. Verify token hasn't expired (24-hour limit)
2. Verify token hasn't been used already
3. Verify email parameter matches registered email
4. Check database for token record

### User Can't Log In After Verification
1. Verify `email_verified = TRUE` in app_users table
2. Check session creation is working
3. Verify cookies are enabled in browser

## Future Enhancements

- [ ] Resend verification email functionality
- [ ] SMS verification as alternative
- [ ] Multi-factor authentication (MFA)
- [ ] Rate limiting on verification attempts
- [ ] Admin dashboard to resend verification emails
- [ ] Verification email customization/branding

# Email Verification Setup Guide

## Quick Start

### 1. Database Migration

Run the SQL migration to create the email verification tokens table:

```bash
# Connect to your AWS RDS PostgreSQL database
psql $DATABASE_URL -f scripts/008_email_verification.sql

# Or if using pgAdmin, copy-paste the contents of scripts/008_email_verification.sql
```

### 2. Configure Email Provider

Choose one of these email providers for production:

#### Option A: Resend (Recommended for Next.js)
```bash
npm install resend
```

Update `lib/email/send.ts` and add to `.env.local`:
```
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@kuaminisystems.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Option B: SendGrid
```bash
npm install @sendgrid/mail
```

Update `lib/email/send.ts` and add to `.env.local`:
```
SENDGRID_API_KEY=SG.your_key_here
FROM_EMAIL=noreply@kuaminisystems.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### Option C: AWS SES (Already available on EC2)
Add to `.env.local`:
```
AWS_REGION=us-east-1
FROM_EMAIL=noreply@kuaminisystems.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Test the Flow

**Development Mode** (emails log to console):
```bash
npm run dev

# Visit http://localhost:3000/securityAgent/auth/register
# Fill out registration form
# Check console for verification email link
# Copy link and visit it in browser
# Should show verification success and auto-login
```

**With Actual Email Provider**:
1. Set email provider API keys in `.env.local`
2. Ensure `NEXT_PUBLIC_APP_URL` is set to your actual domain (HTTPS required)
3. Run `npm run dev` or deploy to production
4. Register new account
5. Check email inbox for verification link
6. Click link to verify and auto-login

### 4. Deployment to AWS EC2

Add environment variables to your EC2 deployment:

```bash
# SSH to your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Edit the PM2 ecosystem config or .env file
sudo nano /opt/kuamini-console/.env

# Add:
FROM_EMAIL=noreply@kuaminisystems.com
RESEND_API_KEY=re_your_api_key_here
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Restart application
pm2 restart kuamini-console
pm2 logs kuamini-console
```

## Current Status

### What's Implemented ✅
- [x] Database schema with email verification tokens table
- [x] Email token generation and hashing
- [x] Email templates (HTML and plain text)
- [x] Registration endpoint that creates unverified users
- [x] Email verification endpoint that verifies and auto-logs in
- [x] Login endpoint that checks email_verified status
- [x] Registration page with success screen
- [x] Email verification page with status updates
- [x] Placeholder email service ready for integration

### What's Ready to Integrate 🔌
- Email sending service (`lib/email/send.ts`)
- Support for: Resend, SendGrid, AWS SES, or any other provider
- Examples provided for each provider

## Testing the Implementation

### Manual Test Flow
```
1. Go to http://localhost:3000/securityAgent/auth/register
2. Fill in:
   - Organization: "Test Company"
   - Full Name: "Test User"
   - Email: "test@example.com"
   - Password: "TestPassword123"
   - License: "Free"
3. Click "Create Account"
4. See success page with "Check your email" message
5. In console, find the verification link starting with:
   "http://localhost:3000/securityAgent/auth/verify-email?token=..."
6. Copy the full link and paste in browser
7. Should see verification loading → success
8. Auto-redirected to dashboard
9. Logged in as test@example.com
```

### Test Failed Login
```
1. Logout or close console
2. Go to http://localhost:3000/securityAgent/auth/login
3. Try logging in as test@example.com before clicking email link
4. Should get error: "Please verify your email address..."
5. After verifying email, login should work
```

### Test Token Expiry
```
1. Register new account (token created with 24-hour expiry)
2. In database, set token expiry to past:
   UPDATE email_verification_tokens 
   SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE user_id = (SELECT id FROM app_users WHERE email = 'test@example.com');
3. Try verification link again
4. Should see "Invalid or expired verification token" error
```

## Email Provider Setup Details

### Resend
- **Website**: https://resend.com
- **Best For**: Next.js applications
- **Setup**: 
  - Create account
  - Get API key from dashboard
  - Set `FROM_EMAIL` to a verified domain email
  - Test before deploying

### SendGrid
- **Website**: https://sendgrid.com
- **Best For**: Enterprise applications
- **Setup**:
  - Create account
  - Generate API key (Settings → API Keys)
  - Verify sender email or domain
  - Set `FROM_EMAIL` in `.env`

### AWS SES
- **Website**: AWS Console
- **Best For**: AWS infrastructure
- **Setup**:
  - Verify sender email in SES console
  - Create IAM user with SES permissions (if not already running on EC2 with role)
  - Set `FROM_EMAIL` to verified email
  - Note: May have sending limits initially (request increase)

## Environment Variables Reference

```env
# Required for email verification
FROM_EMAIL=noreply@kuaminisystems.com
NEXT_PUBLIC_APP_URL=https://your-domain.com  # Must be HTTPS in production

# For Resend
RESEND_API_KEY=re_your_key_here

# For SendGrid
SENDGRID_API_KEY=SG.your_key_here

# For AWS SES (optional if using EC2 IAM role)
AWS_REGION=us-east-1

# Database (already existing)
DATABASE_URL=postgresql://...
DATABASE_SSL=true
```

## Monitoring

### Check Verification Status in Database
```sql
-- Show all verification tokens
SELECT 
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
ORDER BY evt.created_at DESC
LIMIT 20;

-- Show unverified users
SELECT 
  id,
  email,
  created_at,
  email_verified
FROM app_users
WHERE email_verified = FALSE
ORDER BY created_at DESC;
```

## Rollback (If Needed)

If you need to revert to no email verification:

1. Delete the migration table:
   ```sql
   DROP TABLE IF EXISTS email_verification_tokens CASCADE;
   ```

2. Revert login endpoint changes (add back: remove `email_verified` check)

3. Revert registration endpoint (add back: `createSession(userId)` immediately)

4. Mark all users as verified:
   ```sql
   UPDATE app_users SET email_verified = TRUE;
   ```

## Support & Troubleshooting

See [EMAIL_VERIFICATION.md](./EMAIL_VERIFICATION.md) for detailed documentation and troubleshooting.

### Common Issues

**"Email not sending"**
- Check API key is correct
- Check `FROM_EMAIL` is verified in email provider
- Check `NEXT_PUBLIC_APP_URL` is HTTPS in production
- Review email provider logs

**"Token verification fails"**
- Verify token hasn't expired (24 hour limit)
- Check URL parameters are correctly encoded
- Ensure database migration was run

**"Can't log in after verification"**
- Verify `email_verified = TRUE` in database
- Clear browser cookies
- Check application logs for session errors

## Next Steps

1. ✅ Run database migration (`scripts/008_email_verification.sql`)
2. ✅ Choose email provider and get API key
3. ✅ Update `lib/email/send.ts` with provider integration
4. ✅ Add environment variables to `.env.local` and deployment config
5. ✅ Test registration and verification flow
6. ✅ Deploy to production

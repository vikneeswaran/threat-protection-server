# Email Verification - Flow Diagrams

## Registration & Email Verification Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER REGISTRATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

1. REGISTRATION PAGE
   ┌──────────────────────────────┐
   │ Fill Registration Form:      │
   │ - Organization Name          │
   │ - Full Name                  │
   │ - Email                      │
   │ - Password                   │
   │ - License Tier               │
   │ - Click "Create Account"     │
   └──────────────┬───────────────┘
                  │
                  ▼
2. BACKEND: POST /api/auth/local/register
   ┌──────────────────────────────────────────────┐
   │ 1. Validate all fields                       │
   │ 2. Check if email already exists             │
   │ 3. Hash password with bcrypt                 │
   │ 4. Create user (email_verified = FALSE)      │
   │ 5. Create account & profile                  │
   │ 6. Generate verification token & hash        │
   │ 7. Store token_hash in DB with 24h expiry    │
   │ 8. Render email template with link           │
   │ 9. Send verification email                   │
   │ 10. Return success (NO session created)      │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼
3. SUCCESS PAGE
   ┌──────────────────────────────────────────────┐
   │ ✅ Account Created!                          │
   │ 📧 Verify your email to get started          │
   │                                              │
   │ "We've sent a verification link to           │
   │  user@example.com"                           │
   │                                              │
   │ 💡 Check spam/junk folder if needed          │
   │ ⏱️  Link expires in 24 hours                  │
   │                                              │
   │ [Go to Login]                                │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼
4. USER RECEIVES EMAIL
   ┌──────────────────────────────────────────────┐
   │ From: noreply@kuaminisystems.com             │
   │ Subject: Verify Your Email                   │
   │                                              │
   │ Hello [User],                                │
   │ Thank you for registering [Organization]    │
   │ with Kuamini Threat Protection.             │
   │                                              │
   │ [VERIFY EMAIL ADDRESS] ← Click this button  │
   │                                              │
   │ Link: https://domain.com/securityAgent/     │
   │       auth/verify-email?token=ABC123&       │
   │       email=user@example.com                │
   │                                              │
   │ ⚠️  Link expires in 24 hours                 │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼
5. USER CLICKS VERIFICATION LINK
   ┌──────────────────────────────────────────────┐
   │ Browser navigates to:                        │
   │ /securityAgent/auth/verify-email?token=...  │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼
6. VERIFY EMAIL PAGE - LOADING STATE
   ┌──────────────────────────────────────────────┐
   │ ⏳ Verifying Email                            │
   │                                              │
   │ Please wait while we verify your email...   │
   │                                              │
   │ [Spinner animation]                         │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼
7. BACKEND: GET /api/auth/local/verify-email
   ┌──────────────────────────────────────────────┐
   │ 1. Extract token from URL                    │
   │ 2. Hash token with SHA-256                   │
   │ 3. Find token_hash in DB                     │
   │ 4. Check token hasn't expired                │
   │ 5. Check token hasn't been used (verified_at)│
   │ 6. Verify email matches user record          │
   │ 7. Update user: email_verified = TRUE        │
   │ 8. Mark token: verified_at = NOW()           │
   │ 9. Create session (auto-login user)          │
   │ 10. Return success response                  │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼
8. VERIFY EMAIL PAGE - SUCCESS STATE
   ┌──────────────────────────────────────────────┐
   │ ✅ Email Verified!                           │
   │                                              │
   │ Your account is ready to use.               │
   │ You are now logged in.                      │
   │                                              │
   │ Redirecting to dashboard in 3 seconds...    │
   │                                              │
   │ [Go to Dashboard]                            │
   └──────────────┬───────────────────────────────┘
                  │
                  ▼ (auto-redirect after 3 seconds)
9. DASHBOARD PAGE
   ┌──────────────────────────────────────────────┐
   │ 🎉 User is now logged in and verified!      │
   │                                              │
   │ Session created with httpOnly cookie        │
   │ Ready to use console features               │
   └──────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                           ERROR SCENARIOS                               │
└─────────────────────────────────────────────────────────────────────────┘

Token Already Used:
┌────────────────────────────────────────┐
│ ❌ Verification Failed                  │
│                                        │
│ This link has already been used.      │
│ If you need a new verification link,  │
│ please contact support.               │
└────────────────────────────────────────┘

Token Expired (> 24 hours):
┌────────────────────────────────────────┐
│ ❌ Verification Failed                  │
│                                        │
│ The verification link has expired.     │
│ Links are valid for 24 hours.         │
│ Request a new verification email.     │
└────────────────────────────────────────┘

Invalid Token:
┌────────────────────────────────────────┐
│ ❌ Verification Failed                  │
│                                        │
│ Invalid verification link.             │
│ Please copy from your email carefully. │
└────────────────────────────────────────┘
```

## Login Flow with Email Verification Check

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOGIN FLOW (Updated)                             │
└─────────────────────────────────────────────────────────────────────────┘

1. LOGIN PAGE
   ┌──────────────────────────────────┐
   │ Email: user@example.com          │
   │ Password: ••••••••               │
   │ [Sign In]                        │
   └──────────────┬────────────────────┘
                  │
                  ▼
2. BACKEND: POST /api/auth/local/login
   ┌─────────────────────────────────────────────────┐
   │ 1. Validate email & password provided           │
   │ 2. Query: SELECT * FROM app_users WHERE email   │
   │ 3. Check user exists                           │
   │ 4. Check password_hash not null                │
   │ 5. Check user is_active = TRUE                 │
   │ 6. Compare password with bcrypt                │
   │ 7. ✨ NEW: Check email_verified = TRUE         │
   │                                                 │
   │    IF email_verified = FALSE:                  │
   │      └─ Return 403 error                       │
   │      └─ Message: "Please verify email..."      │
   │      └─ Stop, do NOT create session            │
   │                                                 │
   │    IF email_verified = TRUE:                   │
   │      └─ Update last_login_at                   │
   │      └─ Create session                         │
   │      └─ Return success                         │
   └──────────────┬───────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
    EMAIL NOT               EMAIL
    VERIFIED              VERIFIED
        │                    │
        ▼                    ▼
   Return 403            Return 200
   "Please verify        "ok: true"
   your email"           Create session
        │                    │
        ▼                    ▼
   LOGIN FAILED         LOGIN SUCCESS
   ┌────────────────┐  ┌────────────────┐
   │ ❌ Error:      │  │ ✅ Logged in!  │
   │ "Please verify │  │ Redirect to    │
   │ email before   │  │ dashboard      │
   │ logging in"    │  │                │
   │                │  │ Session cookie │
   │ Check inbox... │  │ created        │
   └────────────────┘  └────────────────┘
```

## Database State Transitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  APP_USERS TABLE STATE CHANGES                          │
└─────────────────────────────────────────────────────────────────────────┘

Before Registration:
  ┌────────────────────────────────────────┐
  │ No record yet                          │
  └────────────────────────────────────────┘
              │
              ▼ POST /api/auth/local/register
  
After Registration (NEW USER):
  ┌────────────────────────────────────────┐
  │ id: UUID                               │
  │ email: "user@example.com"              │
  │ password_hash: "$2a$12$..."            │
  │ full_name: "Test User"                 │
  │ is_active: TRUE                        │
  │ email_verified: FALSE ← Can't login!   │
  │ last_login_at: NULL                    │
  │ created_at: NOW()                      │
  └────────────────────────────────────────┘
              │
              ▼ User clicks email link
              │ GET /api/auth/local/verify-email
  
After Email Verification:
  ┌────────────────────────────────────────┐
  │ id: UUID (same)                        │
  │ email: "user@example.com" (same)       │
  │ password_hash: "$2a$12$..." (same)     │
  │ full_name: "Test User" (same)          │
  │ is_active: TRUE (same)                 │
  │ email_verified: TRUE ← Can login now!  │
  │ last_login_at: NULL (updated on login) │
  │ created_at: ... (same)                 │
  │ updated_at: NOW()                      │
  └────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│            EMAIL_VERIFICATION_TOKENS TABLE LIFECYCLE                    │
└─────────────────────────────────────────────────────────────────────────┘

After Registration:
  ┌────────────────────────────────────────┐
  │ id: UUID                               │
  │ user_id: UUID (ref to app_users)       │
  │ token_hash: "abc123def456..." (SHA256) │
  │ expires_at: NOW() + 24 hours           │
  │ verified_at: NULL ← Not used yet       │
  │ created_at: NOW()                      │
  └────────────────────────────────────────┘
         (Email sent with raw token)
              │
              ▼ User clicks link
  
After Email Verification:
  ┌────────────────────────────────────────┐
  │ id: UUID (same)                        │
  │ user_id: UUID (same)                   │
  │ token_hash: "abc123def456..." (same)   │
  │ expires_at: NOW() + 24h (same)         │
  │ verified_at: NOW() ← Token used!       │
  │ created_at: ... (same)                 │
  └────────────────────────────────────────┘
         (Token becomes invalid)
              │
              ▼ Any future attempt with same token
              │ will be rejected (verified_at IS NOT NULL)
```

## Security Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TOKEN SECURITY FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

Raw Token Generation (Backend Only):
  crypto.randomBytes(32) → "abc123def456xyz789..."
              │
              ├─ Send to user via email → "https://domain.com/verify?token=abc123..."
              │
              └─ Hash with SHA-256 → "f3a1b2c3d4e5f6g7..."
                   │
                   └─ Store in database ← Only hash stored!

Token Verification Flow:
  User clicks email link with raw token
              │
              ▼
  Browser sends: GET /verify?token=abc123...
              │
              ▼ Backend receives
  Backend hashes received token with SHA-256
              │
              ▼ "f3a1b2c3d4e5f6g7..."
              │
              ▼ SELECT FROM tokens WHERE token_hash = "f3a1b2c3d4e5f6g7..."
              │
        ┌─────┴──────┐
        │            │
    FOUND        NOT FOUND
        │            │
        ▼            ▼
   Check:        Invalid
   - expires_at   token
   - verified_at
        │
    ┌───┴────┐
    │        │
  VALID   INVALID
    │        │
    ▼        ▼
 Verify    Reject
 User      (403)
```

## Sequence Diagram

```
User                    Browser              Backend                Database
  │                        │                    │                      │
  ├─ Open register ────────→│                    │                      │
  │                        │─ GET /register ───→│                      │
  │                        │                    │─ Load page           │
  │                        │←─── page HTML ─────│                      │
  │                        │                    │                      │
  ├─ Fill form            │                    │                      │
  ├─ Click "Create Acct"──→│─ POST /register ──→│                      │
  │                        │                    ├─ Validate input      │
  │                        │                    ├─ Hash password       │
  │                        │                    │                      │
  │                        │                    ├─ INSERT user ───────→│
  │                        │                    │←────── user_id ──────┤
  │                        │                    │                      │
  │                        │                    ├─ Generate token      │
  │                        │                    ├─ Hash token          │
  │                        │                    │                      │
  │                        │                    ├─ INSERT token ──────→│
  │                        │                    │←─ token_id           │
  │                        │                    │                      │
  │                        │                    ├─ Send email          │
  │                        │                    │ (no session)         │
  │                        │                    │                      │
  │                        │←── success page ───│                      │
  │                        │                    │                      │
  ├─ See success screen   │                    │                      │
  ├─ Check email ─────────→ [EMAIL RECEIVED]  │                      │
  │                        │                    │                      │
  ├─ Click verify link ───→│                    │                      │
  │                        │─ GET /verify?token→│                      │
  │                        │                    ├─ Hash token          │
  │                        │                    │                      │
  │                        │                    ├─ SELECT token ──────→│
  │                        │                    │←─ token record       │
  │                        │                    │                      │
  │                        │                    ├─ Check expires_at    │
  │                        │                    ├─ Check verified_at   │
  │                        │                    │                      │
  │                        │                    ├─ UPDATE user ──────→│
  │                        │                    │  email_verified=TRUE │
  │                        │                    │                      │
  │                        │                    ├─ UPDATE token ─────→│
  │                        │                    │  verified_at=NOW()   │
  │                        │                    │                      │
  │                        │                    ├─ Create session      │
  │                        │                    ├─ Set httpOnly cookie │
  │                        │                    │                      │
  │                        │←─ success + cookie │                      │
  │                        │                    │                      │
  │                        │ (auto-redirect)    │                      │
  │                        │─ GET /dashboard ──→│                      │
  │                        │                    ├─ Verify session      │
  │                        │←── dashboard ──────│                      │
  │                        │                    │                      │
  ├─ 🎉 Logged in!        │                    │                      │
```

---

**Key Takeaway**: User can only log in after clicking the verification link, which marks `email_verified = TRUE` in the database.

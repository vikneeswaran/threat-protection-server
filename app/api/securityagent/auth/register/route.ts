// Import required modules for API handling, password hashing, and database operations.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

// API endpoint to register a new user with validation, password encryption, duplicate checks, and database insertion.
export async function POST(request: NextRequest) {
  try {
   
    // Extract registration details from the incoming request body.
    const body = await request.json();

    const {
      fullName,
      companyName,
      email,
      phoneNumber,
      password,
      licenceType,
    } = body;

    console.log("Register Request:", body);

    // Normalize user input by trimming spaces and converting email to lowercase.
    const cleanedEmail = email?.trim().toLowerCase();

    const cleanedCompanyName = companyName
      ?.trim()
      .replace(/\s+/g, " ");

    const cleanedFullName = fullName
      ?.trim()
      .replace(/\s+/g, " ");

    const cleanedPhoneNumber = phoneNumber?.trim();
    // Check existing user


    // Check if email or company name already exists to prevent duplicate registrations.
    const [existingUser, existingCompany] = await Promise.all([
  query(
    `
    SELECT id
    FROM app_users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
    `,
    [cleanedEmail]
  ),

  query(
    `
    SELECT id
    FROM app_users
    WHERE LOWER(TRIM(company_name)) = LOWER(TRIM($1))
    `,
    [cleanedCompanyName]
  ),
]);

// Return error response if email is already registered.
if (existingUser.rows.length > 0) {
  return NextResponse.json(
    {
      success: false,
      message: "Email already registered.",
    },
    { status: 400 }
  );
}

if (existingCompany.rows.length > 0) {
  return NextResponse.json(
    {
      success: false,
      message: "Company name already registered.",
    },
    { status: 400 }
  );
}

    // Encrypt user password before storing it in the database.
    const passwordHash = await bcrypt.hash(password, 10);
// Generate one User ID
const userIdResult = await query(
  `SELECT gen_random_uuid() AS id`
);
// Insert into accounts
const accountResult = await query(
  `
  INSERT INTO accounts
  (
      id,
      name,
      level,
      total_licenses,
      allocated_licenses,
      used_licenses,
      is_active
  )
  VALUES
  (
      gen_random_uuid(),
      $1,
      1,
      2,
      0,
      0,
      true
  )
  RETURNING id
  `,
  [
    cleanedCompanyName,
  ]
);

const accountId = accountResult.rows[0].id;
console.log("Account Result:", accountResult.rows);
console.log("Account ID:", accountId);
const userId = userIdResult.rows[0].id;

// Insert into app_users
await query(
  `
  INSERT INTO app_users
  (
    id,
    email,
    full_name,
    company_name,
    phone_number,
    password_hash,
    licence_type,
    email_verified,
    is_active
  )
  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    false,
    true
  )
  `,
  [
    userId,
    cleanedEmail,
    cleanedFullName,
    cleanedCompanyName,
    cleanedPhoneNumber || null,
    passwordHash,
    licenceType,
  ]
);
console.log("User ID:", userId);
console.log("Profile Account ID:", accountId);

// Insert into profiles
await query(
  `
  INSERT INTO profiles
  (
    id,
    account_id,
    email,
    full_name,
    role,
    is_active
  )
  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    'viewer',
    true
  )
  `,
  [
    userId,
    accountId,
    cleanedEmail,
    cleanedFullName,
]
);
    

    // Return success response after completing user registration.
    return NextResponse.json({
      success: true,
      message: "Registration successful.",
    });
    
    // Handle unexpected errors and return registration failure response.
  } catch (error) {
    console.error("Register Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Registration failed.",
      },
      { status: 500 }
    );
  }
}
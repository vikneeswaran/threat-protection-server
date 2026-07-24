// Import required modules for API handling, password hashing, and database operations.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { ensureLocalAuthSchema } from "@/lib/auth/bootstrap";

// API endpoint to register a new user with validation, password encryption, duplicate checks, and database insertion.
export async function POST(request: NextRequest) {
  try {
await ensureLocalAuthSchema();   
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

    console.info("Register Request:", body);

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
// Database columns for user registration
const insertColumns = [
  "email",
  "full_name",
  "company_name",
  "phone_number",
  "password_hash",
  "licence_type",
];

// Generate SQL placeholders: $1, $2, $3...
const placeholders = insertColumns
  .map((_, index) => `$${index + 1}`)
  .join(", ");
   // Insert new user registration details into the app_users table.
    await query(
      `
      INSERT INTO app_users
      (
        ${insertColumns.join(",\n        ")}
      )
      VALUES
      (
        ${placeholders}
      )
      `,
       [
        cleanedEmail,
        cleanedFullName,
        cleanedCompanyName,
        cleanedPhoneNumber || null,
        passwordHash,
        licenceType,
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
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
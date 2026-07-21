

// import { NextRequest, NextResponse } from "next/server";

// import {
//   generateVerificationToken,
//   getVerificationEmailTemplate,
//   getVerificationEmailPlainText,
// } from "@/lib/email/verification";


// import { sendVerificationEmail } from "@/lib/email/send";

// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();

//     const {
//       fullName,
//       companyName,
//       phoneNumber,
//       email,
//       password,
//       licenseType,
//     } = body;

//     console.log("Register Request:", body);
// console.log({
//   phoneNumber,
//   password,
//   licenseType,
// });
//     // Generate verification token
//     const { token, tokenHash } = generateVerificationToken();

//     // TODO:
//     // Save user in database
//     // Save tokenHash in database
//     // Hash password before saving

//     const verificationLink =
//       `${process.env.NEXT_PUBLIC_APP_URL}/securityAgent/auth/verify?token=${token}`;

//     const htmlTemplate = getVerificationEmailTemplate(
//       verificationLink,
//       fullName,
//       companyName || "Organization"
//     );

//     const textTemplate = getVerificationEmailPlainText(
//       verificationLink,
//       fullName,
//       companyName || "Organization"
//     );

//     // await sendVerificationEmail(
//     //   email,
//     //   fullName,
//     //   companyName || "Organization",
//     //   verificationLink,
//     //   htmlTemplate,
//     //   textTemplate
//     // );

//     return NextResponse.json({
//       success: true,
//       message: "Registration successful. Please check your email.",
//     });
//   } catch (error) {
//     console.error("Register Error:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Registration failed.",
//       },
//       { status: 500 }
//     );
//   }
// }



import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { query } from "@/lib/db";
import { ensureLocalAuthSchema } from "@/lib/auth/bootstrap";

// import {
//   generateVerificationToken,
//   getVerificationEmailTemplate,
//   getVerificationEmailPlainText,
// } from "@/lib/email/verification";

// import { sendVerificationEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  try {
    try {
      await ensureLocalAuthSchema();
    } catch (bootstrapError) {
      console.warn("Auth schema bootstrap warning:", bootstrapError);
    }

    const body = await request.json();

    const {
      fullName,
      companyName,
      phoneNumber,
      email,
      password,
      licenceType,
    } = body;

    console.info("Register Request:", body);

    // Check existing user
    const existingUser = await query(
      `SELECT id FROM app_users WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Email already registered.",
        },
        { status: 400 }
      ); 
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const columnsResult = await query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'app_users'
      `
    );

    const availableColumns = new Set(
      columnsResult.rows.map((row) => row.column_name)
    );

    if (!availableColumns.has("email") || !availableColumns.has("password_hash")) {
      throw new Error("app_users schema is missing required columns (email/password_hash)");
    }

    const payloadByColumn: Record<string, unknown> = {
      email,
      full_name: fullName,
      company_name: companyName,
      phone_number: phoneNumber,
      password_hash: passwordHash,
      licence_type: licenceType ? Number(licenceType) : null,
      email_verified: false,
      is_active: true,
    };

    const insertColumns = Object.keys(payloadByColumn).filter((columnName) =>
      availableColumns.has(columnName)
    );

    const insertValues = insertColumns.map(
      (columnName) => payloadByColumn[columnName]
    );

    const placeholders = insertColumns
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    // Store user in database
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
      insertValues
    );

    // Generate verification token
 //   const { token } = generateVerificationToken();

    // const verificationLink =
    //   `${process.env.NEXT_PUBLIC_APP_URL}/securityAgent/auth/verify?token=${token}`;

    // const htmlTemplate = getVerificationEmailTemplate(
    //   verificationLink,
    //   fullName,
    //   companyName || "Organization"
    // );

    // const textTemplate = getVerificationEmailPlainText(
    //   verificationLink,
    //   fullName,
    //   companyName || "Organization"
    // );

    // await sendVerificationEmail(
    //   email,
    //   fullName,
    //   companyName || "Organization",
    //   verificationLink,
    //   htmlTemplate,
    //   textTemplate
    // );

    return NextResponse.json({
      success: true,
      message: "Registration successful.",
    });

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
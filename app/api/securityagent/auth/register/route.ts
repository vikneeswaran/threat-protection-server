import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { query } from "@/lib/db";

// import {
//   generateVerificationToken,
//   getVerificationEmailTemplate,
//   getVerificationEmailPlainText,
// } from "@/lib/email/verification";

// import { sendVerificationEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  try {
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

 const cleanedEmail = email?.trim().toLowerCase();

    const cleanedCompanyName = companyName
      ?.trim()
      .replace(/\s+/g, " ");

    const cleanedFullName = fullName
      ?.trim()
      .replace(/\s+/g, " ");

    const cleanedPhoneNumber = phoneNumber?.trim();
    // Check existing user



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






//     const existingUser = await query(
//       `SELECT id FROM app_users WHERE email = $1`,
//       [email]
//     );

//     if (existingUser.rows.length > 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Email already registered.",
//         },
//         { status: 400 }
//       ); 
//     }
// const existingCompany = await query(
//       `
//       SELECT id
//       FROM app_users
//       WHERE LOWER(TRIM(company_name)) = LOWER(TRIM($1))
//       `,
//       [cleanedCompanyName]
//     );

//     if (existingCompany.rows.length > 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Company name already registered.",
//         },
//         { status: 400 }
//       );
//     }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Store user in database
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
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        false,
        true
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
      },
      { status: 500 }
    );
  }
}
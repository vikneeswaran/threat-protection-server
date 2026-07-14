

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
      phoneNumber,
      email,
      password,
      licenceType,
    } = body;

    console.log("Register Request:", body);

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

    // Store user in database
// Store user in database
try {
  const result = await query(
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
    RETURNING *;
    `,
    [
      email,
      fullName,
      companyName,
      phoneNumber,
      passwordHash,
      licenceType,
    ]
  );

  console.log("Inserted User:", result.rows[0]);
} catch (err) {
  console.error("INSERT ERROR:", err);
  throw err;
}
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
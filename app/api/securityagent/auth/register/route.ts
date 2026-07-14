
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

import {
  
  getVerificationEmailTemplate,
  getVerificationEmailPlainText,
} from "@/lib/email/verification";
import { query } from "@/lib/db";

//import { sendVerificationEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  try {
    // Read request body
    const body = await request.json();

    const { fullName, companyName, email } = body;

    console.log("Register Request:", body);

    // Generate verification token
    //const { token } = generateVerificationToken();

    // Create verification link
    //const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL}/securityAgent/auth/verify?token=${token}`;

    // Generate email templates
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

    // Uncomment this after SMTP is configured
    
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
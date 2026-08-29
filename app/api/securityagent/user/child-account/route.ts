import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getInstallationToken } from "@/lib/installation-token";
import { getPool } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/session";

function getLicenceType(licenses: number): number {
  if (licenses >= 1 && licenses <= 50) {
    return 2;
  }

  if (licenses >= 51 && licenses <= 100) {
    return 3;
  }

  if (licenses >= 101 && licenses <= 500) {
    return 4;
  }

  if (licenses >= 501) {
    return 5;
  }

  return 0;
}

export async function POST(request: Request) {
  const pool = getPool();
  const client = await pool.connect();

  let transactionStarted = false;

  try {
    // -----------------------------------
    // 1. Identify logged-in user
    // -----------------------------------

    const user = await requireSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // -----------------------------------
    // 2. Read request data
    // -----------------------------------

    const body = await request.json();

    const {
      fullName,
      email,
      password,
      confirmPassword,
      licenses,
    } = body;

    const cleanedFullName = String(fullName || "")
      .trim()
      .replace(/\s+/g, " ");

    const cleanedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const requestedLicenses = Number(licenses);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(cleanedEmail)) {
  return NextResponse.json(
    {
      success: false,
      message: "Please enter a valid email address.",
    },
    { status: 400 }
  );
}

    // -----------------------------------
    // 3. Validate input
    // -----------------------------------

    if (
      !cleanedFullName ||
      !cleanedEmail ||
      !password ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Full name, email, password and confirm password are required.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Password and confirm password do not match.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(requestedLicenses) ||
      requestedLicenses <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid number of licenses.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------
    // 4. Determine licence type
    // -----------------------------------

    const licenceType = getLicenceType(requestedLicenses);

    if (licenceType === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid license allocation.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------
    // 5. Check duplicate email
    // -----------------------------------

    const existingUser = await client.query(
      `
        SELECT id
        FROM app_users
        WHERE LOWER(TRIM(email)) = $1
        LIMIT 1
      `,
      [cleanedEmail]
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

    // -----------------------------------
    // 6. Start transaction
    // -----------------------------------

    await client.query("BEGIN");
    transactionStarted = true;

    // -----------------------------------
    // 7. Get parent account
    //
    // The logged-in user's account is
    // the parent account for the new child.
    //
    // FOR UPDATE prevents simultaneous
    // requests from allocating the same
    // available licenses.
    // -----------------------------------

    const parentResult = await client.query(
      `
        SELECT
          id,
          name,
          level,
          total_licenses,
          allocated_licenses,
          used_licenses,
          available_licenses,
          is_active
        FROM accounts
        WHERE id = $1
          AND is_active = TRUE
        FOR UPDATE
      `,
      [user.account_id]
    );

    if (parentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          message: "Parent account not found.",
        },
        { status: 404 }
      );
    }

    const parentAccount = parentResult.rows[0] as Record<string, unknown>;

    // -----------------------------------
    // 8. Check maximum hierarchy level
    // -----------------------------------

    const parentLevel =
      Number(parentAccount.level);

    const childLevel =
      parentLevel + 1;

    if (childLevel > 5) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return NextResponse.json(
        {
          success: false,
          message:
            "Maximum account hierarchy level reached. Level 5 accounts cannot create another child account.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------
// 9. Calculate license allocation
//
// NEW BUSINESS RULE:
//
// The account can use all licenses currently
// allocated to it.
//
// When this account creates a child:
//
// 1. The child cannot receive more than
//    50% of this parent's TOTAL licenses.
//
// 2. The child cannot receive more than
//    this parent's CURRENT AVAILABLE licenses.
//
// Therefore:
//
// maxChildLicenses = MIN(
//   50% of parent's total,
//   parent's available
// )
//
// Available = allocated - used
//
// This same logic applies recursively to
// every child account that becomes a parent.
// -----------------------------------

const totalLicenses =
  Number(parentAccount.total_licenses || 0);

const allocatedLicenses =
  Number(parentAccount.allocated_licenses || 0);

const usedLicenses =
  Number(parentAccount.used_licenses || 0);

// Current licenses available to this parent
const availableLicenses =
  Number(parentAccount.available_licenses || 0);

// Maximum this parent can give to THIS child.
// This is 50% of the parent's total licenses.
const maxBy50Percent = Math.floor(
  totalLicenses * 0.5
);

// The parent cannot give more than what is
// currently available.
const maxChildLicenses = Math.min(
  maxBy50Percent,
  availableLicenses
);
    // -----------------------------------
// 10. Validate requested licenses
// -----------------------------------

if (maxChildLicenses <= 0) {
  await client.query("ROLLBACK");
  transactionStarted = false;

  return NextResponse.json(
    {
      success: false,
      message:
        "No licenses are available to allocate to a child account.",
      availableLicenses,
      maxChildLicenses: 0,
      parentTotalLicenses: totalLicenses,
      parentAllocatedLicenses: allocatedLicenses,
      parentUsedLicenses: usedLicenses,
    },
    { status: 400 }
  );
}

if (requestedLicenses > maxChildLicenses) {
  await client.query("ROLLBACK");
  transactionStarted = false;

  return NextResponse.json(
    {
      success: false,
      message:
        `You can allocate a maximum of ${maxChildLicenses} ` +
        `license(s) to this child account.`,
      requestedLicenses,
      maxChildLicenses,
      availableLicenses,
      parentTotalLicenses: totalLicenses,
      parentAllocatedLicenses: allocatedLicenses,
      parentUsedLicenses: usedLicenses,
    },
    { status: 400 }
  );
}

    // -----------------------------------
    // 11. Hash child password
    // -----------------------------------

    const passwordHash =
      await bcrypt.hash(password, 10);

// -----------------------------------
// 12. Create NEW child account
// -----------------------------------
//
// The child receives exactly the number
// of licenses requested by the parent.
//
// No 50% split is performed here.
//
// The 50% rule is only used to validate
// how many licenses the parent can give
// to THIS child.
// -----------------------------------

const accountResult = await client.query(
  `
  INSERT INTO accounts
  (
    id,
    name,
    parent_account_id,
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
    $2,
    $3,
    $4,
    $4,
    0,
    TRUE
  )
  RETURNING id
  `,
  [
    cleanedFullName,
    parentAccount.id,
    childLevel,
    requestedLicenses,
  ]
);

// -----------------------------------
// 13. Reduce parent's allocated licenses
// -----------------------------------
//
// The parent has transferred
// requestedLicenses to the child.
//
// Therefore the parent's remaining
// allocated licenses decrease.
//
// Example:
//
// Parent before:
// Total     = 500
// Allocated = 500
// Used      = 0
//
// Parent gives child = 200
//
// Parent after:
// Total     = 500
// Allocated = 300
// Used      = 0
//
// Available = 300
// -----------------------------------

await client.query(
  `
  UPDATE accounts
  SET
    allocated_licenses =
      allocated_licenses - $1,
    updated_at = NOW()
  WHERE id = $2
  `,
  [
    requestedLicenses,
    parentAccount.id,
  ]
);


    // -----------------------------------
    // 14. Get child account ID
    // -----------------------------------

    const childAccountId =
      (accountResult.rows[0] as Record<string, unknown>).id;

    // -----------------------------------
    // 15. Create / retrieve installation
    // token for child account
    // -----------------------------------

    const childInstallationToken =
      await getInstallationToken(
        childAccountId as string
      );

    console.info(
      "Child Account ID:",
      childAccountId
    );

    console.info(
      "Child Installation Token:",
      childInstallationToken
    );

    // -----------------------------------
    // 16. Create child app_users record
    // -----------------------------------

    const userResult =
      await client.query(
        `
          INSERT INTO app_users
          (
            id,
            email,
            full_name,
            company_name,
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
            FALSE,
            TRUE
          )
          RETURNING id
        `,
        [
          cleanedEmail,
          cleanedFullName,
          (parentAccount.name as string),
          passwordHash,
          licenceType,
        ]
      );

    const childUserId =
      (userResult.rows[0] as Record<string, unknown>).id;

    // -----------------------------------
    // 17. Create child profile
    // -----------------------------------

    await client.query(
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
          TRUE
        )
      `,
      [
        childUserId,
        childAccountId,
        cleanedEmail,
        cleanedFullName,
      ]
    );

  

    // -----------------------------------
    // 18. Commit transaction
    // -----------------------------------

    await client.query("COMMIT");
    transactionStarted = false;

    

    // -----------------------------------
    // 20. Return success
    // -----------------------------------

    return NextResponse.json(
      {
        success: true,

        message:
          "Child account created successfully.",

      account: {
   id: childAccountId,

   name: cleanedFullName,

   parentAccountId:
     parentAccount.id,

   level: childLevel,

   totalLicenses:
     requestedLicenses,

   allocatedLicenses:
     requestedLicenses,

   usedLicenses: 0,

   availableLicenses:
     requestedLicenses,

   maxChildAllocation:
     Math.floor(requestedLicenses * 0.5),

   licenceType,
},

         user: {
           id: childUserId,

           fullName:
             cleanedFullName,

           email:
             cleanedEmail,

           companyName:
             parentAccount.name,
         },

         installation: {
           installationToken:
             childInstallationToken,
         },
       
 parent: {
   accountId:
     parentAccount.id,

   totalLicenses:
     totalLicenses,

   previousAllocatedLicenses:
     allocatedLicenses,

   usedLicenses:
     usedLicenses,

   previousAvailableLicenses:
     availableLicenses,

   allocatedToChild:
     requestedLicenses,

   remainingAllocatedLicenses:
     allocatedLicenses -
     requestedLicenses,

   remainingAvailableLicenses:
     Math.max(
       availableLicenses -
         requestedLicenses,
       0
     ),
},
       },
{ status: 201 }
);
 } catch (error) {
     // -----------------------------------
     // Rollback if anything fails
     // -----------------------------------

     if (transactionStarted) {
       try {
         await client.query("ROLLBACK");
       } catch (rollbackError) {
         console.error(
           "Rollback failed:",
           rollbackError
         );
       }
     }

     console.error(
       "Create Child Account Error:",
       error
     );

     return NextResponse.json(
       {
         success: false,

         message:
           "Failed to create child account.",

         error:
           error instanceof Error
             ? error.message
             : String(error),
       },
       { status: 500 }
     );
   } finally {
     // Release database connection
     client.release();
   }
}
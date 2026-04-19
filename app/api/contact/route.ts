import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/send"

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const firstName = String(body?.firstName || "").trim()
    const email = String(body?.email || "").trim().toLowerCase()
    const message = String(body?.message || "").trim()

    if (!firstName || !email || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    if (message.length < 5 || message.length > 5000) {
      return NextResponse.json({ error: "Message must be between 5 and 5000 characters" }, { status: 400 })
    }

    const targetEmail = process.env.CONTACT_INBOX_EMAIL || "contact@kuaminisystems.com"
    const safeName = escapeHtml(firstName)
    const safeEmail = escapeHtml(email)
    const safeMessage = escapeHtml(message)

    await sendEmail({
      to: targetEmail,
      subject: `New Contact Inquiry from ${firstName}`,
      replyTo: email,
      htmlBody: `
        <h2>New Inquiry from Kuamini Contact Page</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space: pre-wrap; font-family: inherit;">${safeMessage}</pre>
      `,
      textBody: `New Inquiry from Kuamini Contact Page\n\nName: ${firstName}\nEmail: ${email}\n\nMessage:\n${message}`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error("Contact inquiry error:", detail)
    return NextResponse.json({ error: "Failed to send inquiry" }, { status: 500 })
  }
}

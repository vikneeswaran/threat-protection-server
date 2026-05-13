"use client"

import type React from "react"


import { useState } from "react"

export function Footer() {

  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [resultType, setResultType] = useState<"success" | "error" | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResultMessage(null)
    setResultType(null)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit inquiry")
      }
      setEmail("")
      setResultType("success")
      setResultMessage("Thank you. Your inquiry has been sent.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit inquiry"
      setResultType("error")
      setResultMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <footer className="bg-[#36344d] text-white py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">About</h3>
            <p className="text-gray-300 text-sm">Your trusted partner in technology solutions.</p>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 uppercase text-sm tracking-wider">Contact</h3>
            <div className="space-y-2 text-gray-300 text-sm">
              <p>+91 7829910997</p>
              <p>contact@kuaminisystems.com</p>
            </div>
          </div>

          {/* Newsletter Section */}
          <div>
            <p className="text-sm text-gray-300 mb-3">Enter your email address</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email here"
                className="w-full px-4 py-2 rounded-md bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#673de6]"
                required
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-2 bg-[#8c85ff] hover:bg-[#673de6] text-white text-sm font-medium rounded-md transition-colors"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Connect With Us"}
              </button>
              {resultMessage && (
                <p className={`text-sm ${resultType === "success" ? "text-green-300" : "text-red-300"}`}>{resultMessage}</p>
              )}
            </form>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-600 text-center text-gray-400 text-sm">
          © 2025. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

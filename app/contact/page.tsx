"use client"

import type React from "react"

import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"
import { useState } from "react"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    email: "",
    message: "",
  })
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
        body: JSON.stringify(formData),
      })

      const payload = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit inquiry")
      }

      setFormData({ firstName: "", email: "", message: "" })
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
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Contact Section */}
      <section className="py-16 bg-white flex-1">
        <div className="container mx-auto px-6">
          <h1 className="text-4xl font-semibold text-gray-800 mb-4 text-center">Contact Kuamini Systems</h1>
          <p className="text-gray-600 text-center mb-12">Get in touch with Kuamini Systems Private Limited.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center">
            {/* Contact Form */}
            <div className="bg-gray-50 p-8 rounded-lg">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Enter your first name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#673de6] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Email Address*</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter your email address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#673de6] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Message*</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Type your message here"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#673de6] focus:border-transparent resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-[#8c85ff] hover:bg-[#673de6] text-white font-medium rounded-md transition-colors"
                >
                  {isSubmitting ? "Sending..." : "Submit Your Inquiry"}
                </button>

                {resultMessage && (
                  <p className={`text-sm ${resultType === "success" ? "text-green-600" : "text-red-600"}`}>{resultMessage}</p>
                )}
              </form>
            </div>

            {/* Image */}
            <div>
              <img src="/professional-workspace-monitors-neon-lights-purple.jpg" alt="Contact us" className="w-full rounded-lg shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

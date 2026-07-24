"use client"

import React from 'react';
import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"

// Login page for Security Agent authentication with API integration and user validation.
export default function SecurityAgentLoginPage() {
  const router = useRouter()

  // Store user input values and login process states.
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

   // Handle login submission, API request, error handling, and dashboard redirect.
   const handleSignIn = (event: FormEvent<globalThis.HTMLFormElement>) => {
    event.preventDefault()
    void (async () => {
      setErrorMessage("")
      setIsSubmitting(true)

      try {

    // Send email and password credentials to login API endpoint.
    const response = await fetch("/api/securityagent/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        })

        const result = await response.json()

        // Display login error message when authentication fails.
        if (!response.ok) {
          setErrorMessage(result?.error || "Invalid email or password")
          return
        }

        // Redirect user to Security Agent dashboard after successful login.
        router.push("/securityAgent/dashboard")
        
      // Handle network or unexpected errors during login process.
      } catch {
        setErrorMessage("Unable to sign in right now. Please try again.")

      // Enable login button after API request completion.
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  // Render login form with email, password fields, validation message, and submit button.
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-16 flex-1">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto bg-white/10 border border-white/20 rounded-xl p-8 backdrop-blur-sm">
            <h1 className="text-3xl font-semibold mb-2 text-center">Login</h1>
            <p className="text-gray-300 text-sm text-center mb-8">Access your Kuamini Security Agent console</p>

            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="block text-sm text-gray-200 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>

              {/* // Show error message if login request fails. */}
              {errorMessage ? <p className="text-sm text-red-300">{errorMessage}</p> : null}
              
              {/* // Submit login credentials and display loading status during authentication. */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-[#2f1c6a] font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="text-sm text-gray-300 mt-6 text-center">
              New here?{" "}
              <a href="/securityAgent/auth/register" className="text-white underline">
                Create an account
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )

}

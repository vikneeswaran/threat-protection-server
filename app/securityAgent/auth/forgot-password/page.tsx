"use client";

import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { forgotPassword } from "@/app/services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!email) {
      return toast.error("Email is required");
    }
    

    try {
      setLoading(true);

      const response = await forgotPassword({
        email,
      });

      toast.success(
        response.data.message ||
          "Password reset link sent to your email."
      );

      setEmail("");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Failed to send reset link.";
      toast.error(
        message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />

      <div className="min-h-screen flex items-center justify-center bg-[#2f1c6a]">
        <div className="w-[420px] bg-white rounded-lg shadow-lg p-8">

          <h1 className="text-3xl font-bold text-center mb-2">
            Forgot Password
          </h1>

          <p className="text-center text-gray-500 mb-6">
            Enter your email address.
          </p>

          <form
            onSubmit={handleForgotPassword}
            className="space-y-5"
          >
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full border rounded-lg p-3"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2f1c6a] text-white rounded-lg py-3"
            >
              {loading
                ? "Sending..."
                : "Send Reset Link"}
            </button>
          </form>

          <p className="text-center mt-6">
            <Link
              href="/securityAgent/auth/login"
              className="text-blue-600"
            >
              Back to Login
            </Link>
          </p>

        </div>
      </div>
    </>
  );
}
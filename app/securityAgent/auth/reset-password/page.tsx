"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { resetPassword } from "@/app/services/authService";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!password) {
      return toast.error("Password is required");
    }

    if (password.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }

    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (!token) {
      return toast.error("Invalid or expired reset link");
    }

    try {
      setLoading(true);

      const response = await resetPassword({
        token,
        password,
      });

      toast.success(
        response.data.message ||
          "Password reset successfully."
      );

      setTimeout(() => {
        router.push("/securityAgent/auth/login");
      }, 2000);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Unable to reset password."
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
            Reset Password
          </h1>

          <p className="text-center text-gray-500 mb-6">
            Enter your new password.
          </p>

          <form
            onSubmit={handleResetPassword}
            className="space-y-4"
          >
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full border rounded-lg p-3"
            />

            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              className="w-full border rounded-lg p-3"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2f1c6a] text-white rounded-lg py-3"
            >
              {loading
                ? "Updating..."
                : "Reset Password"}
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
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

import { Header } from "@/components/kuamini/header";
import { Footer } from "@/components/kuamini/footer";
import { register } from "@/app/services/authService";

export default function SecurityAgentRegisterPage() {
  const router = useRouter(); 
const [companyName, setCompanyName] = useState("");
const [phoneNumber, setPhoneNumber] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [licenceType, setLicenceType] = useState("");  
const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleRegister = async (event: React.FormEvent) => {
  event.preventDefault();

  if (!fullName || !email || !password || !confirmPassword || !licenceType) {
    return toast.error("Please fill all required fields.");
  }

  if (password !== confirmPassword) {
    return toast.error("Passwords do not match.");
  }

  try {
    setLoading(true);

    const response = await register({
      fullName,
      companyName,
      phoneNumber,
      email,
      password,
      licenceType,
    });

    toast.success(response.data?.message || "Registration successful.");

    router.push("/securityAgent/auth/login");

<<<<<<< Updated upstream
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
        ? (error as { response: { data: { message: string } } }).response.data.message
        : "Registration failed.";
    toast.error(
      message
=======
  } catch (error: any) {
    toast.error(
      error?.response?.data?.message ||
      "Registration failed."
>>>>>>> Stashed changes
    );
  } finally {
    setLoading(false);
  }
};

  return (
    
    <>
      <Toaster position="top-right" />

      <div className="min-h-screen flex flex-col">
        <Header />

        <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-16 flex-1">
          <div className="container mx-auto px-6">
            <div className="max-w-md mx-auto bg-white/10 border border-white/20 rounded-xl p-8 backdrop-blur-sm">

              <h1 className="text-3xl font-semibold text-center mb-2">
                Create Account
              </h1>

              <p className="text-center text-gray-300 mb-8">
                Register for Kuamini Security Agent
              </p>

             <form onSubmit={handleRegister} className="space-y-4">
               <div>
                 <label className="block text-sm text-gray-200 mb-1">Full Name</label>
                <input
  type="text"
  value={fullName}
  onChange={(e) => setFullName(e.target.value)}
  placeholder="Your name"
   required
  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
/>
               </div>

                <div>
                 <label className="block text-sm text-gray-200 mb-1">Email</label>
                 <input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
   required
  placeholder="you@company.com"
  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
/>
               </div>
<div>
  <label className="block text-sm mb-1">
    Company Name
  </label>

  <input
    type="text"
    value={companyName}
    onChange={(e) => setCompanyName(e.target.value)}
    placeholder="ABC Technologies"
     required
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  />
</div>
<div>
  <label className="block text-sm mb-1">
    Phone Number (Optional)
  </label>

  <input
    type="tel"
    value={phoneNumber}
    onChange={(e) => {
      const value = e.target.value.replace(/\D/g, "").slice(0, 10);
      setPhoneNumber(value);
    }}
    maxLength={10}
    inputMode="numeric"
    pattern="[0-9]{10}"
    placeholder="9876543210"
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  />
</div>
                <div>
                  <label className="block text-sm mb-1">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                     required
                    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2"
                  />
                </div>
                <div>
  <label className="block text-sm mb-1">
    Confirm Password
  </label>

  <input
    type="password"
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    placeholder="Confirm Password"
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  />
</div><div>
  <label className="block text-sm mb-1">
    License Type
  </label>

  <select
   value={licenceType}
onChange={(e) => setLicenceType(e.target.value)}
     required
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  >
    <option value="" disabled className="text-gray-900">
                Select License Type
                </option>

                <option value="1">Trial License 1-5</option>
<option value="2">User License 1-50</option>
<option value="3">User License 51-100</option>
<option value="4">User License 101-500</option>
<option value="5">User License 500+</option>
  </select>
</div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-[#2f1c6a] font-semibold py-2.5 rounded-lg"
                >
                  {loading ? "Creating..." : "Create Account"}
                </button>
              </form>

              <p className="text-center mt-6">
                Already have an account?{" "}
                <Link
                  href="/securityAgent/auth/login"
                  className="underline"
                >
                  Login
                </Link>
              </p>

            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
  
}
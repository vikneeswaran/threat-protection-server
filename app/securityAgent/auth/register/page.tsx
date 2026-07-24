"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
// import shared layout components  
import { Header } from "@/components/kuamini/header";
import { Footer } from "@/components/kuamini/footer";
import { register } from "@/app/services/authService";

// Render the Security agent registration page
export default function SecurityAgentRegisterPage() {
    
  // router instance used for navigation after successful registration
    const router = useRouter(); 
   
    // Form input state variables
    const [companyName, setCompanyName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [licenceType, setLicenceType] = useState("");  
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // route state variables for form validation errors
    const [fullNameError, setFullNameError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [companyNameError, setCompanyNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    
    // Track loading state for form submission 
    const [loading, setLoading] = useState(false);
    
    // Regular expression to validate the password policy
    const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>[\]\\/'`~_+=-]).{8,}$/;

    // Submit the registration form after validating user inputs
    const handleRegister = async (event: React.FormEvent) => {

    // Prevent the browser from reloading the page on form submission
    event.preventDefault();

    // Clean and normalize user input before validation and submission
    const cleanedFullName = fullName.trim().replace(/\s+/g, " ");
    const cleanedCompanyName = companyName.trim().replace(/\s+/g, " ");
    const cleanedPhoneNumber = phoneNumber.trim();
    const cleanedPassword = password.trim();
    const cleanedConfirmPassword = confirmPassword.trim();
    const cleanedLicenceType = licenceType.trim();
    const cleanedEmail = email.trim().toLowerCase();
  
  // Validate all required registration fields are filled before submitting the form.
  if (
  !fullName.trim() ||
  !cleanedEmail ||
  !password.trim() ||
  !confirmPassword.trim() ||
  !companyName.trim() ||
  !licenceType.trim()
) {
  return toast.error("Please fill all required fields.");
}

    // Validate email format using regex before submitting the form.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanedEmail)) {
    return toast.error("Please enter a valid email address.");
  }
  
// Validate phone number length to ensure it contains between 10 and 20 digits.
if (
  cleanedPhoneNumber &&
  (cleanedPhoneNumber.length < 10 || cleanedPhoneNumber.length > 20)
) {
  setPhoneError("Phone number must be between 10 and 20 digits.");
  return;
}

// Validate password strength and confirm password match before registration.
if (!passwordRegex.test(cleanedPassword)) {
  return toast.error(
    "Password must be at least 8 characters and contain at least one letter, one number, and one special character."
  );
}
if (cleanedPassword !== cleanedConfirmPassword) {
  return toast.error("Passwords do not match.");
}
  try { 
    
    // Submit registration data to API and handle successful registration response.
    setLoading(true);

  const response = await register({
  fullName: cleanedFullName,
  companyName: cleanedCompanyName,
  phoneNumber: cleanedPhoneNumber,
  email: cleanedEmail,
  password: cleanedPassword,
  licenceType: cleanedLicenceType,
});

    toast.success(
      response.data?.message || "Registration successful."
    );

    // Redirect user to login page after successful registration.
    router.push("/securityAgent/auth/login");


  } catch (error: any) {
    const messages =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { messages?: string } } }).response?.data?.messages === "string"
        ? (error as { response: { data: { messages: string } } }).response.data.messages
        : "Registration failed.";
    toast.error(
      messages

 
    );
  
 
  
  // Handle API errors such as duplicate company name or email registration.
  const message : any  = error?.response?.data?.message;

  if (
    message?.toLowerCase().includes("company") &&
    message?.toLowerCase().includes("already")
  ) {
    setCompanyNameError(
      "This company name is already registered."
    );
  } else if (
    message?.toLowerCase().includes("email") &&
    message?.toLowerCase().includes("already")
  ) {
    setEmailError(
      "This email is already registered."
    );
  } else {
    toast.error(message || "Registration failed.");
  }
} finally {
    
  // Stop loading state after API request completion.
    setLoading(false);
  }

};

  return (
    
    <>
      {/* // Display toast notifications for success and error messages. */}
      <Toaster position="top-right" />

      <div className="min-h-screen flex flex-col">

        {/* // Header and registration page layout container. */}
        <Header />

        {/* // User input fields: name, email, company, phone, password, and license details. */}
        <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-16 flex-1">
          <div className="container mx-auto px-6">
            <div className="max-w-md mx-auto bg-white/10 border border-white/20 rounded-xl p-8 backdrop-blur-sm">

              <h1 className="text-3xl font-semibold text-center mb-2">
                Create Account
              </h1>

              <p className="text-center text-gray-300 mb-8">
                Register for Kuamini Security Agent
              </p>
              {/* // Registration form UI with field validations, error messages, password rules, and account creation handling. */}
             <form onSubmit={handleRegister} className="space-y-4" autoComplete="off">
               <div>
                 <label className="block text-sm text-gray-200 mb-1">Full Name<span className="text-red-400"> * </span></label>
                <input
  type="text"
  value={fullName}
   maxLength={50}
  onChange={(e) => {
    const value = e.target.value
      .replace(/\s+/g, " ")
      .trimStart();

    setFullName(value);
  }}
  onBlur={() => {
    const value = fullName.trim();
    setFullName(value);

    if (!value) {
      setFullNameError("Full name is required.");
    } else {
      setFullNameError("");
    }
  }}
  placeholder="Your name"
  required
  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
/>

{fullNameError && (
  <p className="mt-1 text-sm text-red-400">
    {fullNameError}
  </p>
)}
               </div>

                <div>
                 <label className="block text-sm text-gray-200 mb-1">Email<span className="text-red-400"> * </span></label>
                <input
  type="email"
  value={email}
   maxLength={50}
  onChange={(e) => setEmail(e.target.value)}
  onBlur={() => {
    const cleanedEmail = email.trim().toLowerCase();
    setEmail(cleanedEmail);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanedEmail) {
      setEmailError("Email is required.");
    } else if (!emailRegex.test(cleanedEmail)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }}
  required
  placeholder="you@company.com"
  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
/>

{emailError && (
  <p className="mt-1 text-sm text-red-400">
    {emailError}
  </p>
)}
 </div>
<div>
  <label className="block text-sm mb-1">
    Company Name<span className="text-red-400"> * </span>
  </label>

  <input
    type="text"
    value={companyName}
    maxLength={100}
    onChange={(e) => {
      const value = e.target.value
        .replace(/\s+/g, " ")
        .trimStart();

      setCompanyName(value);

      // Clear previous error when user starts editing
      if (companyNameError) {
        setCompanyNameError("");
      }
    }}
    onBlur={() => {
      const cleanedCompanyName = companyName
        .trim()
        .replace(/\s+/g, " ");

      setCompanyName(cleanedCompanyName);

      if (!cleanedCompanyName) {
        setCompanyNameError("Company name is required.");
      } else {
        setCompanyNameError("");
      }
    }}
    placeholder="ABC Technologies"
    required
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  />

  {companyNameError && (
    <p className="mt-1 text-sm text-red-400">
      {companyNameError}
    </p>
  )}
</div>
<div>
  <label className="block text-sm mb-1">
    Phone Number (Optional)
  </label>

  <input
    type="tel"
    value={phoneNumber}
    onChange={(e) => {
      const value = e.target.value
        .replace(/\D/g, "")
        .slice(0, 20);

      setPhoneNumber(value);

      // Clear error while editing
      if (phoneError) {
        setPhoneError("");
      }
    }}
    onBlur={() => {
      if (phoneNumber.length > 0 && phoneNumber.length < 10) {
        setPhoneError("Phone number must be at least 10 digits.");
      } else {
        setPhoneError("");
      }
    }}
    maxLength={20}
    inputMode="numeric"
    placeholder="9876543210"
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  />

  {phoneError && (
    <p className="mt-1 text-sm text-red-400">
      {phoneError}
    </p>
  )}
</div>
 <div className="relative group">
  <label className="block text-sm mb-1">
    Password<span className="text-red-400"> * </span>
  </label>

  <input
  type="password"
  value={password}
  onChange={(e) => {
    const value = e.target.value;

    setPassword(value);

    if (!value) {
      setPasswordError("Password is required.");
    } else if (!passwordRegex.test(value)) {
      setPasswordError(
        "Password must be at least 8 characters and contain at least one letter, one number, and one special character."
      );
    } else {
      setPasswordError("");
    }
  }}
  autoComplete="new-password"
  placeholder="Enter Password"
  required
  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
/>

{passwordError && (
  <p className="mt-1 text-sm text-red-400">
    {passwordError}
  </p>
)}
</div>
  {/* Password tooltip */}
  <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-full rounded-lg border border-gray-500 bg-gray-600 px-4 py-3 text-[10px] text-gray-100 opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
 <input
  type="password"
  value={confirmPassword}
  onChange={(e) => setConfirmPassword(e.target.value)}
  
  // Password confirmation and matching validation field.
  onBlur={() => {
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password.");
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  }}
  autoComplete="new-password"
  placeholder="Confirm Password"
  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
/>

{confirmPasswordError && (
  <p className="mt-1 text-sm text-red-400">
    {confirmPasswordError}
  </p>
)}
</div>
             
<div>
  <label className="block text-sm mb-1">
    Confirm Password<span className="text-red-400"> * </span>
  </label>

  <input
    type="password"
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    autoComplete="new-password"
    placeholder="Confirm Password"
    className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white"
  />
</div><div>
  <label className="block text-sm mb-1">
    License Type <span className="text-red-400">*</span>
  </label>

  <div className="relative">
    <select
      value={licenceType}
      onChange={(e) => setLicenceType(e.target.value)}
      required
      className="w-full appearance-none rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white focus:outline-none"
    >
      <option value="" disabled className="bg-white text-gray-900">
        Select License Type
      </option>

      <option value="1" className="bg-white text-gray-900">
        Trial License 1-5
      </option>

      <option value="2" className="bg-white text-gray-900">
        User License 1-50
      </option>

      <option value="3" className="bg-white text-gray-900">
        User License 51-100
      </option>

      <option value="4" className="bg-white text-gray-900">
        User License 101-500
      </option>

      <option value="5" className="bg-white text-gray-900">
        User License 500+
      </option>
    </select>

    {/* Custom dropdown arrow */}
    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
      <svg
        className="h-5 w-5 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  </div>
</div>
<div className="flex gap-3">
 
 {/* // Submit registration form and show loading state while creating account. */}
  <button
    type="submit"
    disabled={loading}
    className="w-500 rounded-lg bg-white py-2.5 font-semibold text-[#2f1c6a]"
  >
    {loading ? "Creating..." : "Create Account"}
  </button>

  {/* // Clear all form values and validation errors. */}
  <button
    type="button"
    onClick={() => {
      setFullName("");
      setEmail("");
      setCompanyName("");
      setPhoneNumber("");
      setPassword("");
      setConfirmPassword("");
      setLicenceType("");
      setFullNameError("");
      setEmailError("");
      setCompanyNameError("");
      setPhoneError("");
      setPasswordError("");
      setConfirmPasswordError("");
    }}
    disabled={loading}
    className="w-200 rounded-lg border border-white/30 bg-white/10 py-2.5 font-semibold text-white hover:bg-white/20"
  >
    Clear
  </button>
</div>
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
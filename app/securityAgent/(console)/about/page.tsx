"use client";

import { useEffect, useState } from "react";

type UserDetails = {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  phone_number: number | null;
  licence_type: number;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export default function AboutPage() {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/securityagent/user/about");

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to load user details.");
          return;
        }

        setUser(data);
      } catch {
        setError("Unable to fetch user details.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">About User</h2>
        <p className="text-slate-300">Loading...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">About User</h2>
        <p className="text-red-400">{error}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-6">About User</h2>

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6 space-y-3">
        <p>
          <strong>Full Name:</strong> {user?.full_name}
        </p>

        <p>
          <strong>Email:</strong> {user?.email}
        </p>

        <p>
          <strong>Company:</strong> {user?.company_name}
        </p>

        <p>
          <strong>Phone Number:</strong> {user?.phone_number ?? "-"}
        </p>

        <p>
          <strong>Licence Type:</strong> {user?.licence_type}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          {user?.is_active ? "Active" : "Inactive"}
        </p>

        <p>
          <strong>Created At:</strong> {user?.created_at}
        </p>

        <p>
          <strong>Last Login:</strong>{" "}
          {user?.last_login_at ?? "Never"}
        </p>
      </div>
    </section>
  );
}
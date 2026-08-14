"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds
export default function SessionSecurityGuard() {
  const router = useRouter();

  useEffect(() => {
    console.log("🔐 SessionSecurityGuard started");

    let inactivityTimer: ReturnType<typeof setTimeout>;

    const logout = async () => {
      console.log("⏰ Inactivity timeout reached. Logging out...");

      try {
        const response = await fetch(
          "/api/securityagent/auth/logout",
          {
            method: "POST",
            credentials: "include",
          }
        );

        console.log("Logout API status:", response.status);

        const data = await response.json();

        console.log("Logout API response:", data);
      } catch (error) {
        console.error("❌ Logout API error:", error);
      }

      router.replace("/securityAgent/auth/login");
    };

    const resetInactivityTimer = () => {
      console.log("👆 User activity detected");

      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT);

      console.log("⏱️ Timer reset. Logout in 60 seconds.");
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener(
      "contextmenu",
      handleContextMenu
    );

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);

      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });

      document.removeEventListener(
        "contextmenu",
        handleContextMenu
      );
    };
  }, [router]);

  return null;
}
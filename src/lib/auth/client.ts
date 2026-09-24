"use client";

import { useRouter } from "next/navigation";
import { useEffect, useCallback } from "react";

/** Clear the session cookie (httpOnly) and redirect to login. */
export function useSessionLogout() {
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch {
      // ignore
    }
  }, [router]);

  // Logout on unmount prevention: expose a synchronous logout if needed
  useEffect(() => {
    return () => {
      // Nothing to clean up
    };
  }, []);

  return { logout };
}

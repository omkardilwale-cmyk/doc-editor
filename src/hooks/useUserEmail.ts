"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isValidUserEmail,
  normalizeUserEmail,
  readStoredUserEmail,
  writeStoredUserEmail,
} from "@/lib/auth/userEmail";

export function useUserEmail() {
  const [email, setEmailState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEmailState(readStoredUserEmail());
    setReady(true);
  }, []);

  const setEmail = useCallback((value: string) => {
    const normalized = normalizeUserEmail(value);
    writeStoredUserEmail(normalized);
    setEmailState(normalized);
  }, []);

  return {
    email,
    setEmail,
    ready,
    isValid: isValidUserEmail(email),
  };
}

"use client";

import { useEffect } from "react";
import { useOnRamp } from "@onramp-sdk/react";

interface Props {
  email: string;
  userId?: string | undefined;
}

export function OnRampIdentify({ email, userId }: Props) {
  const { identify } = useOnRamp();

  useEffect(() => {
    if (!email) return;
    identify({ email, ...(userId ? { userId } : {}) });
  }, [email, userId, identify]);

  return null;
}

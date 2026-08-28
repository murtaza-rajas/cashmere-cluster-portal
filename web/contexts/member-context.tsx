"use client";

import { createContext, useContext } from "react";
import type { Member } from "@/lib/api";

const MemberContext = createContext<Member | null>(null);

export function MemberProvider({ member, children }: { member: Member; children: React.ReactNode }) {
  return <MemberContext.Provider value={member}>{children}</MemberContext.Provider>;
}

/** Only valid inside (member)/layout.tsx's subtree — that layout guarantees a member is loaded before rendering children. */
export function useMember(): Member {
  const member = useContext(MemberContext);
  if (!member) {
    throw new Error("useMember() called outside the (member) route group — no member in context");
  }
  return member;
}

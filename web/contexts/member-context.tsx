"use client";

import { createContext, useContext } from "react";
import type { Member } from "@/lib/api";

interface MemberContextValue {
  member: Member;
  // Replaces the loaded member after a change (e.g. a profile save), so pages
  // opened later show the new values without a full reload.
  setMember: (member: Member) => void;
}

const MemberContext = createContext<MemberContextValue | null>(null);

export function MemberProvider({
  member,
  onMemberChange,
  children,
}: {
  member: Member;
  onMemberChange?: (member: Member) => void;
  children: React.ReactNode;
}) {
  return (
    <MemberContext.Provider value={{ member, setMember: onMemberChange ?? (() => undefined) }}>
      {children}
    </MemberContext.Provider>
  );
}

function useMemberContext(): MemberContextValue {
  const value = useContext(MemberContext);
  if (!value) {
    throw new Error("useMember() called outside the (member) route group — no member in context");
  }
  return value;
}

/** Only valid inside (member)/layout.tsx's subtree — that layout guarantees a member is loaded before rendering children. */
export function useMember(): Member {
  return useMemberContext().member;
}

export function useSetMember(): (member: Member) => void {
  return useMemberContext().setMember;
}

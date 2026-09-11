"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Images } from "lucide-react";
import { useStaff, staffHasAnyRole } from "@/contexts/staff-context";

// Honest "coming soon" — Photo Archive needs a real submission + moderation
// queue (members submit photos, staff approve/reject before anything goes
// public), a genuinely new pattern, not something to reuse from elsewhere
// in this app. Not built yet; tracked in PROJECT_TRACKER.md, not guessed at.
export default function MongoliaPhotoArchivePage() {
  const staff = useStaff();
  const router = useRouter();
  const canManage = staffHasAnyRole(staff, ["Content Manager"]);

  useEffect(() => {
    if (!canManage) router.replace("/staff/mongolia");
  }, [canManage, router]);

  if (!canManage) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-cashmere-text">Photo Archive</h1>
        <p className="mt-1 text-cashmere-text-muted">Member-submitted photos from across Mongolia.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cashmere-border bg-white px-6 py-16 text-center">
        <Images size={28} strokeWidth={1.5} className="text-cashmere-text-muted" />
        <p className="font-medium text-cashmere-text">Coming soon</p>
        <p className="max-w-sm text-sm text-cashmere-text-muted">
          Members submitting and staff approving photos needs its own moderation workflow — real, planned, not built yet.
        </p>
      </div>
    </div>
  );
}

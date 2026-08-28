import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  /** The staff member who performed the action. Omit for system-initiated actions (e.g. a Shopify webhook). */
  actorStaffUserId?: string;
  /** e.g. "member.created", "staff.role_granted", "staff.role_revoked" — dot-namespaced, past tense. */
  action: string;
  targetType: string;
  targetId: string;
  /** Convenience denormalization for "show this member's full history" queries — only set when the target is a Member. */
  targetMemberId?: string;
  /** Required for exceptions/deletions per the client's spec; optional for routine actions. */
  reason?: string;
  metadata?: Prisma.InputJsonValue;
}

// Every sensitive administrative action is expected to go through this — see the
// comment at the top of schema.prisma. Kept as a single narrow service (not scattered
// prisma.auditLog.create() calls) so the log format stays consistent and this is the
// one place to extend later (e.g. shipping entries to an external audit sink).
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorStaffUserId: entry.actorStaffUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetMemberId: entry.targetMemberId,
        reason: entry.reason,
        metadata: entry.metadata,
      },
    });
  }
}

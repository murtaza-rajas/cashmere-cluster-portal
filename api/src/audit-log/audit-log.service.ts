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

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export interface FindAuditLogParams {
  action?: string;
  targetType?: string;
  actorStaffUserId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
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

  // Staff-facing read side (the viewer this service never had — AuditLogService
  // was write-only until now, see PROJECT_TRACKER.md). Filters are all optional
  // and AND-ed together; newest first, since that's what anyone reviewing recent
  // activity actually wants first.
  async findAll(params: FindAuditLogParams) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = Math.min(
      params.pageSize && params.pageSize > 0
        ? params.pageSize
        : DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const where: Prisma.AuditLogWhereInput = {
      action: params.action
        ? { contains: params.action, mode: 'insensitive' }
        : undefined,
      targetType: params.targetType || undefined,
      actorStaffUserId: params.actorStaffUserId || undefined,
      createdAt:
        params.from || params.to
          ? { gte: params.from, lte: params.to }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actorStaffUser: { select: { id: true, name: true, email: true } },
          targetMember: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  // Feeds the staff UI's action filter dropdown from real data rather than a
  // hardcoded list that would drift out of sync with whatever action strings
  // actually get logged across the codebase.
  async findDistinctActions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}

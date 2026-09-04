import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DataSubjectRequestStatus, DataSubjectRequestType } from '@prisma/client';

@Injectable()
export class DataSubjectRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Oldest first — these carry a response-time obligation (Shopify's own guidance
  // is up to 30 days), so the queue should surface the longest-waiting ones first.
  findPending() {
    return this.prisma.dataSubjectRequest.findMany({
      where: { status: DataSubjectRequestStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
      include: {
        member: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async complete(params: { id: string; staffUserId: string; reason?: string }) {
    const existing = await this.prisma.dataSubjectRequest.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      throw new NotFoundException('Data subject request not found');
    }
    if (existing.status === DataSubjectRequestStatus.COMPLETED) {
      throw new ConflictException('Already marked completed');
    }

    const updated = await this.prisma.dataSubjectRequest.update({
      where: { id: params.id },
      data: { status: DataSubjectRequestStatus.COMPLETED, completedAt: new Date() },
    });

    await this.auditLog.log({
      actorStaffUserId: params.staffUserId,
      action: 'data_subject_request.completed',
      targetType: 'DataSubjectRequest',
      targetId: updated.id,
      targetMemberId: updated.memberId,
      reason: params.reason,
      metadata: { type: updated.type },
    });

    return updated;
  }

  // A member's own request history — lets the frontend show "request pending
  // since ..." instead of just a blind "request my data" button every time.
  findForMember(memberId: string) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { memberId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // Self-service entry point for a member requesting their own data — until now
  // the only way a DataSubjectRequest ever got created was Shopify's
  // customers/data_request webhook (see shopify-webhooks.service.ts). Scoped to
  // ACCESS only (not DELETION) here: account deletion is already handled by the
  // separate, more deliberate customers/redact webhook flow, and isn't something
  // to expose as a single self-service click without more thought. Idempotent
  // against an existing pending request — a member re-clicking "request my data"
  // shouldn't queue duplicate work for staff.
  async createFromMember(memberId: string) {
    const existing = await this.prisma.dataSubjectRequest.findFirst({
      where: { memberId, type: DataSubjectRequestType.ACCESS, status: DataSubjectRequestStatus.PENDING },
    });
    if (existing) {
      return existing;
    }

    const created = await this.prisma.dataSubjectRequest.create({
      data: { memberId, type: DataSubjectRequestType.ACCESS },
    });

    await this.auditLog.log({
      action: 'member.data_request_created',
      targetType: 'DataSubjectRequest',
      targetId: created.id,
      targetMemberId: memberId,
      metadata: { source: 'member_self_service' },
    });

    return created;
  }
}

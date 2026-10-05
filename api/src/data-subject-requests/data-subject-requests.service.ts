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

    // DELETION is handled differently from ACCESS/EXPORT: completing it must
    // actually erase the member's data, not just flip a status flag. The real
    // erasure webhook (customers/redact) isn't registered against the live
    // store yet (see PROJECT_TRACKER.md) — until it is, this is the only code
    // path that actually deletes anything for a DELETION request. Same erasure
    // logic as ShopifyWebhooksService.handleCustomersRedact (audit log first,
    // then delete the Member row), just staff-triggered instead of Shopify-
    // triggered. The DataSubjectRequest row itself cascades away with the
    // Member it belongs to (schema.prisma) — expected, not a bug: the
    // AuditLog entry below (onDelete: SetNull) is the permanent record once
    // the member no longer exists to reference. Returns a synthetic completed
    // shape, since there's no longer a real row to return.
    if (existing.type === DataSubjectRequestType.DELETION) {
      await this.auditLog.log({
        actorStaffUserId: params.staffUserId,
        action: 'member.redacted',
        targetType: 'Member',
        targetId: existing.memberId,
        targetMemberId: existing.memberId,
        reason: params.reason ?? 'Staff-completed self-service deletion request',
        metadata: {
          source: 'staff_manual_deletion',
          dataSubjectRequestId: existing.id,
        },
      });
      await this.prisma.member.delete({ where: { id: existing.memberId } });
      return {
        id: existing.id,
        memberId: existing.memberId,
        type: existing.type,
        status: DataSubjectRequestStatus.COMPLETED,
        requestedAt: existing.requestedAt,
        completedAt: new Date(),
      };
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
  // customers/data_request webhook (see shopify-webhooks.service.ts). ACCESS only
  // by default (EXPORT stays staff/webhook-only — there's no self-service
  // distinction between "see my data" and "export my data" in the UI).
  //
  // DELETION added as a self-service option 2026-10-03 (client go-ahead) — this
  // just queues a request for staff to action, it never erases anything itself.
  // The actual erasure happens when staff complete() it — see that method for
  // why completing a DELETION request is a real delete, not just a status
  // change. Idempotent per type against an existing pending request — a member
  // re-clicking a request button shouldn't queue duplicate work for staff.
  async createFromMember(
    memberId: string,
    type: typeof DataSubjectRequestType.ACCESS | typeof DataSubjectRequestType.DELETION = DataSubjectRequestType.ACCESS,
  ) {
    const existing = await this.prisma.dataSubjectRequest.findFirst({
      where: { memberId, type, status: DataSubjectRequestStatus.PENDING },
    });
    if (existing) {
      return existing;
    }

    const created = await this.prisma.dataSubjectRequest.create({
      data: { memberId, type },
    });

    await this.auditLog.log({
      action: 'member.data_request_created',
      targetType: 'DataSubjectRequest',
      targetId: created.id,
      targetMemberId: memberId,
      metadata: { source: 'member_self_service', type },
    });

    return created;
  }
}

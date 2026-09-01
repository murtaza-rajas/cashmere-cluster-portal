import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DataSubjectRequestStatus } from '@prisma/client';

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
}

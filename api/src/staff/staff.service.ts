import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findById(id: string) {
    return this.prisma.staffUser.findUniqueOrThrow({ where: { id } });
  }

  /** Role names (e.g. "Club Manager") currently granted to this staff member. */
  async getRoleNames(staffUserId: string): Promise<string[]> {
    const assignments = await this.prisma.staffRoleAssignment.findMany({
      where: { staffUserId },
      include: { role: true },
    });
    return assignments.map((a) => a.role.name);
  }

  async hasAnyRole(
    staffUserId: string,
    allowedRoleNames: string[],
  ): Promise<boolean> {
    const names = await this.getRoleNames(staffUserId);
    return (
      names.includes('Super Administrator') ||
      names.some((n) => allowedRoleNames.includes(n))
    );
  }

  /**
   * Grants one of the 9 fixed role presets to a staff member — this is the
   * "configurable preset" admin action from PROJECT_TRACKER.md Section 3, not a
   * role-creation endpoint (roles themselves are seeded, not user-creatable).
   * Every call writes an AuditLog entry, since staff permission changes are exactly
   * the kind of sensitive administrative action schema.prisma's header comment
   * requires logging.
   */
  async grantRole(params: {
    staffUserId: string;
    roleName: string;
    grantedById: string;
    dataScope?: object;
  }) {
    const staffUser = await this.prisma.staffUser.findUnique({
      where: { id: params.staffUserId },
    });
    if (!staffUser) throw new NotFoundException('Staff user not found');

    const role = await this.prisma.role.findUnique({
      where: { name: params.roleName },
    });
    if (!role)
      throw new NotFoundException(`Role "${params.roleName}" not found`);

    const assignment = await this.prisma.staffRoleAssignment.upsert({
      where: {
        staffUserId_roleId: {
          staffUserId: params.staffUserId,
          roleId: role.id,
        },
      },
      update: {
        dataScope: params.dataScope ?? { scope: 'all' },
        grantedById: params.grantedById,
      },
      create: {
        staffUserId: params.staffUserId,
        roleId: role.id,
        dataScope: params.dataScope ?? { scope: 'all' },
        grantedById: params.grantedById,
      },
    });

    await this.auditLog.log({
      actorStaffUserId: params.grantedById,
      action: 'staff.role_granted',
      targetType: 'StaffUser',
      targetId: params.staffUserId,
      metadata: {
        roleName: role.name,
        dataScope: params.dataScope ?? { scope: 'all' },
      },
    });

    return assignment;
  }

  async revokeRole(params: {
    staffUserId: string;
    roleName: string;
    revokedById: string;
  }) {
    const role = await this.prisma.role.findUnique({
      where: { name: params.roleName },
    });
    if (!role)
      throw new NotFoundException(`Role "${params.roleName}" not found`);

    await this.prisma.staffRoleAssignment.delete({
      where: {
        staffUserId_roleId: {
          staffUserId: params.staffUserId,
          roleId: role.id,
        },
      },
    });

    await this.auditLog.log({
      actorStaffUserId: params.revokedById,
      action: 'staff.role_revoked',
      targetType: 'StaffUser',
      targetId: params.staffUserId,
      metadata: { roleName: role.name },
    });
  }
}

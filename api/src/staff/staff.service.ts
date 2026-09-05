import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Includes role names so every consumer of this (the JWT strategy — which
  // feeds both req.staffUser and GET /staff/me — plus anything else that looks
  // a staff user up by id) gets the same shape as findAll()'s directory rows,
  // rather than a bare StaffUser with no roles a caller might assume are there.
  async findById(id: string) {
    const staffUser = await this.prisma.staffUser.findUniqueOrThrow({
      where: { id },
      include: { roleAssignments: { include: { role: true } } },
    });
    const { roleAssignments, ...rest } = staffUser;
    return { ...rest, roles: roleAssignments.map((a) => a.role.name) };
  }

  // Directory view for Milestone 5's Staff/Roles/Permissions admin area — role
  // names included so the list is actually useful without N+1 follow-up calls.
  async findAll() {
    const staff = await this.prisma.staffUser.findMany({
      orderBy: { createdAt: 'asc' },
      include: { roleAssignments: { include: { role: true } } },
    });
    return staff.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      isActive: s.isActive,
      createdAt: s.createdAt,
      roles: s.roleAssignments.map((a) => a.role.name),
    }));
  }

  /**
   * "Super Administrators create staff accounts" — PDF page 3's own wording for
   * this exact capability, which didn't exist as a real endpoint before (only a
   * dev script). Deliberately does NOT grant any role here — creation and
   * role-granting stay separate steps (matches the PDF's own workflow, Section
   * 11: "Staff access: Requested -> approved by Super Admin -> granted ->
   * reviewed/revoked" — grantRole already exists for the "granted" step).
   */
  async createStaffUser(params: { email: string; name: string; createdById: string }) {
    const existing = await this.prisma.staffUser.findUnique({ where: { email: params.email } });
    if (existing) {
      throw new ConflictException('A staff account with this email already exists');
    }

    const created = await this.prisma.staffUser.create({
      data: { email: params.email, name: params.name },
    });

    await this.auditLog.log({
      actorStaffUserId: params.createdById,
      action: 'staff.created',
      targetType: 'StaffUser',
      targetId: created.id,
      metadata: { email: created.email, name: created.name },
    });

    return created;
  }

  /**
   * All 10 fixed role presets (Super Administrator + the 9 named roles) — lets the
   * admin UI's role-grant control show real seeded roles instead of a hardcoded,
   * driftable copy of the same list.
   */
  findAllRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
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

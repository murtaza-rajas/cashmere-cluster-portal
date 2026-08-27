import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

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
}

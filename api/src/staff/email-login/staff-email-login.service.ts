import { BadRequestException, Injectable } from '@nestjs/common';
import { StaffUser } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  INVALID_CODE,
  LoginCodeService,
  loginCodeEmailHtml,
} from '../../email/login-code.service';
import { StaffAuthService } from '../staff-auth.service';

const ADMIN_NAME = "Cashmere Lovers' Club Admin";

// Staff sign-in with an emailed 6-digit code (2026-10-22) — the real staff
// login replacing preview links. Only active staff accounts (not past their
// expiry date) get a code; everyone else gets the same response and no email.
// The session is the existing staff session (own secret and cookie, 12h).
@Injectable()
export class StaffEmailLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly codes: LoginCodeService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async requestCode(rawEmail: string, ipAddress: string | null): Promise<void> {
    const email = this.codes.normalize(rawEmail);
    const staff = await this.findActiveStaff(email);
    await this.codes.issue({
      purpose: 'staff',
      email,
      ipAddress,
      sendTo: staff?.email ?? null,
      message: {
        subject: 'Your Admin sign-in code',
        text: (code) =>
          `Your Admin sign-in code is ${code}\n\nEnter it on the staff sign-in page within 10 minutes.\n\nIf you didn't ask to sign in, you can ignore this email.\n\n${ADMIN_NAME}`,
        html: (code) => loginCodeEmailHtml(ADMIN_NAME, code),
      },
    });
  }

  // Returns a staff session token on success.
  async verifyCode(rawEmail: string, rawCode: string): Promise<string> {
    const email = this.codes.normalize(rawEmail);
    const markUsed = await this.codes.check('staff', email, rawCode);

    const staff = await this.findActiveStaff(email);
    if (!staff) throw new BadRequestException(INVALID_CODE);

    await markUsed();
    await this.auditLog.log({
      action: 'staff.signed_in_email',
      actorStaffUserId: staff.id,
      targetType: 'StaffUser',
      targetId: staff.id,
    });
    return this.staffAuth.signSessionToken(staff.id);
  }

  private findActiveStaff(email: string): Promise<StaffUser | null> {
    return this.prisma.staffUser.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        isActive: true,
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
    });
  }
}

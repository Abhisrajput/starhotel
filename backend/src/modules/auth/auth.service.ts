import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../shared/database';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../../shared/errors';
import logger from '../../shared/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'star-hotel-jwt-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'star-hotel-refresh-secret-key-change-in-production';
const MAX_LOGIN_ATTEMPTS = 3; // BR-7: lockout after 3 failed attempts

export interface TokenPayload {
  userId: string;
  userName: string;
  userGroup: number;
}

export class AuthService {
  /** BR-7: Login with lockout. BR-8: Force password change. BR-9: Module access. */
  async login(userIdInput: string, password: string) {
    const userId = userIdInput.toUpperCase(); // Legacy uppercases UserID
    const user = await prisma.userData.findUnique({ where: { userId } });

    if (!user) {
      throw new UnauthorizedError('User ID not found');
    }

    // Check if account is frozen (active = false)
    if (!user.active) {
      throw new ForbiddenError('Your User ID has been frozen. Please contact System Administrator.');
    }

    // BR-7: Check login attempts BEFORE password check for non-admin users
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      // Freeze the account
      await prisma.userData.update({ where: { userId }, data: { active: false } });
      throw new ForbiddenError('Your User ID has been frozen. Please contact System Administrator.');
    }

    const passwordValid = await bcrypt.compare(password, user.userPassword);

    if (!passwordValid) {
      // BR-7: Admin (group 1) does NOT get locked out
      if (user.userGroup > 1) {
        await prisma.userData.update({
          where: { userId },
          data: { loginAttempts: { increment: 1 } },
        });
        const newAttempts = user.loginAttempts + 1;
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          await prisma.userData.update({ where: { userId }, data: { active: false } });
          throw new ForbiddenError('Too many attempts. Your User ID has been frozen.');
        }
      }
      throw new UnauthorizedError('Invalid password, please try again');
    }

    // Success: reset login attempts
    await prisma.userData.update({ where: { userId }, data: { loginAttempts: 0 } });

    // Check module access for Dashboard (moduleId=1) — BR-9
    const dashboardAccess = await this.checkModuleAccess(user.userGroup, 1);
    if (!dashboardAccess) {
      throw new ForbiddenError('Your access has been disabled');
    }

    const payload: TokenPayload = {
      userId: user.userId,
      userName: user.userName,
      userGroup: user.userGroup,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    logger.info({ userId: user.userId }, 'User logged in successfully');

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        userName: user.userName,
        userGroup: user.userGroup,
        idle: user.idle,
        changePassword: user.changePassword, // BR-8
        dashboardBlink: user.dashboardBlink,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
      const accessToken = jwt.sign(
        { userId: payload.userId, userName: payload.userName, userGroup: payload.userGroup },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      return { accessToken };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /** BR-17: min 4 chars. BR-8: clears changePassword flag */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.userData.findUnique({ where: { userId } });
    if (!user) throw new UnauthorizedError('User not found');

    const valid = await bcrypt.compare(currentPassword, user.userPassword);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    if (newPassword.length < 4) {
      throw new ValidationError('Password must be at least 4 characters');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.userData.update({
      where: { userId },
      data: { userPassword: hashed, changePassword: false },
    });

    logger.info({ userId }, 'Password changed');
    return { message: 'Password changed successfully' };
  }

  /** BR-9: Module-based access control — checks group flags */
  async checkModuleAccess(userGroup: number, moduleId: number): Promise<boolean> {
    const mod = await prisma.moduleAccess.findFirst({ where: { moduleId, active: true } });
    if (!mod) return false;

    switch (userGroup) {
      case 1: return mod.group1;
      case 2: return mod.group2;
      case 3: return mod.group3;
      case 4: return mod.group4;
      default: return false;
    }
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}

export const authService = new AuthService();
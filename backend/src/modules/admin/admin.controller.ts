import { Router, Response, NextFunction } from 'express';
import prisma from '../../shared/database';
import { authenticate, AuthRequest, authorize } from '../auth/auth.middleware';
import { ValidationError } from '../../shared/errors';
import bcrypt from 'bcryptjs';

const router = Router();

/** GET /api/admin/company */
router.get('/company', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const company = await prisma.company.findFirst({ where: { active: true } });
    res.json(company);
  } catch (err) { next(err); }
});

/** PUT /api/admin/company — Admin only */
router.put('/company', authenticate, authorize(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { companyName, streetAddress, contactNo, currencySymbol } = req.body;
    const company = await prisma.company.findFirst({ where: { active: true } });
    if (!company) throw new ValidationError('Company not found');
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { companyName, streetAddress, contactNo, currencySymbol },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

/** GET /api/admin/users — Admin only */
router.get('/users', authenticate, authorize(1), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.userData.findMany({
      select: {
        id: true, userId: true, userName: true, userGroup: true,
        idle: true, loginAttempts: true, changePassword: true,
        dashboardBlink: true, active: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

/** POST /api/admin/users — Admin only */
router.post('/users', authenticate, authorize(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, userName, userGroup, password, idle } = req.body;
    if (!userId || !userName || !userGroup || !password) {
      throw new ValidationError('All fields are required');
    }
    if (password.length < 4) {
      throw new ValidationError('Password must be at least 4 characters');
    }
    const existing = await prisma.userData.findUnique({ where: { userId: userId.toUpperCase() } });
    if (existing) throw new ValidationError('User ID already exists');

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.userData.create({
      data: {
        userId: userId.toUpperCase(),
        userName,
        userGroup,
        userPassword: hashed,
        idle: idle || 0,
        changePassword: true, // Force password change on first login
        active: true,
      },
    });
    res.status(201).json({ id: user.id, userId: user.userId, userName: user.userName });
  } catch (err) { next(err); }
});

/** PUT /api/admin/users/:userId/reset — Admin resets user account (unfreeze) */
router.put('/users/:userId/reset', authenticate, authorize(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    await prisma.userData.update({
      where: { userId: userId.toUpperCase() },
      data: { loginAttempts: 0, active: true },
    });
    res.json({ message: `User ${userId} account has been reset` });
  } catch (err) { next(err); }
});

/** GET /api/admin/module-access — Admin only */
router.get('/module-access', authenticate, authorize(1), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const modules = await prisma.moduleAccess.findMany({ orderBy: { moduleId: 'asc' } });
    res.json(modules);
  } catch (err) { next(err); }
});

/** PUT /api/admin/module-access/:moduleId — Admin only */
router.put('/module-access/:moduleId', authenticate, authorize(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const moduleId = parseInt(req.params.moduleId, 10);
    const { group1, group2, group3, group4 } = req.body;
    const mod = await prisma.moduleAccess.findFirst({ where: { moduleId } });
    if (!mod) throw new ValidationError('Module not found');
    const updated = await prisma.moduleAccess.update({
      where: { id: mod.id },
      data: { group1, group2, group3, group4 },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
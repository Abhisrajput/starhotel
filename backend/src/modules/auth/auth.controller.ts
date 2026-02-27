import { Router, Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { loginSchema, changePasswordSchema } from './auth.schema';
import { authenticate, AuthRequest } from './auth.middleware';
import { ValidationError } from '../../shared/errors';

const router = Router();

/** POST /api/auth/login — BR-7, BR-8, BR-9 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }
    const result = await authService.login(parsed.data.userId, parsed.data.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/refresh */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new ValidationError('Refresh token required');
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/auth/change-password — BR-17, BR-8 */
router.put('/change-password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }
    const result = await authService.changePassword(
      req.user!.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/me — Return current user info */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

/** GET /api/auth/module-access/:moduleId — BR-9 */
router.get('/module-access/:moduleId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const moduleId = parseInt(req.params.moduleId, 10);
    const hasAccess = await authService.checkModuleAccess(req.user!.userGroup, moduleId);
    res.json({ moduleId, hasAccess });
  } catch (err) {
    next(err);
  }
});

export default router;
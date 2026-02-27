import { Request, Response, NextFunction } from 'express';
import { authService, TokenPayload } from './auth.service';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/** JWT authentication middleware */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }
  const token = header.split(' ')[1];
  try {
    req.user = authService.verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

/** Role-based authorization middleware — accepts array of allowed group numbers */
export function authorize(...allowedGroups: number[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedGroups.includes(req.user.userGroup)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}
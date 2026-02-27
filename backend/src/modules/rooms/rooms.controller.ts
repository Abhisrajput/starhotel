import { Router, Response, NextFunction } from 'express';
import { roomsService } from './rooms.service';
import { createRoomSchema, updateRoomSchema, updateRoomStatusSchema } from './rooms.schema';
import { authenticate, AuthRequest, authorize } from '../auth/auth.middleware';
import { ValidationError } from '../../shared/errors';

const router = Router();

/** GET /api/rooms */
router.get('/', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rooms = await roomsService.getAllRooms();
    res.json(rooms);
  } catch (err) { next(err); }
});

/** GET /api/rooms/types */
router.get('/types', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const types = await roomsService.getRoomTypes();
    res.json(types);
  } catch (err) { next(err); }
});

/** GET /api/rooms/:id */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const room = await roomsService.getRoomById(parseInt(req.params.id, 10));
    res.json(room);
  } catch (err) { next(err); }
});

/** POST /api/rooms — Admin only */
router.post('/', authenticate, authorize(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const room = await roomsService.createRoom(parsed.data, req.user!.userId);
    res.status(201).json(room);
  } catch (err) { next(err); }
});

/** PUT /api/rooms/:id — Admin only, BR-11 */
router.put('/:id', authenticate, authorize(1), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateRoomSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const room = await roomsService.updateRoom(parseInt(req.params.id, 10), parsed.data, req.user!.userId);
    res.json(room);
  } catch (err) { next(err); }
});

/** PUT /api/rooms/:id/status — BR-1 state machine */
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = updateRoomStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const room = await roomsService.updateRoomStatus(
      parseInt(req.params.id, 10),
      parsed.data.status as any,
      req.user!.userId
    );
    res.json(room);
  } catch (err) { next(err); }
});

/** GET /api/dashboard/status — Dashboard room grid */
router.get('/dashboard/status', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = await roomsService.getDashboardStatus();
    res.json(status);
  } catch (err) { next(err); }
});

export default router;
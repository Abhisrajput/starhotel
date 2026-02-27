import { Router, Response, NextFunction } from 'express';
import { bookingsService } from './bookings.service';
import { createBookingSchema, paymentSchema, checkOutSchema } from './bookings.schema';
import { authenticate, AuthRequest } from '../auth/auth.middleware';
import { ValidationError } from '../../shared/errors';

const router = Router();

/** GET /api/bookings */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { active, roomId, search } = req.query;
    if (search) {
      const results = await bookingsService.searchByGuest(search as string);
      return res.json(results);
    }
    const filters: any = {};
    if (active !== undefined) filters.active = active === 'true';
    if (roomId) filters.roomId = parseInt(roomId as string, 10);
    const bookings = await bookingsService.getBookings(filters);
    res.json(bookings);
  } catch (err) { next(err); }
});

/** GET /api/bookings/:id */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingsService.getBookingById(parseInt(req.params.id, 10));
    res.json(booking);
  } catch (err) { next(err); }
});

/** POST /api/bookings — BR-3, BR-5, BR-6, BR-10, BR-12 */
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const booking = await bookingsService.createBooking(parsed.data, req.user!.userId);
    res.status(201).json(booking);
  } catch (err) { next(err); }
});

/** POST /api/bookings/:id/check-in — BR-2 */
router.post('/:id/check-in', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingsService.checkIn(parseInt(req.params.id, 10), req.user!.userId);
    res.json(booking);
  } catch (err) { next(err); }
});

/** POST /api/bookings/:id/check-out — BR-2, BR-4 */
router.post('/:id/check-out', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = checkOutSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const booking = await bookingsService.checkOut(
      parseInt(req.params.id, 10),
      parsed.data.checkOutTime,
      req.user!.userId,
      parsed.data.refund
    );
    res.json(booking);
  } catch (err) { next(err); }
});

/** POST /api/bookings/:id/payment */
router.post('/:id/payment', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);
    const result = await bookingsService.processPayment(
      parseInt(req.params.id, 10), parsed.data, req.user!.userId
    );
    res.json(result);
  } catch (err) { next(err); }
});

/** GET /api/bookings/:id/receipt — BR-14 */
router.get('/:id/receipt', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await bookingsService.getReceiptData(parseInt(req.params.id, 10));
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
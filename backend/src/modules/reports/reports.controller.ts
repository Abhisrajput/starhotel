import { Router, Response, NextFunction } from 'express';
import prisma from '../../shared/database';
import { authenticate, AuthRequest } from '../auth/auth.middleware';

const router = Router();

/** GET /api/reports/daily?date=YYYY-MM-DD */
router.get('/daily', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dateStr = req.query.date as string || new Date().toISOString().split('T')[0];
    const startDate = new Date(dateStr);
    const endDate = new Date(dateStr);
    endDate.setDate(endDate.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        active: true, temp: false,
        createdDate: { gte: startDate, lt: endDate },
      },
      orderBy: { id: 'asc' },
    });

    const company = await prisma.company.findFirst({ where: { active: true } });

    res.json({
      reportTitle: 'Daily Booking Report',
      date: dateStr,
      company,
      bookings: bookings.map(b => ({
        bookingId: String(b.id).padStart(6, '0'),
        guestName: b.guestName,
        roomNo: b.roomNo,
        roomType: b.roomType,
        deposit: Number(b.deposit),
        payment: Number(b.payment),
        checkIn: b.guestCheckIn,
        checkOut: b.guestCheckOut,
        createdBy: b.createdBy,
      })),
      totals: {
        deposit: bookings.reduce((sum, b) => sum + Number(b.deposit), 0),
        payment: bookings.reduce((sum, b) => sum + Number(b.payment), 0),
      },
    });
  } catch (err) { next(err); }
});

/** GET /api/reports/weekly?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD */
router.get('/weekly', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(now.setDate(now.getDate() - 7));
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        active: true, temp: false,
        createdDate: { gte: startDate, lte: endDate },
      },
      orderBy: { id: 'asc' },
    });

    const company = await prisma.company.findFirst({ where: { active: true } });

    res.json({
      reportTitle: 'Weekly Booking Report',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      company,
      bookings: bookings.map(b => ({
        bookingId: String(b.id).padStart(6, '0'),
        guestName: b.guestName,
        roomNo: b.roomNo,
        roomType: b.roomType,
        deposit: Number(b.deposit),
        payment: Number(b.payment),
        checkIn: b.guestCheckIn,
        checkOut: b.guestCheckOut,
        createdBy: b.createdBy,
        createdDate: b.createdDate,
      })),
      totals: {
        deposit: bookings.reduce((sum, b) => sum + Number(b.deposit), 0),
        payment: bookings.reduce((sum, b) => sum + Number(b.payment), 0),
        count: bookings.length,
      },
    });
  } catch (err) { next(err); }
});

/** GET /api/reports/shift?date=YYYY-MM-DD&userId=ADMIN */
router.get('/shift', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dateStr = req.query.date as string || new Date().toISOString().split('T')[0];
    const targetUserId = (req.query.userId as string) || req.user!.userId;
    const startDate = new Date(dateStr);
    const endDate = new Date(dateStr);
    endDate.setDate(endDate.getDate() + 1);

    const where: any = {
      active: true, temp: false,
      createdDate: { gte: startDate, lt: endDate },
    };
    if (targetUserId !== 'ALL') {
      where.createdBy = targetUserId;
    }

    const bookings = await prisma.booking.findMany({ where, orderBy: { id: 'asc' } });
    const company = await prisma.company.findFirst({ where: { active: true } });

    res.json({
      reportTitle: targetUserId === 'ALL' ? 'Booking Report by All Staff' : `Booking Report by ${targetUserId}`,
      date: dateStr,
      company,
      bookings: bookings.map(b => ({
        bookingId: String(b.id).padStart(6, '0'),
        guestName: b.guestName,
        roomNo: b.roomNo,
        roomType: b.roomType,
        deposit: Number(b.deposit),
        payment: Number(b.payment),
        total: Number(b.payment) - Number(b.refund),
        checkIn: b.guestCheckIn,
        checkOut: b.guestCheckOut,
        createdBy: b.createdBy,
      })),
      totals: {
        deposit: bookings.reduce((sum, b) => sum + Number(b.deposit), 0),
        payment: bookings.reduce((sum, b) => sum + Number(b.payment), 0),
        total: bookings.reduce((sum, b) => sum + Number(b.payment) - Number(b.refund), 0),
      },
    });
  } catch (err) { next(err); }
});

export default router;
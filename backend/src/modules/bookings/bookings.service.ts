import { RoomStatus, Prisma } from '@prisma/client';
import prisma from '../../shared/database';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { roomsService } from '../rooms/rooms.service';
import logger from '../../shared/logger';
import { CreateBookingInput, PaymentInput } from './bookings.schema';

const DEFAULT_DEPOSIT = parseFloat(process.env.DEFAULT_DEPOSIT || '20.00'); // BR-6
const LATE_CHECKOUT_HOUR = parseInt(process.env.LATE_CHECKOUT_HOUR || '14', 10); // BR-4: 2 PM

export class BookingsService {
  /** Create a new booking — BR-3, BR-5, BR-6, BR-10, BR-12 */
  async createBooking(data: CreateBookingInput, userId: string) {
    // BR-12: Validate guest name and passport (handled by zod schema)
    // BR-10: Cannot book a maintenance room
    const room = await roomsService.getRoomById(data.roomId);
    if (room.roomStatus === RoomStatus.Maintenance) {
      throw new ConflictError('Room is under Maintenance. Please choose another room.');
    }
    if (room.roomStatus !== RoomStatus.Open) {
      throw new ConflictError(`Room is currently ${room.roomStatus}. Cannot create booking.`);
    }

    // BR-3: SubTotal = StayDuration * RoomPrice
    const roomPrice = Number(room.roomPrice);
    const subTotal = data.stayDuration * roomPrice;
    const deposit = data.deposit ?? DEFAULT_DEPOSIT; // BR-6
    const totalDue = subTotal + deposit;

    const booking = await prisma.booking.create({
      data: {
        guestName: data.guestName.trim(),
        guestPassport: data.guestPassport.trim(),
        guestOrigin: data.guestOrigin || '',
        guestContact: data.guestContact || '',
        guestEmergencyContactName: data.guestEmergencyContactName || '',
        guestEmergencyContactNo: data.guestEmergencyContactNo || '',
        totalGuest: data.totalGuest,
        stayDuration: data.stayDuration,
        bookingDate: new Date(data.bookingDate),
        guestCheckIn: new Date(data.guestCheckIn),
        guestCheckOut: new Date(data.guestCheckOut),
        remarks: data.remarks || '',
        roomId: data.roomId,
        roomNo: room.roomShortName,
        roomType: room.roomType,
        roomLocation: room.roomLocation,
        roomPrice: roomPrice,
        breakfast: room.breakfast,
        breakfastPrice: Number(room.breakfastPrice),
        subTotal: subTotal,
        deposit: deposit,
        payment: data.payment || 0,
        refund: 0,
        active: true,
        temp: false, // BR-13: No longer need temp bookings in modern system
        createdBy: userId,
      },
    });

    // BR-1: Open → Booked
    await roomsService.updateRoomStatus(data.roomId, RoomStatus.Booked, userId, booking.id);

    // Log booking creation
    await prisma.logBooking.create({
      data: {
        bookingId: booking.id,
        guestName: booking.guestName,
        guestPassport: booking.guestPassport,
        action: 'Booking Created',
        createdBy: userId,
      },
    });

    logger.info({ bookingId: booking.id, roomId: data.roomId }, 'Booking created');
    return { ...booking, totalDue };
  }

  async getBookingById(id: number) {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError(`Booking ${id} not found`);
    return booking;
  }

  async getBookings(filters?: { active?: boolean; roomId?: number }) {
    const where: Prisma.BookingWhereInput = { temp: false };
    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.roomId) where.roomId = filters.roomId;
    return prisma.booking.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 100,
    });
  }

  async searchByGuest(query: string) {
    return prisma.booking.findMany({
      where: {
        OR: [
          { guestName: { contains: query, mode: 'insensitive' } },
          { guestPassport: { contains: query, mode: 'insensitive' } },
        ],
        temp: false,
      },
      orderBy: { id: 'desc' },
      take: 50,
    });
  }

  /** BR-2: Full payment required before check-in */
  isPaid(booking: { subTotal: Prisma.Decimal; deposit: Prisma.Decimal; payment: Prisma.Decimal }): boolean {
    const subTotal = Number(booking.subTotal);
    const deposit = Number(booking.deposit);
    const payment = Number(booking.payment);
    return payment === subTotal + deposit;
  }

  /** BR-2 + BR-1: Check-IN (Booked → Occupied) */
  async checkIn(bookingId: number, userId: string) {
    const booking = await this.getBookingById(bookingId);

    if (!booking.active) throw new ValidationError('Booking is not active');
    if (!this.isPaid(booking)) {
      throw new ValidationError('Please make payment first!');
    }

    // Get room and check status
    const room = await roomsService.getRoomById(booking.roomId);
    if (room.roomStatus !== RoomStatus.Booked) {
      throw new ConflictError(`Room status is ${room.roomStatus}, expected Booked for check-in`);
    }

    // Update booking with actual check-in time
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        guestCheckIn: new Date(),
        lastModifiedDate: new Date(),
        lastModifiedBy: userId,
      },
    });

    // BR-1: Booked → Occupied
    await roomsService.updateRoomStatus(booking.roomId, RoomStatus.Occupied, userId);

    await prisma.logBooking.create({
      data: {
        bookingId, guestName: booking.guestName,
        guestPassport: booking.guestPassport, action: 'Check-IN', createdBy: userId,
      },
    });

    logger.info({ bookingId, roomId: booking.roomId }, 'Guest checked in');
    return updated;
  }

  /** BR-2 + BR-4 + BR-1: Check-OUT (Occupied → Housekeeping) */
  async checkOut(bookingId: number, checkOutTime: string, userId: string, refundOverride?: number) {
    const booking = await this.getBookingById(bookingId);
    if (!booking.active) throw new ValidationError('Booking is not active');
    if (!this.isPaid(booking)) {
      throw new ValidationError('Please make payment first!');
    }

    const room = await roomsService.getRoomById(booking.roomId);
    if (room.roomStatus !== RoomStatus.Occupied) {
      throw new ConflictError(`Room status is ${room.roomStatus}, expected Occupied for check-out`);
    }

    const checkOutDate = new Date(checkOutTime);
    const checkOutHour = checkOutDate.getHours();

    // BR-4: Late checkout (>= 2 PM) — deposit forfeited, refund = 0
    let refund: number;
    if (checkOutHour >= LATE_CHECKOUT_HOUR) {
      refund = 0; // Deposit forfeiture
    } else {
      refund = refundOverride !== undefined ? refundOverride : Number(booking.deposit);
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        guestCheckOut: checkOutDate,
        refund: refund,
        lastModifiedDate: new Date(),
        lastModifiedBy: userId,
      },
    });

    // BR-1: Occupied → Housekeeping
    await roomsService.updateRoomStatus(booking.roomId, RoomStatus.Housekeeping, userId);

    await prisma.logBooking.create({
      data: {
        bookingId, guestName: booking.guestName,
        guestPassport: booking.guestPassport, action: 'Check-OUT', createdBy: userId,
      },
    });

    logger.info({ bookingId, roomId: booking.roomId, refund }, 'Guest checked out');
    return { ...updated, lateCheckout: checkOutHour >= LATE_CHECKOUT_HOUR };
  }

  /** Process payment for a booking */
  async processPayment(bookingId: number, data: PaymentInput, userId: string) {
    const booking = await this.getBookingById(bookingId);

    const updateData: Prisma.BookingUpdateInput = {
      payment: data.payment,
      lastModifiedDate: new Date(),
      lastModifiedBy: userId,
    };
    if (data.deposit !== undefined) updateData.deposit = data.deposit;
    if (data.refund !== undefined) updateData.refund = data.refund;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    logger.info({ bookingId, payment: data.payment }, 'Payment processed');
    return updated;
  }

  /** BR-14: Get receipt data */
  async getReceiptData(bookingId: number) {
    const booking = await this.getBookingById(bookingId);
    const company = await prisma.company.findFirst({ where: { active: true } });

    const payment = Number(booking.payment);
    const refund = Number(booking.refund);
    const total = payment - refund; // BR-14: Official Receipt Total = Payment - Refund

    return {
      company: company ? {
        name: company.companyName,
        address: company.streetAddress,
        contact: company.contactNo,
        currency: company.currencySymbol,
      } : null,
      booking: {
        id: booking.id,
        bookingIdFormatted: String(booking.id).padStart(6, '0'),
        guestName: booking.guestName,
        guestCheckIn: booking.guestCheckIn,
        guestCheckOut: booking.guestCheckOut,
        roomType: booking.roomType,
        roomNo: booking.roomNo,
        subTotal: Number(booking.subTotal),
        deposit: Number(booking.deposit),
        payment,
        refund,
        total,
        createdDate: booking.createdDate,
      },
    };
  }
}

export const bookingsService = new BookingsService();
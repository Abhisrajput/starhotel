import { z } from 'zod';

export const createBookingSchema = z.object({
  roomId: z.number().int().positive(),
  guestName: z.string().min(1, 'Please key in Guest Name'), // BR-12
  guestPassport: z.string().min(1, 'Please key in Guest Passport/IC No'), // BR-12
  guestOrigin: z.string().optional().default(''),
  guestContact: z.string().optional().default(''),
  guestEmergencyContactName: z.string().optional().default(''),
  guestEmergencyContactNo: z.string().optional().default(''),
  totalGuest: z.number().int().min(1).max(6),
  stayDuration: z.number().int().min(1).max(10),
  bookingDate: z.string(),
  guestCheckIn: z.string(),
  guestCheckOut: z.string(),
  remarks: z.string().optional().default(''),
  deposit: z.number().min(0).optional().default(20), // BR-6
  payment: z.number().min(0).optional().default(0),
  refund: z.number().min(0).optional().default(0),
});

export const updateBookingSchema = createBookingSchema.partial();

export const paymentSchema = z.object({
  deposit: z.number().min(0).optional(),
  payment: z.number().min(0),
  refund: z.number().min(0).optional().default(0),
});

export const checkOutSchema = z.object({
  checkOutTime: z.string(),
  refund: z.number().min(0).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
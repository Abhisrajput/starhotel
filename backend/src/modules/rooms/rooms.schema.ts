import { z } from 'zod';

export const createRoomSchema = z.object({
  roomShortName: z.string().min(1),
  roomLongName: z.string().optional().default(''),
  roomType: z.string().min(1),
  roomLocation: z.string().min(1),
  roomPrice: z.number().min(0),
  breakfast: z.boolean().optional().default(false),
  breakfastPrice: z.number().min(0).optional().default(0),
});

export const updateRoomSchema = createRoomSchema.partial();

export const updateRoomStatusSchema = z.object({
  status: z.enum(['Open', 'Booked', 'Occupied', 'Housekeeping', 'Maintenance']),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
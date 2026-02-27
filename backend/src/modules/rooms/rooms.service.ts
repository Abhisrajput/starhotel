import { RoomStatus } from '@prisma/client';
import prisma from '../../shared/database';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import logger from '../../shared/logger';
import { CreateRoomInput, UpdateRoomInput } from './rooms.schema';

/** BR-1: Room status state machine — valid transitions */
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  Open: [RoomStatus.Booked, RoomStatus.Maintenance, RoomStatus.Housekeeping],
  Booked: [RoomStatus.Occupied, RoomStatus.Open],
  Occupied: [RoomStatus.Housekeeping],
  Housekeeping: [RoomStatus.Open, RoomStatus.Maintenance],
  Maintenance: [RoomStatus.Open],
};

export class RoomsService {
  async getAllRooms() {
    return prisma.room.findMany({
      where: { active: true },
      orderBy: { id: 'asc' },
    });
  }

  async getRoomById(id: number) {
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundError(`Room ${id} not found`);
    return room;
  }

  async createRoom(data: CreateRoomInput, userId: string) {
    return prisma.room.create({
      data: {
        ...data,
        roomPrice: data.roomPrice,
        breakfastPrice: data.breakfastPrice || 0,
        roomStatus: RoomStatus.Open,
        active: true,
        createdBy: userId,
      },
    });
  }

  /** BR-11: Booked/Occupied rooms cannot be edited */
  async updateRoom(id: number, data: UpdateRoomInput, userId: string) {
    const room = await this.getRoomById(id);
    if (room.roomStatus === RoomStatus.Booked || room.roomStatus === RoomStatus.Occupied) {
      throw new ConflictError('Cannot edit a room that is Booked or Occupied');
    }
    return prisma.room.update({
      where: { id },
      data: {
        ...data,
        lastModifiedDate: new Date(),
        lastModifiedBy: userId,
      },
    });
  }

  /** BR-1: Status state machine. BR-10: Cannot book maintenance room. */
  async updateRoomStatus(id: number, newStatus: RoomStatus, userId: string, bookingId?: number) {
    const room = await this.getRoomById(id);
    const currentStatus = room.roomStatus;

    // BR-1: Validate transition
    if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
      throw new ValidationError(
        `Invalid room status transition: ${currentStatus} → ${newStatus}`
      );
    }

    const updateData: Record<string, unknown> = {
      roomStatus: newStatus,
      lastModifiedDate: new Date(),
      lastModifiedBy: userId,
    };

    if (newStatus === RoomStatus.Booked && bookingId) {
      updateData.bookingId = bookingId;
    }
    if (newStatus === RoomStatus.Open) {
      updateData.bookingId = 0;
    }

    const updated = await prisma.room.update({ where: { id }, data: updateData });

    // Log room status change
    await prisma.logRoom.create({
      data: {
        roomId: id,
        bookingId: bookingId || 0,
        roomShortName: room.roomShortName,
        roomStatus: newStatus,
        action: `Status changed: ${currentStatus} → ${newStatus}`,
        createdBy: userId,
      },
    });

    logger.info({ roomId: id, from: currentStatus, to: newStatus }, 'Room status updated');
    return updated;
  }

  async getRoomTypes() {
    return prisma.roomType.findMany({ where: { active: true } });
  }

  async getDashboardStatus() {
    const rooms = await prisma.room.findMany({
      where: { active: true },
      orderBy: { id: 'asc' },
    });

    const summary = {
      open: rooms.filter(r => r.roomStatus === 'Open').length,
      booked: rooms.filter(r => r.roomStatus === 'Booked').length,
      occupied: rooms.filter(r => r.roomStatus === 'Occupied').length,
      housekeeping: rooms.filter(r => r.roomStatus === 'Housekeeping').length,
      maintenance: rooms.filter(r => r.roomStatus === 'Maintenance').length,
    };

    // BR-15: Check for alert conditions (check-in/out time passed)
    const roomsWithAlerts = await Promise.all(
      rooms.map(async (room) => {
        let alert = false;
        if (room.bookingId > 0 && (room.roomStatus === 'Booked' || room.roomStatus === 'Occupied')) {
          const booking = await prisma.booking.findFirst({
            where: { id: room.bookingId, active: true },
          });
          if (booking) {
            const now = new Date();
            if (room.roomStatus === 'Booked' && booking.guestCheckIn && now > booking.guestCheckIn) {
              alert = true;
            }
            if (room.roomStatus === 'Occupied' && booking.guestCheckOut && now > booking.guestCheckOut) {
              alert = true;
            }
          }
        }
        return { ...room, roomPrice: Number(room.roomPrice), breakfastPrice: Number(room.breakfastPrice), alert };
      })
    );

    return { rooms: roomsWithAlerts, summary };
  }
}

export const roomsService = new RoomsService();
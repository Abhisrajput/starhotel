import { describe, it, expect } from 'vitest';

// Business logic unit tests — independent of React rendering

describe('Business Rules - Currency Formatting (BR-18)', () => {
  const formatCurrency = (amount: number, symbol: string = 'MYR'): string => {
    return `${symbol} ${amount.toFixed(2)}`;
  };

  it('formats currency with MYR symbol', () => {
    expect(formatCurrency(100)).toBe('MYR 100.00');
  });

  it('formats zero amount', () => {
    expect(formatCurrency(0)).toBe('MYR 0.00');
  });

  it('formats decimal amount', () => {
    expect(formatCurrency(20.5)).toBe('MYR 20.50');
  });
});

describe('Business Rules - SubTotal Calculation (BR-3)', () => {
  const calcSubTotal = (stayDuration: number, roomPrice: number) => stayDuration * roomPrice;

  it('calculates subtotal for 1 night', () => {
    expect(calcSubTotal(1, 100)).toBe(100);
  });

  it('calculates subtotal for 3 nights', () => {
    expect(calcSubTotal(3, 150)).toBe(450);
  });
});

describe('Business Rules - Check-OUT Date Auto Calculation (BR-5)', () => {
  const calcCheckOutDate = (checkInDate: Date, stayDuration: number): Date => {
    const checkInHour = checkInDate.getHours();
    const daysToAdd = checkInHour >= 12 ? stayDuration : Math.max(stayDuration - 1, 0);
    const result = new Date(checkInDate);
    result.setDate(result.getDate() + daysToAdd);
    result.setHours(12, 0, 0, 0);
    return result;
  };

  it('check-in at 2 PM for 1 night → checkout next day 12 PM', () => {
    const checkIn = new Date('2024-01-15T14:00:00');
    const checkOut = calcCheckOutDate(checkIn, 1);
    expect(checkOut.getDate()).toBe(16);
    expect(checkOut.getHours()).toBe(12);
  });

  it('check-in at 10 AM for 1 night → same day 12 PM', () => {
    const checkIn = new Date('2024-01-15T10:00:00');
    const checkOut = calcCheckOutDate(checkIn, 1);
    expect(checkOut.getDate()).toBe(15);
    expect(checkOut.getHours()).toBe(12);
  });

  it('check-in at 3 PM for 3 nights → +3 days at 12 PM', () => {
    const checkIn = new Date('2024-01-15T15:00:00');
    const checkOut = calcCheckOutDate(checkIn, 3);
    expect(checkOut.getDate()).toBe(18);
  });
});

describe('Business Rules - Late Checkout Deposit Forfeiture (BR-4)', () => {
  const LATE_CHECKOUT_HOUR = 14; // 2 PM

  const calcRefund = (checkOutHour: number, deposit: number): number => {
    return checkOutHour >= LATE_CHECKOUT_HOUR ? 0 : deposit;
  };

  it('checkout at 1 PM → full deposit refund', () => {
    expect(calcRefund(13, 20)).toBe(20);
  });

  it('checkout at 2 PM → no refund (deposit forfeited)', () => {
    expect(calcRefund(14, 20)).toBe(0);
  });

  it('checkout at 5 PM → no refund', () => {
    expect(calcRefund(17, 50)).toBe(0);
  });
});

describe('Business Rules - IsPaid Check (BR-2)', () => {
  const isPaid = (payment: number, subTotal: number, deposit: number): boolean => {
    return payment === subTotal + deposit;
  };

  it('returns true when payment equals subTotal + deposit', () => {
    expect(isPaid(120, 100, 20)).toBe(true);
  });

  it('returns false when payment is less', () => {
    expect(isPaid(100, 100, 20)).toBe(false);
  });

  it('returns false when payment is more', () => {
    expect(isPaid(150, 100, 20)).toBe(false);
  });
});

describe('Business Rules - Receipt Total (BR-14)', () => {
  it('official receipt total = payment - refund', () => {
    const payment = 120;
    const refund = 20;
    expect(payment - refund).toBe(100);
  });

  it('no refund means total equals payment', () => {
    expect(120 - 0).toBe(120);
  });
});

describe('Business Rules - Default Deposit (BR-6)', () => {
  it('default deposit is MYR 20.00', () => {
    const DEFAULT_DEPOSIT = 20.00;
    expect(DEFAULT_DEPOSIT).toBe(20);
  });
});

describe('Business Rules - Password Minimum Length (BR-17)', () => {
  const isValidPassword = (password: string): boolean => password.length >= 4;

  it('rejects password with 3 characters', () => {
    expect(isValidPassword('abc')).toBe(false);
  });

  it('accepts password with 4 characters', () => {
    expect(isValidPassword('abcd')).toBe(true);
  });

  it('accepts longer password', () => {
    expect(isValidPassword('password123')).toBe(true);
  });
});

describe('Room Status State Machine (BR-1)', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    Open: ['Booked', 'Maintenance', 'Housekeeping'],
    Booked: ['Occupied', 'Open'],
    Occupied: ['Housekeeping'],
    Housekeeping: ['Open', 'Maintenance'],
    Maintenance: ['Open'],
  };

  const isValidTransition = (from: string, to: string): boolean => {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  };

  it('full lifecycle: Open → Booked → Occupied → Housekeeping → Open', () => {
    expect(isValidTransition('Open', 'Booked')).toBe(true);
    expect(isValidTransition('Booked', 'Occupied')).toBe(true);
    expect(isValidTransition('Occupied', 'Housekeeping')).toBe(true);
    expect(isValidTransition('Housekeeping', 'Open')).toBe(true);
  });

  it('cannot go from Open directly to Occupied', () => {
    expect(isValidTransition('Open', 'Occupied')).toBe(false);
  });

  it('cannot book a Maintenance room', () => {
    expect(isValidTransition('Maintenance', 'Booked')).toBe(false);
  });
});
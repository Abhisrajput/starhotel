import { z } from 'zod';

export const loginSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4, 'Password must be at least 4 characters'), // BR-17
  confirmPassword: z.string().min(4),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
// Authentication Validation Schemas
import { z } from '/js/vendor/zod.js';

/**
 * Email validation - reusable across schemas
 */
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email must be 254 characters or less')
  .transform(s => s.trim().toLowerCase());

/**
 * Password validation for login (minimal - just check not empty)
 */
const loginPasswordSchema = z.string().min(1, 'Password is required');

/**
 * Password validation for registration (stronger requirements)
 */
const registerPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or less')
  .refine(password => /[A-Z]/.test(password), 'Password must contain at least one uppercase letter')
  .refine(password => /[0-9]/.test(password), 'Password must contain at least one number');

/**
 * Schema for login form
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

/**
 * Schema for registration form
 */
export const RegisterSchema = z
  .object({
    email: emailSchema,
    password: registerPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Schema for password change form
 */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: registerPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

/**
 * Schema for password reset request
 */
export const ResetPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Schema for delete account confirmation
 */
export const DeleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmText: z.literal('DELETE', { message: 'Please type DELETE to confirm' }),
});

/** Inferred types from schemas */
export type LoginData = z.infer<typeof LoginSchema>;
export type RegisterData = z.infer<typeof RegisterSchema>;
export type ChangePasswordData = z.infer<typeof ChangePasswordSchema>;
export type ResetPasswordData = z.infer<typeof ResetPasswordSchema>;
export type DeleteAccountData = z.infer<typeof DeleteAccountSchema>;

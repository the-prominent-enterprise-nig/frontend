import { z } from 'zod'

// Shared with first-login and the invite form so every place a password is
// chosen asks for the same thing.
// The character mix every password screen asks for, added after a length check
// so a screen with a longer minimum (first sign in) can reuse it.
export const withPasswordComposition = (base: z.ZodString) =>
  base
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const passwordRules = withPasswordComposition(
  z.string().min(8, 'Password must be at least 8 characters')
)

export const ResetPasswordSchema = z
  .object({
    newPassword: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>

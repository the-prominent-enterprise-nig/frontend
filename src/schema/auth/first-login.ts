import { z } from 'zod'
import { passwordRules } from './reset-password'

export const FirstLoginSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: passwordRules,
    confirmPassword: z.string().min(1, 'Please re-enter your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type FirstLoginInput = z.infer<typeof FirstLoginSchema>

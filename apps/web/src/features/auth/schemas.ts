import { z } from 'zod'

export const USERNAME_RE = /^[A-Za-z0-9_.-]+$/

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'At least 3 characters')
      .max(32, 'At most 32 characters')
      .regex(USERNAME_RE, 'Only letters, digits, “_”, “.” and “-”'),
    password: z.string().min(8, 'At least 8 characters').max(128, 'At most 128 characters'),
    confirm: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['OPERATOR', 'REVIEWER']),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
export type RegisterValues = z.infer<typeof registerSchema>

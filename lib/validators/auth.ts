import { z } from "zod";

/**
 * Auth validators.
 *
 * Password rules are enforced HERE as well as in Supabase, because Supabase's
 * default minimum is 6 characters and this is a money platform — an account
 * holds payout details and, for an organizer, control of other people's entry
 * fees. The rules stay explainable rather than exotic: length does more for
 * real-world strength than forcing a symbol, so we ask for 10 and reject the
 * obvious ones.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email.")
  .email("That doesn't look like an email address.")
  .max(254, "That email is too long.");

/** Passwords people pick that a credential-stuffing list already contains. */
const OBVIOUS_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "iloveyou1",
  "gravity123",
  "freefire123",
]);

const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Passwords can't be longer than 72 characters.") // bcrypt's real limit
  .refine((v) => !OBVIOUS_PASSWORDS.has(v.toLowerCase()), {
    message: "That password is too common — pick something else.",
  })
  .refine((v) => !/^(.)\1+$/.test(v), {
    message: "That password is just one repeated character.",
  });

export const signUpSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(2, "Tell us what to call you.")
      .max(60, "That name is too long."),
    email,
    password,
    confirm_password: z.string(),
    /** Where to send them afterwards; validated as an internal path below. */
    next: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Those passwords don't match.",
    path: ["confirm_password"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  // Deliberately NOT the strong `password` schema: an existing account may have
  // been created under older rules, and telling someone their *existing*
  // password is "too weak" at the login screen helps nobody.
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const resetRequestSchema = z.object({ email });
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

export const updatePasswordSchema = z
  .object({
    password,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Those passwords don't match.",
    path: ["confirm_password"],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

/**
 * Only ever redirect to a path on this site.
 *
 * `next` reaches us from a query string, so an attacker can put anything in it.
 * Without this, `/login?next=https://evil.example` turns our own login into an
 * open redirect — the classic phishing primitive, because the link genuinely
 * starts on the real domain. Protocol-relative `//evil.example` is the case
 * people forget: the browser treats it as absolute.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("\\")) return null; // some parsers normalise \ to /
  return next;
}

import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 8;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Returns the required minimum length when the password is too short (so the
// caller can render a localized message), or null when it passes.
export function passwordPolicyError(plain: string): { minLength: number } | null {
  if (plain.length < PASSWORD_MIN_LENGTH)
    return { minLength: PASSWORD_MIN_LENGTH };
  return null;
}

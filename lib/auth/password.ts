import bcrypt from "bcryptjs";

const MIN_LENGTH = 8;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function passwordPolicyError(plain: string): string | null {
  if (plain.length < MIN_LENGTH)
    return `Password must be at least ${MIN_LENGTH} characters.`;
  return null;
}

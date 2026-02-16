/**
 * Generates a deterministic, unique referral code from a user's UID.
 * This ensures the code is always the same for the same user and avoids randomness.
 * @param uid The user's unique identifier from Firebase Authentication.
 * @returns A shortened, uppercase alphanumeric referral code.
 */
export function generateReferralCodeFromUID(uid: string): string {
  // A simple hashing function to convert the string UID into a number.
  // This is not for cryptographic purposes, just for creating a varied number.
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  // Take the absolute value and convert to a base-36 string (0-9, A-Z).
  // This creates a compact, alphanumeric representation.
  const code = Math.abs(hash).toString(36).toUpperCase();

  // Pad with leading 'R' and take a slice to ensure a consistent length (e.g., 8 characters).
  return ('R' + code + '00000000').slice(0, 8);
}

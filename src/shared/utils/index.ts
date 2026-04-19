// ─────────────────────────────────────────────────────────────────────────────
// shared/utils/index.ts
// Pure helper functions used across the backend.
// ─────────────────────────────────────────────────────────────────────────────
import { Types } from 'mongoose';

/**
 * Returns true when every string in the array is a valid MongoDB ObjectId.
 */
export function areValidObjectIds(...ids: string[]): boolean {
  return ids.every((id) => Types.ObjectId.isValid(id));
}

/**
 * Converts a string[] of ObjectId strings to ObjectId[].
 * Throws if any ID is invalid.
 */
export function toObjectIds(ids: string[]): Types.ObjectId[] {
  if (!ids.every((id) => Types.ObjectId.isValid(id))) {
    throw new Error('One or more IDs are not valid ObjectIds');
  }
  return ids.map((id) => new Types.ObjectId(id));
}

/**
 * Removes undefined keys from an object (safe to spread into Mongoose updates).
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Generates a random alphanumeric string of the given length.
 * Useful for temp codes, slugs, etc.
 */
export function randomString(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Sleep for a given number of milliseconds (useful in tests / dev).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses an integer from a query-string value.
 * Returns `defaultValue` when the input is missing or NaN.
 */
export function parseIntQuery(value: unknown, defaultValue: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultValue;
}

/**
 * Clamps a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a unique username candidate based on a base string + 4-digit suffix.
 * Uniqueness must still be verified in the DB by the caller.
 */
export function deriveUsername(base: string): string {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 30) || 'user';
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  return `${clean}_${suffix}`;
}

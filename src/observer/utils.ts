import { logger } from '../tiledesk-logger/index';

/**
 * Safely parse a JSON string. Returns null and logs an error on failure
 * instead of throwing and crashing the worker process.
 */
export function safeParseJSON(raw: string, context: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    logger.error(`[${context}] Failed to parse message JSON: ${(err as Error).message}`);
    return null;
  }
}

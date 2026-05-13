/** Shared type definitions for Chat21Client. */

export interface ParsedTopic {
  conversWith: string;
}

export interface CallbackHandler {
  type: string;
  conversWith: string;
  callback: (message: Record<string, unknown>, topic: ParsedTopic) => void;
}

export interface RequestOptions {
  url: string;
  headers: Record<string, string>;
  data?: Record<string, unknown>;
  method: string;
}

export type MessageCallback = (message: Record<string, unknown>, topic: ParsedTopic) => void;
export type SimpleCallback = (err?: Error | null) => void;
export type DataCallback = (err: Error | null, data: unknown) => void;
export type RequestCallback = (err: Error | null, response: unknown, json: unknown) => void;

export function isBrowser(): boolean {
  return false;
}

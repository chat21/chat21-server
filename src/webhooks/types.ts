/** Internal type aliases used by the Webhooks class. */

export type WorkCallback = (ok: boolean) => void;
export type SendDataCallback = (err: Error | { statusCode: number } | null, data: string | null) => void;
export type SimpleCallback = (err: Error | null) => void;

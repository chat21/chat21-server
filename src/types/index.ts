// Shared domain types for chat21-server

// ─── Message ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  message_id?: string;
  sender?: string;
  recipient?: string;
  app_id?: string;
  text?: string;
  type?: string;
  status?: number;
  channel_type?: string;
  timestamp?: number;
  group?: GroupInlineSpec;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  __history?: boolean;
  [key: string]: unknown;
}

/** Inline group spec embedded in a message (for group creation on first message) */
export interface GroupInlineSpec {
  uid?: string;
  name?: string;
  members: Record<string, number>;
  [key: string]: unknown;
}

// ─── Group ───────────────────────────────────────────────────────────────────

export interface Group {
  uid: string;
  name?: string;
  members: Record<string, number>;
  createdAt?: Date | number;
  updatedAt?: Date | number;
  [key: string]: unknown;
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface Conversation {
  id?: string;
  app_id?: string;
  sender?: string;
  recipient?: string;
  status?: number;
  last_message?: Partial<ChatMessage>;
  timestamp?: number;
  channel_type?: string;
  [key: string]: unknown;
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

export interface RateBucket {
  tokens: number;
  timestamp: Date;
}

export interface RateConfig {
  /**
   * Maximum number of messages allowed in the time window.
   * Default: 600
   */
  max_requests: number;
  /**
   * Time window in milliseconds.
   * Default: 60000 (1 minute)
   */
  time_window_ms: number;
}

export interface RateManagerConfig {
  tdCache?: import('../TdCache').TdCache;
  rateConfig?: RateConfig;
}

// ─── Redis / Cache ────────────────────────────────────────────────────────────

export interface TdCacheConfig {
  host: string;
  port: number | string;
  password?: string;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookConfig {
  amqpConn: import('amqplib/callback_api').Connection;
  logger?: unknown;
}

// ─── Observer / Server config ─────────────────────────────────────────────────

export interface ActiveQueues {
  messages?: boolean;
  persist?: boolean;
  [queue: string]: boolean | undefined;
}

export interface ServerConfig {
  app_id?: string;
  exchange?: string;
  rabbitmq_uri?: string;
  /** Alias for rabbitmq_uri accepted by startServer */
  mongodb_uri?: string;
  redis_enabled?: boolean | string;
  redis_host?: string;
  redis_port?: string | number;
  redis_password?: string;
}

/**
 * Shared mutable state for the observer module.
 * All observer submodules import and mutate this singleton.
 * Using an object container ensures mutations are visible across CommonJS modules.
 */
import amqp from 'amqplib/callback_api';
import type { ChatDB } from '../chatdb/index';
import type { Webhooks } from '../webhooks/index';
import type { TdCache } from '../TdCache';
import type RateManager from '../services/RateManager';
import type { ActiveQueues } from '../types/index';

export interface ObserverState {
  amqpConn: amqp.Connection | null;
  exchange: string;
  app_id: string;
  tdcache: TdCache | null;
  topic_outgoing: string;
  topic_update: string;
  topic_archive: string;
  topic_presence: string;
  topic_persist: string;
  topic_delivered: string;
  topic_update_group: string;
  chatdb: ChatDB | null;
  webhooks: Webhooks | null;
  webhook_enabled: boolean;
  presence_enabled: boolean;
  durable_enabled: boolean;
  redis_enabled: boolean;
  autoRestartProperty: boolean | undefined;
  rate_manager: RateManager | null;
  rabbitmq_uri: string;
  active_queues: ActiveQueues;
  webhook_endpoints_array: string[] | null | undefined;
  webhook_events_array: string[] | null | undefined;
  prefetch_messages: number;
  pubChannel: amqp.ConfirmChannel | null;
  offlinePubQueue: Array<[string, string, Buffer]>;
  channel: amqp.Channel | null;
  analytics_enabled: boolean;
  analytics_exchange: string;
  /** URI for the dedicated analytics RabbitMQ broker (may differ from rabbitmq_uri). */
  analytics_rabbitmq_uri: string;
  /** AMQP connection to the analytics broker (separate from amqpConn). */
  analyticsConn: amqp.Connection | null;
  /** Confirm channel on the analytics broker used exclusively for analytics publishes. */
  analyticsPubChannel: amqp.ConfirmChannel | null;
  /**
   * In-memory maps used to resolve id_project for analytics events without
   * any database round-trip:
   *
   *  messageProjectCache  message_id  → projectId
   *    Populated by deliverMessage() when status=DELIVERED; consumed by
   *    process_update() for message.return_receipt events.
   *
   *  userProjectCache     user_id     → projectId
   *    Populated by deliverMessage() for both sender and recipient; consumed
   *    by process_presence() for user.presence_changed events.
   */
  messageProjectCache: Map<string, string>;
  userProjectCache: Map<string, string>;
}

export const observerState: ObserverState = {
  amqpConn: null,
  exchange: 'amq.topic',
  app_id: 'tilechat',
  tdcache: null,
  topic_outgoing: '',
  topic_update: '',
  topic_archive: '',
  topic_presence: '',
  topic_persist: '',
  topic_delivered: '',
  topic_update_group: '',
  chatdb: null,
  webhooks: null,
  webhook_enabled: true,
  presence_enabled: false,
  durable_enabled: true,
  redis_enabled: false,
  autoRestartProperty: undefined,
  rate_manager: null,
  rabbitmq_uri: '',
  active_queues: { messages: true, persist: true },
  webhook_endpoints_array: undefined,
  webhook_events_array: undefined,
  prefetch_messages: 10,
  pubChannel: null,
  offlinePubQueue: [],
  channel: null,
  analytics_enabled: false,
  analytics_exchange: 'tiledesk.analytics',
  analytics_rabbitmq_uri: '',
  analyticsConn: null,
  analyticsPubChannel: null,
  messageProjectCache: new Map<string, string>(),
  userProjectCache: new Map<string, string>(),
};

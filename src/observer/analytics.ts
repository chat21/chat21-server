/**
 * Analytics publisher — fire-and-forget AMQP events to tiledesk.analytics exchange.
 *
 * Design constraints:
 *  - Never throws; wraps every publish in try/catch and logs at warn level.
 *  - Never closes the AMQP connection (does NOT reuse publish.ts which does that on error).
 *  - No-ops silently when analytics_enabled=false or pubChannel is not ready.
 *  - Uses the existing pubChannel directly without a confirm callback (no ack tracking needed).
 */
import { v4 as uuidv4 } from 'uuid';
import { observerState } from './state';
import { logger } from '../tiledesk-logger/index';

export function trackAnalyticsEvent(
  eventType: string,
  idProject: string | undefined | null,
  payload: Record<string, unknown>
): void {
  if (!observerState.analytics_enabled) return;
  if (!idProject) {
    logger.debug(`[Analytics] skipping event '${eventType}': no id_project`);
    return;
  }
  if (!observerState.analyticsPubChannel) {
    logger.warn(`[Analytics] skipping event '${eventType}': analyticsPubChannel not ready`);
    return;
  }

  const envelope = {
    event_id: uuidv4(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    id_project: idProject,
    source_service: 'c21srv',
    event_version: '1.0',
    payload,
  };

  const routingKey = `analytics.${eventType}`;

  try {
    observerState.analyticsPubChannel.publish(
      observerState.analytics_exchange,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: false }
    );
    logger.debug(`[Analytics] published '${eventType}' for project '${idProject}'`);
  } catch (e) {
    logger.warn(`[Analytics] failed to publish '${eventType}':`, (e as Error).message);
  }
}

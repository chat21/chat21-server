/**
 * AMQP publish helper. Uses the shared pubChannel from observer state.
 */
import { observerState } from './state';
import { logger } from '../tiledesk-logger/index';

export function publish(
  exchange: string,
  routingKey: string,
  content: Buffer,
  callback: (err: Error | null) => void
): void {
  logger.debug("[AMQP] publish routingKey:", routingKey);
  if (routingKey.length > 255) {
    logger.error("routingKey invalid length (> 255). Publish canceled.", routingKey.length);
    callback(null);
    return;
  }
  try {
    observerState.pubChannel!.publish(exchange, routingKey, content, { persistent: true },
      function (err) {
        if (err) {
          logger.error("[AMQP] publish error:", err);
          observerState.offlinePubQueue.push([exchange, routingKey, content]);
          observerState.pubChannel!.connection.close();
          callback(err);
        } else {
          callback(null);
        }
      });
  } catch (e) {
    logger.error("[AMQP] publish", (e as Error).message);
    observerState.offlinePubQueue.push([exchange, routingKey, content]);
    callback(e as Error);
  }
}

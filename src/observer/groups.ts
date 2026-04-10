/**
 * Group-related cache helpers: look up, persist, and inspect group data.
 */
import { observerState } from './state';
import { logger } from '../tiledesk-logger/index';

export async function groupFromCache(group_id: string): Promise<Record<string, unknown> | null> {
  logger.log("groupFromCache() group_id:", group_id);
  if (observerState.redis_enabled && observerState.tdcache) {
    const group_key = "chat21:messages:groups:" + group_id;
    logger.log("group key", group_key);
    try {
      const value = await observerState.tdcache.get(group_key);
      logger.log("got group by key:", value);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.error("Error during groupFromCache():", err);
      return null;
    }
  } else {
    logger.log("No redis.");
    return null;
  }
}

export async function saveGroupInCache(
  group: Record<string, unknown>,
  group_id: string,
  callback: () => void
): Promise<void> {
  if (observerState.redis_enabled && observerState.tdcache) {
    const group_key = "chat21:messages:groups:" + group_id;
    await observerState.tdcache.set(group_key, JSON.stringify(group), { EX: 86400 });
    callback();
  } else {
    callback();
  }
}

/**
 * Retrieves a group by ID. Uses the optional `prefetchPromise` when it was
 * already started in parallel with a rate-limit check to avoid an extra Redis RTT.
 */
export function getGroup(
  group_id: string,
  callback: (err: Error | null, group: Record<string, unknown> | null) => void,
  prefetchPromise?: Promise<Record<string, unknown> | null> | null
): void {
  logger.log("**** getGroup:", group_id);
  const cachePromise = prefetchPromise || groupFromCache(group_id);
  cachePromise.then((group) => {
    logger.log("group from cache?", group);
    if (group) {
      logger.log("--GROUP", group_id, "FOUND IN CACHE:", group);
      callback(null, group);
    } else {
      logger.log("--GROUP", group_id, "NO CACHE! GET FROM DB...");
      observerState.chatdb!.getGroup(group_id, function (err, dbGroup) {
        if (!err && dbGroup) {
          saveGroupInCache(dbGroup, group_id, () => {});
        }
        logger.log("group from db:", dbGroup);
        callback(err, dbGroup);
      });
    }
  }).catch((err) => {
    logger.error("groupFromCache error:", err);
    observerState.chatdb!.getGroup(group_id, callback);
  });
}

export function isGroupMessage(message: Record<string, unknown>): boolean {
  if (!message) {
    return false;
  }
  if (
    (message.channel_type && message.channel_type === 'group') ||
    (message.recipient && (message.recipient as string).includes("group-"))
  ) {
    return true;
  }
  return false;
}

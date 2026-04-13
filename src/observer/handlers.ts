/**
 * AMQP message router and all topic-specific handlers.
 *
 * Sections:
 *   1. Message router  (work)
 *   2. Presence handler
 *   3. Outgoing message handler
 *   4. Delivered handler
 *   5. Persist handler
 *   6. Update handler (messages + conversations)
 *   7. Archive handler
 *   8. Group-update handler
 */
import amqp from 'amqplib/callback_api';
import { v4 as uuidv4 } from 'uuid';
import { observerState } from './state';
import { publish } from './publish';
import {
  messagesProjectCounter,
  messagesIPCounter,
  messagesProjectIPCounter,
  messagesTopicCounter
} from './prometheus';
import { groupFromCache, saveGroupInCache, getGroup, isGroupMessage } from './groups';
import { deliverMessage, deliverGroupUpdated, sendMessageToGroupMembers } from './message';
import { logger } from '../tiledesk-logger/index';
import { safeParseJSON } from './utils';
import MessageConstants from '../models/messageConstants';
import { trackAnalyticsEvent } from './analytics';

// ─── Message router ──────────────────────────────────────────────────────────

export function work(msg: amqp.Message, callback: (ok: boolean) => void): void {
  if (!msg) {
    logger.error("Error. Work Message is empty. Removing this job with ack=ok.", msg);
    callback(true);
    return;
  }
  logger.debug("work NEW TOPIC (v0.2.48): " + msg.fields.routingKey);
  const topic = msg.fields.routingKey;
  const message_string = msg.content.toString();
  if (topic.endsWith('.outgoing')) {
    process_outgoing(topic, message_string, callback);
  } else if (topic.endsWith('.persist')) {
    process_persist(topic, message_string, callback);
  } else if (topic.endsWith('.delivered')) {
    process_delivered(topic, message_string, callback);
  } else if (topic.endsWith('.archive')) {
    logger.log("Got presence topic:", topic);
    process_archive(topic, message_string, callback);
  } else if (topic.includes('.presence.')) {
    process_presence(topic, message_string, callback);
  } else if (topic.endsWith('.groups.update')) {
    process_update_group(topic, message_string, callback);
  } else if (topic.endsWith('.update')) {
    process_update(topic, message_string, callback);
  } else {
    logger.error("unhandled topic:", topic);
    callback(true);
  }
}

// ─── Presence ────────────────────────────────────────────────────────────────

function process_presence(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  callback(true);
  if (!observerState.presence_enabled) {
    logger.log("Presence disabled");
    return;
  }
  logger.debug("> got PRESENCE testament", message_string, " on topic", topic);

  // Parse topic parts early — needed for both analytics and webhook.
  // Topic format: apps.<app_id>.users.<user_id>.presence.<client_id>
  const topic_parts = topic.split(".");
  if (topic_parts.length < 4) {
    logger.error("[process_presence] Malformed topic (expected ≥4 parts):", topic);
    return;
  }
  const pres_app_id = topic_parts[1];
  const user_id = topic_parts[3];
  const client_id = topic_parts[5] ?? null;

  const presence_payload = safeParseJSON(message_string, 'process_presence');
  if (!presence_payload) return;
  logger.debug("presence_payload:", presence_payload);
  const presence_status = presence_payload.connected ? "online" : "offline";
  logger.debug("presence_status:", presence_status);

  // Analytics: fires regardless of webhook_enabled.
  // Resolve the project ID from the in-memory user cache (populated by
  // deliverMessage() with zero DB cost) instead of querying MongoDB.
  const id_project = observerState.userProjectCache.get(user_id) ?? null;
  trackAnalyticsEvent('user.presence_changed', id_project, {
    user_id,
    client_id,
    status: presence_status,
    app_id: pres_app_id,
  });

  if (!observerState.webhook_enabled) {
    logger.debug("WEBHOOKS DISABLED. Skipping presence notification");
    return;
  }

  const presence_event = {
    "event_type": "presence-change",
    "presence": presence_status,
    "createdAt": new Date().getTime(),
    "app_id": pres_app_id,
    "user_id": user_id,
    "data": true,
    temp_webhook_endpoints: observerState.webhook_endpoints_array
  };
  const presence_event_string = JSON.stringify(presence_event);
  const presence_webhook_topic = `observer.webhook.apps.${pres_app_id}.presence`;
  logger.debug(">>> NOW PUBLISHING PRESENCE. TOPIC: " + presence_webhook_topic + ", EVENT PAYLOAD ", presence_event_string);
  publish(observerState.exchange, presence_webhook_topic, Buffer.from(presence_event_string), function (err) {
    logger.debug(">>> PUBLISHED PRESENCE!" + presence_webhook_topic + " WITH PATCH: " + presence_event_string);
    if (err) {
      logger.error("publish presence error:", err);
    } else {
      logger.log("PRESENCE UPDATE PUBLISHED");
    }
  });
}

// ─── Outgoing message ────────────────────────────────────────────────────────

async function process_outgoing(topic: string, message_string: string, callback: (ok: boolean) => void): Promise<void> {
  callback(true);
  logger.debug("***** TOPIC outgoing: " + topic + " MESSAGE PAYLOAD: " + message_string);
  const topic_parts = topic.split(".");
  if (topic_parts.length < 7) {
    logger.error("[process_outgoing] Malformed topic (expected ≥7 parts):", topic);
    return;
  }
  const out_app_id = topic_parts[1];
  const sender_id = topic_parts[4];
  const recipient_id = topic_parts[6];

  // Pre-fetch group from cache in parallel with the rate limit check to save a Redis RTT.
  const groupCachePromise = recipient_id.includes("group-")
    ? groupFromCache(recipient_id).catch(() => null)
    : null;

  if (observerState.rate_manager) {
    const allowed = await observerState.rate_manager.canExecute(sender_id, 'message');
    if (!allowed) {
      console.warn("Webhook rate limit exceeded for user " + sender_id);
      return;
    }
  }

  const outgoing_message: Record<string, unknown> | null = safeParseJSON(message_string, 'process_outgoing');
  if (!outgoing_message) return;

  if (topic) {
    messagesTopicCounter.inc({ topic: topic });
  }

  if (outgoing_message.attributes) {
    const attrs = outgoing_message.attributes as Record<string, string>;
    const project_id = attrs.projectId;
    const ip_address = attrs.ipAddress;
    if (project_id) {
      messagesProjectCounter.inc({ project_id: project_id });
    }
    if (ip_address) {
      messagesIPCounter.inc({ ip_address: ip_address });
    }
    if (project_id && ip_address) {
      messagesProjectIPCounter.inc({ project_id: project_id, ip_address: ip_address });
    }
  }

  const messageId = uuidv4();
  outgoing_message.message_id = messageId;
  outgoing_message.sender = sender_id;
  outgoing_message.recipient = recipient_id;
  outgoing_message.app_id = out_app_id;
  if (!outgoing_message.timestamp) {
    logger.debug("No timestamp provided, forcing to Date.now()");
    outgoing_message.timestamp = Date.now();
  } else {
    logger.debug("Timestamp provided.");
  }

  if (!isGroupMessage(outgoing_message)) {
    logger.debug("Direct message.");
    const inbox_of = sender_id;
    const convers_with = recipient_id;
    const sent_message = { ...outgoing_message };
    const delivered_message = { ...outgoing_message };
    sent_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
    deliverMessage(sent_message, out_app_id, inbox_of, convers_with, function (ok) {
      logger.debug("delivered to sender. OK?", ok);
      if (ok) {
        delivered_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED;
        const inbox_of2 = recipient_id;
        const convers_with2 = sender_id;
        deliverMessage(delivered_message, out_app_id, inbox_of2, convers_with2, function (ok2) {
          logger.debug("delivered to recipient. OK?", ok2);
        });
      } else {
        logger.debug("Error delivering: ", outgoing_message);
      }
    });
  } else {
    const group_id = recipient_id;
    // Analytics: fire message.delivered once per group message here, before the
    // fan-out to individual members, to avoid N-per-member event inflation.
    // id_project is available directly from outgoing message attributes.
    {
      const grpAttrs = outgoing_message.attributes as Record<string, unknown> | undefined;
      const grp_id_project = (grpAttrs?.projectId as string | undefined) ?? null;
      trackAnalyticsEvent('message.delivered', grp_id_project, {
        id_message: outgoing_message.message_id as string ?? '',
        sender_id: sender_id,
        recipient_id: group_id,
        app_id: out_app_id,
        channel_type: 'group',
        delivery_latency_ms: null,
        ip_address: (grpAttrs?.ipAddress as string) ?? null,
      });
    }
    if (outgoing_message.group) {
      logger.debug("Inline Group message.", outgoing_message);
      const inline_group = outgoing_message.group as Record<string, unknown>;
      inline_group.uid = group_id;
      (inline_group.members as Record<string, number>)[group_id] = 1;
      (inline_group.members as Record<string, number>)[sender_id] = 1;
      logger.debug("...inline_group:", inline_group);
      sendMessageToGroupMembers(outgoing_message, inline_group, out_app_id, (_ack) => {});
      return;
    }
    logger.debug("getting group:", group_id);
    getGroup(group_id, function (err, group) {
      if (!group) {
        logger.debug("group doesn't exist! Sending anyway to group timeline...");
        group = {
          uid: group_id,
          transient: true,
          members: {} as Record<string, number>
        };
        (group.members as Record<string, number>)[sender_id] = 1;
      }
      logger.debug("got group:" + JSON.stringify(group));
      (group.members as Record<string, number>)[group.uid as string] = 1;
      sendMessageToGroupMembers(outgoing_message, group, out_app_id, (_ack) => {
        logger.debug("Message sent to group:" + JSON.stringify(group));
      });
    }, groupCachePromise);
  }
}

// ─── Delivered ───────────────────────────────────────────────────────────────

function process_delivered(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  logger.debug(">>>>> DELIVERING:", topic, "MESSAGE PAYLOAD:", message_string);
  const topic_parts = topic.split(".");
  if (topic_parts.length < 7) {
    logger.error("[process_delivered] Malformed topic (expected ≥7 parts):", topic);
    callback(true);
    return;
  }
  const del_app_id = topic_parts[2];
  const inbox_of = topic_parts[4];
  const convers_with = topic_parts[6];
  const message: Record<string, unknown> | null = safeParseJSON(message_string, 'process_delivered');
  if (!message) { callback(true); return; }
  if (message.status !== MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
    logger.error("process_delivered() error: status != DELIVERED (150). Only delivering messages with status DELIVERED", message);
    callback(true);
    return;
  }
  logger.debug("____DELIVER MESSAGE (status=" + message.status + "):", message.text, message.message_id, ", __history:", message.__history);
  deliverMessage(message, del_app_id, inbox_of, convers_with, function (ok) {
    logger.debug("MESSAGE DELIVERED?: " + ok);
    if (!ok) {
      logger.error("____Error delivering message. NOACKED:", message);
      logger.log("____DELIVER MESSAGE:", message.message_id, " (noack)!");
      callback(true);
    } else {
      logger.log("____DELIVER MESSAGE ", message.message_id, " ACKED");
      callback(true);
    }
  });
}

// ─── Persist ─────────────────────────────────────────────────────────────────

function process_persist(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  logger.debug(">>>>> TOPIC persist: " + topic + " MESSAGE PAYLOAD: " + message_string);
  const topic_parts = topic.split(".");
  if (topic_parts.length < 7) {
    logger.error("[process_persist] Malformed topic (expected ≥7 parts):", topic);
    callback(true);
    return;
  }
  const per_app_id = topic_parts[2];
  const me = topic_parts[4];
  const convers_with = topic_parts[6];

  const persist_message: Record<string, unknown> | null = safeParseJSON(message_string, 'process_persist');
  if (!persist_message) { callback(true); return; }
  const savedMessage = persist_message;
  savedMessage.app_id = per_app_id;
  savedMessage.timelineOf = me;
  savedMessage.conversWith = convers_with;

  let update_conversation = true;
  if (savedMessage.attributes && (savedMessage.attributes as Record<string, unknown>).updateconversation === false) {
    update_conversation = false;
  }
  observerState.chatdb!.saveOrUpdateMessage(savedMessage, function (_err) {
    if (update_conversation) {
      const conversation: Record<string, unknown> = { ...persist_message };
      conversation.conversWith = convers_with;
      conversation.key = convers_with;
      conversation.is_new = true;
      conversation.archived = false;
      conversation.last_message_text = conversation.text;
      observerState.chatdb!.saveOrUpdateConversation(conversation, (err) => {
        if (err) {
          logger.error("(chatdb.saveOrUpdateConversation callback) ERROR (noack): ", err);
          callback(true);
        } else {
          callback(true);
        }
      });
    } else {
      logger.debug("Skip updating conversation. (update_conversation = false)");
      callback(true);
    }
  });
}

// ─── Update (messages + conversations) ───────────────────────────────────────

function process_update(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  const topic_parts = topic.split(".");
  logger.debug("UPDATE. TOPIC PARTS:", topic_parts);
  logger.debug("payload:" + message_string);
  if (topic_parts.length < 5) {
    logger.debug("Error GRAVE- process_update topic error - SKIP UPDATE. topic_parts.length < 5.", topic);
    callback(true);
    return;
  }
  if (topic_parts[4] === "messages") {
    logger.debug(" MESSAGE UPDATE.");
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    const message_id = topic_parts[6];
    logger.debug("updating message:", message_id, "on convers_with", convers_with, "for user", user_id, "patch", message_string);
    const patch: Record<string, unknown> | null = safeParseJSON(message_string, 'process_update:messages');
    if (!patch) { callback(true); return; }
    if (!patch.status || patch.status !== 200) {
      logger.debug("Error GRAVE- process_update: (!patch.status || patch.status != 200) - SKIP UPDATE.", topic);
      callback(true);
      return;
    }
    const me = user_id;
    const my_message_patch: Record<string, unknown> = {
      "timelineOf": me,
      "message_id": message_id,
      "status": patch.status
    };
    const dest_message_patch: Record<string, unknown> = {
      "timelineOf": convers_with,
      "message_id": message_id,
      "status": MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT
    };
    const dest_message_patch_payload = JSON.stringify(dest_message_patch);
    const recipient_message_update_topic = 'apps.tilechat.users.' + convers_with + '.messages.' + me + '.' + message_id + '.clientupdated';
    logger.debug(">>> NOW PUBLISHING... DEST_PATCH: RETURN_RECEIPT. TOPIC: " + recipient_message_update_topic + ", PATCH ", dest_message_patch);
    publish(observerState.exchange, recipient_message_update_topic, Buffer.from(dest_message_patch_payload), function (err) {
      logger.debug(">>> PUBLISHED!!!! RECIPIENT MESSAGE TOPIC UPDATE" + recipient_message_update_topic + " WITH PATCH: " + JSON.stringify(dest_message_patch));
      if (err) {
        logger.error("publish error (noack):", err);
        callback(true);
      } else {
        logger.log("webhook_enabled?????", observerState.webhook_enabled);
        if (observerState.webhook_enabled && observerState.webhooks) {
          observerState.webhooks.WHnotifyMessageStatusReturnReceipt(dest_message_patch, (err) => {
            if (err) {
              logger.error("WHnotifyMessageStatusReturnReceipt with err:" + err);
            } else {
              logger.debug("WHnotifyMessageStatusReturnReceipt ok");
            }
          });
        }
        // Analytics: track message.return_receipt.
        // Resolve the project ID from the in-memory message cache (populated
        // by deliverMessage() with zero DB cost) instead of querying MongoDB.
        const id_project = observerState.messageProjectCache.get(message_id) ?? null;
        trackAnalyticsEvent('message.return_receipt', id_project, {
          id_message: message_id,
          recipient_id: convers_with,
          id_request: null,
        });
        logger.debug(">>> ON DISK... WITH A STATUS ON MY MESSAGE-UPDATE TOPIC", topic, "WITH PATCH: " + JSON.stringify(my_message_patch));
        observerState.chatdb!.saveOrUpdateMessage(my_message_patch, function (err) {
          if (err) {
            logger.error("error on topic:", topic, " - Error (noack):", err);
            callback(true);
          } else {
            observerState.chatdb!.saveOrUpdateMessage(dest_message_patch, function (err) {
              if (err) {
                logger.error("error on topic:", topic, " - Error (noack):", err);
                callback(true);
              } else {
                callback(true);
              }
            });
          }
        });
      }
    });
  } else if (topic_parts[4] === "conversations") {
    logger.debug(" CONVERSATION UPDATE.");
    const upd_app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    logger.debug("updating conversation:" + convers_with + " for user " + user_id + " patch " + message_string);
    const patch: Record<string, unknown> | null = safeParseJSON(message_string, 'process_update:conversations');
    if (!patch) { callback(true); return; }
    const me = user_id;
    patch.timelineOf = me;
    patch.conversWith = convers_with;
    logger.debug(">>> ON DISK... CONVERSATION TOPIC " + topic + " WITH PATCH " + patch);
    logger.debug("Updating conversation 2.");
    observerState.chatdb!.saveOrUpdateConversation(patch, function (err) {
      logger.debug(">>> CONVERSATION ON TOPIC:", topic, "UPDATED?");
      if (err) {
        logger.error("CONVERSATION ON TOPIC UPDATE error (noack)", err);
        callback(true);
        return;
      }
      const patch_payload = JSON.stringify(patch);
      const my_conversation_update_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + '.clientupdated';
      logger.debug(">>> NOW PUBLISHING... MY CONVERSATION UPDATE " + my_conversation_update_topic + " WITH PATCH " + patch_payload);
      publish(observerState.exchange, my_conversation_update_topic, Buffer.from(patch_payload), function (err) {
        logger.debug(">>> PUBLISHED!!!! MY CONVERSATION UPDATE TOPIC " + my_conversation_update_topic + " WITH PATCH " + patch_payload);
        if (err) {
          logger.error("PUBLISH MY CONVERSATION UPDATE TOPIC error (noack)", err);
          callback(true);
        } else {
          callback(true);
        }
      });
    });
    void upd_app_id;
  }
}

// ─── Archive ─────────────────────────────────────────────────────────────────

function process_archive(topic: string, payload: string, callback: (ok: boolean) => void): void {
  logger.log("Inside presence function:", topic);
  const topic_parts = topic.split(".");
  logger.debug("ARCHIVE. TOPIC PARTS:" + topic_parts + "payload (ignored): " + payload);
  if (topic_parts.length < 7) {
    logger.debug("ERROR GRAVE. process_archive topic error. topic_parts.length < 7:" + topic);
    callback(true);
    return;
  }
  if (topic_parts[4] === "conversations") {
    logger.debug("CONVERSATION ARCHIVE.");
    const arc_app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    logger.debug("archiving conversation:" + convers_with + " for user " + user_id + " payload: " + payload);
    const conversation_archive_patch: Record<string, unknown> = {
      "timelineOf": user_id,
      "conversWith": convers_with,
      "archived": true
    };
    logger.debug("NOTIFY VIA WEBHOOK ON SAVE TOPIC " + topic);
    if (observerState.webhook_enabled && observerState.webhooks) {
      observerState.webhooks.WHnotifyConversationArchived(conversation_archive_patch, topic, (err) => {
        if (err) {
          logger.error("Webhook notified with err:" + err);
        } else {
          logger.debug("Webhook notified WHnotifyConversationArchived ok");
        }
      });
    }
    logger.debug(">>> ON DISK... ARCHIVE CONVERSATION ON TOPIC: " + topic);
    logger.debug("Updating conversation 3.");
    observerState.chatdb!.saveOrUpdateConversation(conversation_archive_patch, function (err) {
      logger.debug(">>> CONVERSATION ON TOPIC:", topic, "ARCHIVED!");
      if (err) {
        logger.error("CONVERSATION ON TOPIC: error (noack)", err);
        callback(true);
        return;
      }
      observerState.chatdb!.conversationDetail(arc_app_id, user_id, convers_with, true, (err, convs) => {
        if (err) {
          logger.error("Error GRAVE. getting conversationDetail()", err);
          callback(true);
        } else if (!convs || convs.length < 1) {
          logger.error("Error GRAVE. getting conversationDetail(): convs[].length < 1");
          callback(true);
        } else {
          const conversation_archived = convs[0];
          logger.debug("got archived conversation detail:", conversation_archived);
          const conversation_deleted_topic = 'apps.tilechat.users.' + user_id + '.conversations.' + convers_with + '.clientdeleted';
          logger.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (DELETED) TOPIC " + conversation_deleted_topic);
          const arc_payload = JSON.stringify(conversation_archived);
          publish(observerState.exchange, conversation_deleted_topic, Buffer.from(arc_payload), function (err) {
            logger.debug(">>> PUBLISHED!!!! CONVERSATION ON TOPIC: " + conversation_deleted_topic + " ARCHIVED (DELETED). Payload: " + arc_payload);
            if (err) {
              logger.error("error PUBLISHING CONVERSATION ON TOPIC:", err);
              callback(true);
            } else {
              const archived_conversation_added_topic = 'apps.tilechat.users.' + user_id + '.archived_conversations.' + convers_with + '.clientadded';
              logger.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (ADDED) TOPIC: " + archived_conversation_added_topic);
              publish(observerState.exchange, archived_conversation_added_topic, Buffer.from(arc_payload), function (err) {
                if (err) {
                  logger.error("error PUBLISHING ARCHIVED (DELETED) CONVERSATION ON TOPIC", err);
                  callback(true);
                } else {
                  logger.debug(">>> PUBLISHED ARCHIVED (DELETED) CONVERSATION ON TOPIC: " + conversation_deleted_topic);
                  callback(true);
                }
              });
            }
          });
        }
      });
    });
  }
}

// ─── Group update ─────────────────────────────────────────────────────────────

function process_update_group(topic: string, payload: string, callback: (ok: boolean) => void): void {
  const topic_parts = topic.split(".");
  logger.debug("process_update_group. TOPIC PARTS:" + topic_parts + "payload:" + payload);
  const grp_app_id = topic_parts[2];
  logger.debug("app_id:" + grp_app_id);
  logger.debug("payload:" + payload);
  const data: Record<string, unknown> | null = safeParseJSON(payload, 'process_update_group');
  if (!data) { callback(true); return; }
  logger.debug("process_update_group DATA ", JSON.stringify(data));
  const group = data.group as Record<string, unknown>;
  const notify_to = data.notify_to as Record<string, unknown>;
  if (!group || !group.uid) {
    logger.error("ERROR GRAVE. Group not found!");
    callback(true);
    return;
  }
  // Keep the cache in sync so that subsequent messages use the updated member list
  saveGroupInCache(group, group.uid as string, () => {});
  deliverGroupUpdated(group, notify_to, function (ok) {
    callback(ok);
  });
}

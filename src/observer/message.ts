/**
 * Message delivery helpers: publish a message to a user's inbox + persist topic,
 * send a message to all group members, and notify group-update events.
 */
import { observerState } from './state';
import { publish } from './publish';
import { logger } from '../tiledesk-logger/index';
import MessageConstants from '../models/messageConstants';

export function deliverMessage(
  message: Record<string, unknown>,
  app_id: string,
  inbox_of: string,
  convers_with_id: string,
  callback: (ok: boolean) => void
): void {
  logger.debug(">DELIVERING:", JSON.stringify(message), "inbox_of:", inbox_of, "convers_with:", convers_with_id);
  const persist_topic = `apps.observer.${app_id}.users.${inbox_of}.messages.${convers_with_id}.persist`;
  const added_topic = `apps.${app_id}.users.${inbox_of}.messages.${convers_with_id}.clientadded`;
  logger.debug("will pubblish on added_topic: " + added_topic);
  logger.debug("will pubblish on persist_topic: " + persist_topic);
  const message_payload = JSON.stringify(message);
  publish(observerState.exchange, added_topic, Buffer.from(message_payload), function (err) {
    if (err) {
      logger.error("Error on topic: ", added_topic, " Err:", err);
      callback(true);
      return;
    }
    logger.debug("NOTIFY VIA WHnotifyMessageStatusDelivered, topic: " + added_topic);
    if (observerState.webhooks && observerState.webhook_enabled) {
      logger.debug("webhooks && webhook_enabled ON, processing webhooks, message:", message);
      observerState.webhooks.WHnotifyMessageStatusSentOrDelivered(message_payload, added_topic, (err) => {
        if (err) {
          logger.error("WHnotifyMessageStatusSentOrDelivered with err (noack):" + err);
        } else {
          logger.debug("WHnotifyMessageStatusSentOrDelivered ok");
        }
      });
    }
    logger.debug("ADDED. NOW PUBLISH TO 'persist' TOPIC: " + persist_topic);
    publish(observerState.exchange, persist_topic, Buffer.from(message_payload), function (err) {
      if (err) {
        logger.error("Error PUBLISH TO 'persist' TOPIC (noack):", err);
        callback(true);
      } else {
        logger.debug("(WEBHOOK ENABLED) SUCCESSFULLY PUBLISHED ON:", persist_topic);
        callback(true);
      }
    });
  });
}

export function deliverGroupUpdated(
  group: Record<string, unknown>,
  notify_to: Record<string, unknown>,
  callback: (ok: boolean) => void
): void {
  const grp_app_id = group.appId as string;
  for (const [key] of Object.entries(notify_to)) {
    const member_id = key;
    const updated_group_topic = `apps.${grp_app_id}.users.${member_id}.groups.${group.uid}.clientupdated`;
    logger.debug("updated_group_topic:", updated_group_topic);
    const payload = JSON.stringify(group);
    publish(observerState.exchange, updated_group_topic, Buffer.from(payload), function (err) {
      if (err) {
        logger.error("error publish deliverGroupUpdated:", err);
      }
    });
  }
  callback(true);
}

export function sendMessageToGroupMembers(
  outgoing_message: Record<string, unknown>,
  group: Record<string, unknown>,
  app_id: string,
  callback: (ok: boolean) => void
): void {
  logger.debug("sendMessageToGroupMembers():", JSON.stringify(group));
  const members = group.members as Record<string, number>;
  for (const [member_id] of Object.entries(members)) {
    const inbox_of = member_id;
    const convers_with = group.uid as string;
    logger.debug("sendMessageToGroupMembers() inbox_of: " + inbox_of);
    logger.debug("sendMessageToGroupMembers() convers_with: " + convers_with);
    logger.debug("sendMessageToGroupMembers() sending group outgoing message to member", member_id);
    if (inbox_of === group.uid) {
      logger.debug("sendMessageToGroupMembers() inbox_of === outgoing_message.sender. status=SENT system YES?", inbox_of);
      outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
    } else if (
      outgoing_message.attributes &&
      (outgoing_message.attributes as Record<string, unknown>).hiddenFor &&
      (outgoing_message.attributes as Record<string, unknown>).hiddenFor === inbox_of
    ) {
      logger.debug('sendMessageToGroupMembers() sendGroupMessageToMembersTimeline skip message for ' + (outgoing_message.attributes as Record<string, unknown>).hiddenFor);
      break;
    } else {
      logger.debug("sendMessageToGroupMembers() inbox_of != outgoing_message.sender. status=DELIVERED no system, is:", inbox_of);
      outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED;
    }
    logger.debug("sendMessageToGroupMembers() delivering group message with status...", outgoing_message.status, " to:", inbox_of);
    deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function (ok) {
      logger.debug("GROUP MESSAGE DELIVERED?", ok);
      if (!ok) {
        logger.debug("Error sending message to group " + (group.uid as string) + " inbox_of: " + inbox_of);
      }
    });
  }
  callback(true);
}

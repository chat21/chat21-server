const { v4: uuidv4 } = require('uuid');
const MessageConstants = require("../models/messageConstants");
const logger = require('../tiledesk-logger').logger;

class MessageService {
  constructor(options = {}) {
    this.app_id = options.app_id;
    this.mqService = options.mqService;
    this.chatdb = options.chatdb;
    this.webhooks = options.webhooks;
    this.groupService = options.groupService;
    this.rate_manager = options.rate_manager;
    this.presence_enabled = options.presence_enabled;
    this.webhook_enabled = options.webhook_enabled;
    this.exchange = options.exchange || 'amq.topic';
    this.webhook_endpoints_array = options.webhook_endpoints_array;
  }

  async processMsg(msg, callback) {
    if (!msg) {
      logger.error("Error. Work Message is empty. Removing this job with ack=ok.", msg);
      callback(true);
      return;
    }
    const topic = msg.fields.routingKey;
    const message_string = msg.content.toString();
    logger.debug("Processing topic: " + topic);

    if (topic.endsWith('.outgoing')) {
      await this.process_outgoing(topic, message_string, callback);
    } else if (topic.endsWith('.persist')) {
      await this.process_persist(topic, message_string, callback);
    } else if (topic.endsWith('.delivered')) {
      await this.process_delivered(topic, message_string, callback);
    } else if (topic.endsWith('.archive')) {
      await this.process_archive(topic, message_string, callback);
    } else if (topic.includes('.presence.')) {
      await this.process_presence(topic, message_string, callback);
    } else if (topic.endsWith('.groups.update')) {
      await this.process_update_group(topic, message_string, callback);
    } else if (topic.endsWith('.update')) {
      await this.process_update(topic, message_string, callback);
    } else {
      logger.error("unhandled topic:", topic);
      callback(true);
    }
  }

  async process_presence(topic, message_string, callback) {
    callback(true);
    if (!this.presence_enabled) return;
    if (!this.webhook_enabled) return;

    const topic_parts = topic.split(".");
    const app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const presence_payload = JSON.parse(message_string);
    const presence_status = presence_payload.connected ? "online" : "offline";

    const presence_event = {
      "event_type": "presence-change",
      "presence": presence_status,
      "createdAt": new Date().getTime(),
      "app_id": app_id,
      "user_id": user_id,
      "data": true,
      temp_webhook_endpoints: this.webhook_endpoints_array
    };
    const presence_event_string = JSON.stringify(presence_event);
    const presence_webhook_topic = `observer.webhook.apps.${app_id}.presence`;
    this.mqService.publish(this.exchange, presence_webhook_topic, Buffer.from(presence_event_string), (err) => {
      if (err) logger.error("publish presence error:", err);
      else logger.log("PRESENCE UPDATE PUBLISHED");
    });
  }

  async process_outgoing(topic, message_string, callback) {
    callback(true);
    const topic_parts = topic.split(".");
    const app_id = topic_parts[1];
    const sender_id = topic_parts[4];
    const recipient_id = topic_parts[6];

    const allowed = await this.rate_manager.canExecute(sender_id, 'message');
    if (!allowed) {
      console.warn("Webhook rate limit exceeded for user " + sender_id);
      return;
    }

    const outgoing_message = JSON.parse(message_string);
    outgoing_message.message_id = uuidv4();
    outgoing_message.sender = sender_id;
    outgoing_message.recipient = recipient_id;
    outgoing_message.app_id = app_id;
    if (!outgoing_message.timestamp) outgoing_message.timestamp = Date.now();

    if (!this.isGroupMessage(outgoing_message)) {
      const sent_message = { ...outgoing_message, status: MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT };
      this.deliverMessage(sent_message, app_id, sender_id, recipient_id, (ok) => {
        if (ok) {
          const delivered_message = { ...outgoing_message, status: MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED };
          this.deliverMessage(delivered_message, app_id, recipient_id, sender_id, () => {});
        }
      });
    } else {
      const group_id = recipient_id;
      if (outgoing_message.group) {
        const inline_group = outgoing_message.group;
        inline_group.uid = group_id;
        inline_group.members[group_id] = 1;
        inline_group.members[sender_id] = 1;
        this.sendMessageToGroupMembers(outgoing_message, inline_group, app_id);
        return;
      }
      this.groupService.getGroup(group_id, (err, group) => {
        if (!group) {
          group = { uid: group_id, transient: true, members: {} };
          group.members[sender_id] = 1;
        }
        group.members[group.uid] = 1;
        this.sendMessageToGroupMembers(outgoing_message, group, app_id);
      });
    }
  }

  async process_delivered(topic, message_string, callback) {
    const topic_parts = topic.split(".");
    const app_id = topic_parts[2];
    const inbox_of = topic_parts[4];
    const convers_with = topic_parts[6];
    const message = JSON.parse(message_string);
    if (message.status != MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
      callback(true);
      return;
    }
    this.deliverMessage(message, app_id, inbox_of, convers_with, (ok) => {
      callback(true);
    });
  }

  async process_persist(topic, message_string, callback) {
    const topic_parts = topic.split(".");
    const app_id = topic_parts[2];
    const me = topic_parts[4];
    const convers_with = topic_parts[6];
    const persist_message = JSON.parse(message_string);
    persist_message.app_id = app_id;
    persist_message.timelineOf = me;
    persist_message.conversWith = convers_with;

    let update_conversation = !(persist_message.attributes && persist_message.attributes.updateconversation === false);
    
    this.chatdb.saveOrUpdateMessage(persist_message, (err) => {
      if (update_conversation) {
        const conversation = { ...persist_message, key: convers_with, is_new: true, archived: false, last_message_text: persist_message.text };
        this.chatdb.saveOrUpdateConversation(conversation, () => callback(true));
      } else {
        callback(true);
      }
    });
  }

  async process_update(topic, message_string, callback) {
    const topic_parts = topic.split(".");
    if (topic_parts.length < 5) return callback(true);

    if (topic_parts[4] === "messages") {
      const user_id = topic_parts[3];
      const convers_with = topic_parts[5];
      const message_id = topic_parts[6];
      const patch = JSON.parse(message_string);
      if (!patch.status || patch.status != 200) return callback(true);

      const dest_message_patch = {
        "timelineOf": convers_with,
        "message_id": message_id,
        "status": MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT
      };
      const recipient_message_update_topic = `apps.${this.app_id}.users.${convers_with}.messages.${user_id}.${message_id}.clientupdated`;
      
      try {
        await this.mqService.publishAsync(this.exchange, recipient_message_update_topic, Buffer.from(JSON.stringify(dest_message_patch)));
        if (this.webhook_enabled) this.WHnotifyMessageStatusReturnReceiptAsync(dest_message_patch);
        await this.saveOrUpdateMessageAsync({ timelineOf: user_id, message_id, status: patch.status });
        await this.saveOrUpdateMessageAsync(dest_message_patch);
        callback(true);
      } catch (err) {
        logger.error("process_update messages error:", err);
        callback(true);
      }
    } else if (topic_parts[4] === "conversations") {
      const user_id = topic_parts[3];
      const convers_with = topic_parts[5];
      const patch = JSON.parse(message_string);
      patch.timelineOf = user_id;
      patch.conversWith = convers_with;
      
      try {
        await this.saveOrUpdateConversationAsync(patch);
        const my_conversation_update_topic = `apps.${this.app_id}.users.${user_id}.conversations.${convers_with}.clientupdated`;
        await this.mqService.publishAsync(this.exchange, my_conversation_update_topic, Buffer.from(JSON.stringify(patch)));
        callback(true);
      } catch (err) {
        logger.error("process_update conversations error:", err);
        callback(true);
      }
    }
  }

  async process_archive(topic, payload, callback) {
    const topic_parts = topic.split(".");
    if (topic_parts.length < 7 || topic_parts[4] !== "conversations") return callback(true);

    const app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    const conversation_archive_patch = { "timelineOf": user_id, "conversWith": convers_with, "archived": true };

    if (this.webhook_enabled) this.WHnotifyConversationArchivedAsync(conversation_archive_patch, topic);

    try {
      await this.saveOrUpdateConversationAsync(conversation_archive_patch);
      const convs = await this.conversationDetailAsync(app_id, user_id, convers_with, true);
      if (convs && convs.length > 0) {
        const conversation_payload = Buffer.from(JSON.stringify(convs[0]));
        await this.mqService.publishAsync(this.exchange, `apps.${app_id}.users.${user_id}.conversations.${convers_with}.clientdeleted`, conversation_payload);
        await this.mqService.publishAsync(this.exchange, `apps.${app_id}.users.${user_id}.archived_conversations.${convers_with}.clientadded`, conversation_payload);
      }
      callback(true);
    } catch (err) {
      logger.error("process_archive error:", err);
      callback(true);
    }
  }

  async process_update_group(topic, payload, callback) {
    const data = JSON.parse(payload);
    const group = data.group;
    const notify_to = data.notify_to;
    if (!group || !group.uid) return callback(true);

    const app_id = group.appId;
    for (let member_id of Object.keys(notify_to)) {
      const updated_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientupdated`;
      this.mqService.publish(this.exchange, updated_group_topic, Buffer.from(JSON.stringify(group)), (err) => {
        if (err) logger.error("error publish deliverGroupUpdated:", err);
      });
    }
    callback(true);
  }

  deliverMessage(message, app_id, inbox_of, convers_with_id, callback) {
    const persist_topic = `apps.observer.${app_id}.users.${inbox_of}.messages.${convers_with_id}.persist`;
    const added_topic = `apps.${app_id}.users.${inbox_of}.messages.${convers_with_id}.clientadded`;
    const message_payload = Buffer.from(JSON.stringify(message));

    const tasks = [
      this.mqService.publishAsync(this.exchange, added_topic, message_payload).catch(err => logger.error("Error on topic: ", added_topic, err)),
      this.mqService.publishAsync(this.exchange, persist_topic, message_payload).catch(err => logger.error("Error on persist topic:", err))
    ];

    if (this.webhooks && this.webhook_enabled) {
      tasks.push(new Promise((resolve) => {
        this.webhooks.WHnotifyMessageStatusSentOrDelivered(message, added_topic, resolve);
      }));
    }

    Promise.all(tasks).then(() => callback(true));
  }

  sendMessageToGroupMembers(outgoing_message, group, app_id) {
    for (let member_id of Object.keys(group.members)) {
      const message = { ...outgoing_message };
      if (member_id === group.uid) message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
      else if (message.attributes && message.attributes.hiddenFor === member_id) continue;
      else message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED;

      this.deliverMessage(message, app_id, member_id, group.uid, () => {});
    }
  }

  isGroupMessage(message) {
    return !!(message && ((message.channel_type && message.channel_type === 'group') || (message.recipient && message.recipient.includes("group-"))));
  }

  // Async wrappers for ChatDB
  saveOrUpdateMessageAsync(message) {
    return new Promise((resolve, reject) => this.chatdb.saveOrUpdateMessage(message, (err, msg) => err ? reject(err) : resolve(msg)));
  }
  saveOrUpdateConversationAsync(conversation) {
    return new Promise((resolve, reject) => this.chatdb.saveOrUpdateConversation(conversation, (err, doc) => err ? reject(err) : resolve(doc)));
  }
  conversationDetailAsync(app_id, user_id, convers_with, archived) {
    return new Promise((resolve, reject) => this.chatdb.conversationDetail(app_id, user_id, convers_with, archived, (err, convs) => err ? reject(err) : resolve(convs)));
  }

  // Async wrappers for Webhooks
  WHnotifyMessageStatusReturnReceiptAsync(dest_message_patch) {
    return new Promise((resolve) => this.webhooks.WHnotifyMessageStatusReturnReceipt(dest_message_patch, resolve));
  }
  WHnotifyConversationArchivedAsync(conversation_archive_patch, topic) {
    return new Promise((resolve) => this.webhooks.WHnotifyConversationArchived(conversation_archive_patch, topic, resolve));
  }
}

module.exports = MessageService;

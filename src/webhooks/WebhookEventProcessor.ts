import * as MessageConstants from '../models/messageConstants';
import { WebhookSender } from './WebhookSender';

export interface WebhookEventProcessorContext {
    logger: any;
    enabled: boolean;
}

export class WebhookEventProcessor {
    ctx: WebhookEventProcessorContext;
    sender: WebhookSender;

    constructor(ctx: WebhookEventProcessorContext, sender: WebhookSender) {
        this.ctx = ctx;
        this.sender = sender;
    }

    async process_webhook_message_deliver(topic: string, message_string: string, callback?: any) {
        this.ctx.logger.debug("process WHprocess_webhook_message_deliver: " + message_string + " on topic: " + topic);
        var message = JSON.parse(message_string);
        if (callback) {
            callback(true);
        }

        if (!message['temp_webhook_endpoints']) {
            this.ctx.logger.debug("Error. WHprocess_webhook_message_deliver Discarding notification. webhook_endpoints undefined.");
            return;
        }

        let delivered_to_inbox_of = null;
        if (
            message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED ||
            message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT
            && message['temp_field_chat_topic']) {
            const topic_parts = message['temp_field_chat_topic'].split(".");
            if (topic_parts.length >= 4) {
                delivered_to_inbox_of = topic_parts[3];
            } else {
                this.ctx.logger.error("Error: inbox_of not found in topic:", topic);
                return;
            }
        } else {
            this.ctx.logger.error("Error. Topic processing error on message-delivered/message-sent event. Topic:", topic, ",message:", message);
            return;
        }

        const message_id = message.message_id;
        const recipient_id = message.recipient;
        const app_id = message.app_id;
        let event_type;
        if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
            event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT;
        } else {
            event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED;
        }
        var json: any = {
            event_type: event_type,
            createdAt: new Date().getTime(),
            recipient_id: recipient_id,
            app_id: app_id,
            message_id: message_id,
            data: message,
            extras: { topic: message['temp_field_chat_topic'] }
        };
        if (delivered_to_inbox_of) {
            json['delivered_to'] = delivered_to_inbox_of;
        }
        delete message['temp_field_chat_topic'];

        const endpoints = message['temp_webhook_endpoints'];
        delete message['temp_webhook_endpoints'];
        this.ctx.logger.log("Event JSON:" + JSON.stringify(json));

        const sendPromises = endpoints.map((endpoint: string) => {
            this.ctx.logger.debug("Sending notification to webhook (message_deliver) on webhook_endpoint:", endpoint);
            return this.sender.sendData(endpoint, json).catch((err: any) => {
                this.ctx.logger.error("Err WHsendData", err);
            });
        });
        await Promise.all(sendPromises);
    }

    async process_webhook_message_update(topic: string, message_string: string, callback?: any) {
        this.ctx.logger.debug("process WHprocess_webhook_message_update: " + message_string + " on topic: " + topic);
        var message = JSON.parse(message_string);
        this.ctx.logger.debug("timelineOf:" + message.timelineOf);
        if (callback) {
            callback(true);
        }

        if (!message['temp_webhook_endpoints']) {
            this.ctx.logger.debug("WHprocess_webhook_message_update Discarding notification. temp_webhook_endpoints undefined.");
            return;
        }

        const endpoints = message['temp_webhook_endpoints'];
        delete message['temp_webhook_endpoints'];

        const sendPromises = endpoints.map((endpoint: string) => {
            this.ctx.logger.debug("Sending notification to webhook (message_update) on webhook_endpoint:" + endpoint);
            const message_id = message.message_id;
            const recipient_id = message.recipient;
            const app_id = message.app_id;
            let event_type;
            if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.RECEIVED) {
                event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED;
            } else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT) {
                event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT;
            }
            var json = {
                event_type: event_type,
                createdAt: new Date().getTime(),
                recipient_id: recipient_id,
                app_id: app_id,
                message_id: message_id,
                data: message,
                extras: { topic: topic }
            };
            return this.sender.sendData(endpoint, json).catch((err: any) => {
                this.ctx.logger.error("Err WHsendData", err);
            });
        });
        await Promise.all(sendPromises);
    }

    async process_webhook_conversation_archived(topic: string, payload: any, callback?: any) {
        this.ctx.logger.debug("process webhook_conversation_archived on topic" + topic);
        this.ctx.logger.debug("process webhook_conversation_archived on payload" + payload);

        var conversation = JSON.parse(payload);
        this.ctx.logger.debug("conversation['temp_field_chat_topic']", conversation['temp_field_chat_topic']);
        if (callback) {
            callback(true);
        }

        if (this.ctx.enabled === false) {
            this.ctx.logger.debug("Discarding notification. webhook_enabled is false.");
            return;
        }

        if (!conversation['temp_webhook_endpoints']) {
            this.ctx.logger.debug("WHprocess_webhook_conversation_archived Discarding notification. temp_webhook_endpoints undefined.");
            return;
        }

        const endpoints = conversation['temp_webhook_endpoints'];
        delete conversation['temp_webhook_endpoints'];

        const sendPromises = endpoints.map((endpoint: string) => {
            this.ctx.logger.debug("Sending notification to webhook (webhook_conversation_archived):", endpoint);
            if (!conversation['temp_field_chat_topic']) {
                this.ctx.logger.debug("WHprocess_webhook_conversation_archived NO 'temp_field_chat_topic' error.");
            }
            var topic_parts = (conversation['temp_field_chat_topic'] || "").split(".");
            this.ctx.logger.debug("ARCHIVE. TOPIC PARTS:", topic_parts);
            if (topic_parts.length < 7) {
                this.ctx.logger.debug("process_archive topic error. topic_parts.length < 7:" + topic);
                return Promise.resolve();
            }
            const app_id = topic_parts[1];
            const user_id = topic_parts[3];
            const convers_with = topic_parts[5];

            var json = {
                event_type: MessageConstants.WEBHOOK_EVENTS.CONVERSATION_ARCHIVED,
                createdAt: new Date().getTime(),
                app_id: app_id,
                user_id: user_id,
                recipient_id: convers_with,
                convers_with: convers_with,
                data: conversation,
                extras: { topic: conversation['temp_field_chat_topic'] }
            };
            this.ctx.logger.debug("Sending JSON webhook:", json);
            return this.sender.sendData(endpoint, json).catch((err: any) => {
                this.ctx.logger.error("Err WHsendData", err);
            });
        });
        await Promise.all(sendPromises);
        delete conversation['temp_field_chat_topic'];
    }

    async process_webhook_presence(topic: string, presence_payload_string: string, callback?: any) {
        this.ctx.logger.debug("process WHprocess_webhook_presence: " + presence_payload_string + " on topic: " + topic);
        var payload = JSON.parse(presence_payload_string);
        if (callback) {
            callback(true);
        }
        if (!payload['temp_webhook_endpoints']) {
            this.ctx.logger.debug("WHprocess_webhook_presence Discarding notification. temp_webhook_endpoints undefined.");
            return;
        }

        const endpoints = payload['temp_webhook_endpoints'];
        delete payload['temp_webhook_endpoints'];

        const sendPromises = endpoints.map((endpoint: string) => {
            this.ctx.logger.debug("Sending notification to webhook (presence) on webhook_endpoint:" + endpoint);
            return this.sender.sendData(endpoint, payload).catch((err: any) => {
                this.ctx.logger.error("Err WHsendData", err);
            });
        });
        await Promise.all(sendPromises);
    }
}

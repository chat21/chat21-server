import * as MessageConstants from '../models/messageConstants';

export interface WebhooksContext {
    exchange: string;
    appId: string;
    webhook_endpoints: string[];
    webhook_events_array: string[];
    getWebHookEnabled(): boolean;
    publish(exchange: string, routingKey: string, content: Buffer, callback?: any): Promise<boolean>;
    logger: any;
}

export class WebhookNotifier {
    ctx: WebhooksContext;

    constructor(ctx: WebhooksContext) {
        this.ctx = ctx;
    }

    async notifyMessageStatusSentOrDelivered(message_payload: any, topic: string, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        this.ctx.logger.log("WHnotifyMessageStatusSentOrDelivered()", message_payload);
        let message;
        if (typeof message_payload === 'string') {
            message = JSON.parse(message_payload);
        } else {
            message = message_payload;
        }
        message['temp_field_chat_topic'] = topic;
        try {
            if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
                this.ctx.logger.log("SENT...");
                const result = await this.notifyMessageStatusSent(message);
                if (callback) callback(null, result);
                return result;
            } else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
                this.ctx.logger.log("DELIVERED...");
                const result = await this.notifyMessageStatusDelivered(message);
                if (callback) callback(null, result);
                return result;
            } else {
                this.ctx.logger.log("STATUS NEITHER SENT OR DELIVERED...");
                if (callback) callback(null);
            }
        } catch (err) {
            if (callback) callback(err);
            throw err;
        }
    }

    async notifyMessageStatusSent(message: any, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        this.ctx.logger.log("WH Sent method.");
        if (this.ctx.webhook_events_array.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT) == -1) {
            this.ctx.logger.debug("WH MESSAGE_SENT disabled.");
            if (callback) callback(null);
        } else {
            this.ctx.logger.log("WH MESSAGE_SENT enabled");
            try {
                const result = await this.notifyMessageDeliver(message);
                if (callback) callback(null, result);
                return result;
            } catch (err) {
                if (callback) callback(err);
                throw err;
            }
        }
    }

    async notifyMessageStatusDelivered(message: any, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        if (this.ctx.webhook_events_array.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED) == -1) {
            this.ctx.logger.debug("WH MESSAGE_DELIVERED disabled.");
            if (callback) callback(null);
        } else {
            this.ctx.logger.debug("WH MESSAGE_DELIVERED enabled.");
            try {
                const result = await this.notifyMessageDeliver(message);
                if (callback) callback(null, result);
                return result;
            } catch (err) {
                if (callback) callback(err);
                throw err;
            }
        }
    }

    async notifyMessageStatusReturnReceipt(message: any, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        if (this.ctx.webhook_events_array.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT) == -1) {
            this.ctx.logger.debug("WH MESSAGE_RETURN_RECEIPT disabled.");
            if (callback) callback(null);
        } else {
            try {
                const result = await this.notifyMessageUpdate(message);
                if (callback) callback(null, result);
                return result;
            } catch (err) {
                if (callback) callback(err);
                throw err;
            }
        }
    }

    async notifyMessageDeliver(message: any, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        message['temp_webhook_endpoints'] = this.ctx.webhook_endpoints;
        const notify_topic = `observer.webhook.apps.${this.ctx.appId}.message_deliver`;
        this.ctx.logger.debug("notifying webhook MessageSent topic:" + notify_topic);
        const message_payload = JSON.stringify(message);
        this.ctx.logger.debug("MESSAGE_PAYLOAD: " + message_payload);
        try {
            const result = await this.ctx.publish(this.ctx.exchange, notify_topic, Buffer.from(message_payload));
            if (callback) callback(null, result);
            return result;
        } catch (err) {
            this.ctx.logger.error("Error publishing webhook WHnotifyMessageDeliver", err);
            if (callback) callback(err);
            throw err;
        }
    }

    async notifyMessageUpdate(message: any, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        this.ctx.logger.debug("NOTIFY MESSAGE UPDATE:", message);
        const notify_topic = `observer.webhook.apps.${this.ctx.appId}.message_update`;
        this.ctx.logger.debug("notifying webhook message_update topic:" + notify_topic);
        const message_payload = JSON.stringify(message);
        this.ctx.logger.debug("MESSAGE_PAYLOAD: " + message_payload);
        try {
            const result = await this.ctx.publish(this.ctx.exchange, notify_topic, Buffer.from(message_payload));
            if (callback) callback(null, result);
            return result;
        } catch (err) {
            this.ctx.logger.error("Err", err);
            if (callback) callback(err);
            throw err;
        }
    }

    async notifyConversationArchived(conversation: any, topic: string, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("WHnotifyConversationArchived Discarding notification. webhook_enabled is false.");
            if (callback) callback(null);
            return;
        }
        this.ctx.logger.debug("NOTIFY CONVERSATION ARCHIVED:", conversation);
        conversation['temp_field_chat_topic'] = topic;
        const notify_topic = `observer.webhook.apps.${this.ctx.appId}.conversation_archived`;
        this.ctx.logger.debug("notifying webhook notifyConversationArchived topic: " + notify_topic);
        const payload = JSON.stringify(conversation);
        this.ctx.logger.debug("PAYLOAD:", payload);
        try {
            const result = await this.ctx.publish(this.ctx.exchange, notify_topic, Buffer.from(payload));
            if (callback) callback(null, result);
            return result;
        } catch (err) {
            this.ctx.logger.error("Err", err);
            if (callback) callback(err);
            throw err;
        }
    }

    async notifyPresence(payload: any, callback?: any) {
        if (this.ctx.getWebHookEnabled() === false) {
            this.ctx.logger.debug("webhooks disabled");
            if (callback) callback(null);
            return;
        }
        payload['temp_webhook_endpoints'] = this.ctx.webhook_endpoints;
        const notify_topic = `observer.webhook.apps.${this.ctx.appId}.presence`;
        this.ctx.logger.debug("notifying webhook Presence topic:" + notify_topic);
        const payload_string = JSON.stringify(payload);
        try {
            const result = await this.ctx.publish(this.ctx.exchange, notify_topic, Buffer.from(payload_string));
            if (callback) callback(null, result);
            return result;
        } catch (err) {
            this.ctx.logger.error("Err", err);
            if (callback) callback(err);
            throw err;
        }
    }
}

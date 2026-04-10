export const CHAT_MESSAGE_STATUS = {
  FAILED: 'failed',
  SENDING: 'sending',
  SENT: 'sent',           // saved into sender timeline
  DELIVERED: 'delivered', // delivered to recipient timeline
  RECEIVED: 'received',   // received from the recipient client
  RETURN_RECEIPT: 'return_receipt', // return receipt from the recipient client
  SEEN: 'seen',           // seen
} as const;

export const CHAT_MESSAGE_STATUS_CODE = {
  FAILED: -100,
  SENDING: 0,
  SENT: 100,          // saved into sender timeline
  DELIVERED: 150,     // delivered to recipient timeline
  RECEIVED: 200,      // received from the recipient client
  RETURN_RECEIPT: 250, // return receipt from the recipient client
  SEEN: 300,          // seen
} as const;

export const WEBHOOK_EVENTS = {
  MESSAGE_SENT: 'message-sent',
  MESSAGE_DELIVERED: 'message-delivered',
  MESSAGE_RECEIVED: 'message-received',
  MESSAGE_RETURN_RECEIPT: 'message-return-receipt',
  CONVERSATION_ARCHIVED: 'conversation-archived',
  CONVERSATION_UNARCHIVED: 'conversation-unarchived',
} as const;

export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUS)[keyof typeof CHAT_MESSAGE_STATUS];
export type ChatMessageStatusCode = (typeof CHAT_MESSAGE_STATUS_CODE)[keyof typeof CHAT_MESSAGE_STATUS_CODE];
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

const MessageConstants = {
  CHAT_MESSAGE_STATUS,
  CHAT_MESSAGE_STATUS_CODE,
  WEBHOOK_EVENTS,
};

export default MessageConstants;

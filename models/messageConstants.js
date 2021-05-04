module.exports = {
    CHAT_MESSAGE_STATUS : {
        FAILED : "failed",
        SENDING : "sending",
        SENT : "sent", //saved into sender timeline
        DELIVERED : "delivered", //delivered to recipient timeline
        RECEIVED : "received", //received from the recipient client
        RETURN_RECEIPT: "return_receipt", //return receipt from the recipient client
        SEEN : "seen" //seen

    },
     CHAT_MESSAGE_STATUS_CODE : {
        FAILED : -100,
        SENDING : 0,
        SENT : 100, //saved into sender timeline
        DELIVERED : 150, //delivered to recipient timeline
        RECEIVED : 200, //received from the recipient client
        RETURN_RECEIPT: 250, //return receipt from the recipient client
        SEEN : 300 //seen

    },
    WEBHOOK_EVENTS : {
        MESSAGE_SENT: 'message-sent',
        MESSAGE_DELIVERED: 'message-delivered',
        MESSAGE_RECEIVED: 'message-received',
        MESSAGE_RETURN_RECEIPT: 'message-return-receipt',
        CONVERSATION_ARCHIVED: 'conversation-archived',
        CONVERSATION_UNARCHIVED: 'conversation-unarchived'
    }
}
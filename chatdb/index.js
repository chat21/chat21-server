/* 
    ver 0.1.2
    Andrea Sponziello - (c) Tiledesk.com
*/

const winston = require("../winston");

/**
 * This is the class that manages DB persistence
 */
class ChatDB {

  /**
   * Constructor for Persistence object
   *
   * @example
   * const { ChatDB } = require('chatdb');
   * const chatdb = new ChatDB({database: db});
   *
   */
  constructor(options) {
    if (!options.database) {
      throw new Error('database option can NOT be empty.');
    }
    this.db = options.database
    this.messages_collection = 'messages'
    this.groups_collection = 'groups'
    this.conversations_collection = 'conversations'
    this.db.collection(this.messages_collection).createIndex(
      { 'timelineOf':1, 'message_id': 1 }
    );
    this.db.collection(this.conversations_collection).createIndex(
      { 'timelineOf':1, 'conversWith': 1 }
    );
    this.db.collection(this.groups_collection).createIndex(
      { 'uid':1 }
    );
  }

  saveOrUpdateMessage(message, callback) {
    winston.debug("saving message...", message)
    delete message['_id'] // if present (message is coming from a mongodb query?) it is illegal. It produces: MongoError: E11000 duplicate key error collection: tiledesk-dialogflow-proxy.messages index: _id_ dup key: { : "5ef72c2494e08ffec88a033a" }
    this.db.collection(this.messages_collection).updateOne({timelineOf: message.timelineOf, message_id: message.message_id}, { $set: message }, { upsert: true }, function(err, doc) {
      winston.debug("error...", err)
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  saveOrUpdateConversation(conversation, callback) {
    // winston.debug("saving conversation...", conversation)
    this.db.collection(this.conversations_collection).updateOne({timelineOf: conversation.timelineOf, conversWith: conversation.conversWith}, { $set: conversation}, { upsert: true }, function(err, doc) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          winston.debug("Conversation saved.")
          callback(null, doc)
        }
      }
    });
  }

  saveOrUpdateGroup(group, callback) {
    winston.debug("saving group...", group)
    this.db.collection(this.groups_collection).updateOne( { uid: group.uid }, { $set: group }, { upsert: true }, function(err, doc) {
      if (callback) {
        callback(err, null)
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  getGroup(group_id, callback) {
    this.db.collection(this.groups_collection).findOne( { uid: group_id }, function(err, doc) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  lastConversations(appid, userid, archived, callback) {
    winston.debug("DB. app:", appid, "user:", userid, "archived:", archived)
    this.db.collection(this.conversations_collection).find( { timelineOf: userid, app_id: appid, archived: archived } ).limit(200).sort( { timestamp: -1 } ).toArray(function(err, docs) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, docs)
        }
      }
    });
  }

  getConversation(timelineOf, conversWith, callback) {
    this.db.collection(this.conversations_collection).findOne( { timelineOf: timelineOf, conversWith: conversWith }, function(err, doc) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  lastMessages(appid, userid, convid, sort, limit, callback) {
    winston.debug("DB. app:", appid, "user:", userid, "convid", convid)
    this.db.collection(this.messages_collection).find( { timelineOf: userid, app_id: appid, conversWith: convid } ).limit(limit).sort( { timestamp: sort } ).toArray(function(err, docs) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, docs)
        }
      }
    });
  }

}

module.exports = { ChatDB };
/* 
    ver 0.1.2
    Andrea Sponziello - (c) Tiledesk.com
*/

const logger = require('../tiledesk-logger').logger;

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
    this.db.collection(this.conversations_collection).createIndex(
      { 'timelineOf': 1, 'conversWith': 1 }, { unique: 1 }
    );
    // CONVERSATIONS INDEX
    // if (options.UNIQUE_CONVERSATIONS_INDEX) {
    //   console.log("Setting up unique conversations index: { 'timelineOf':1, 'conversWith': 1 }, { unique: 1}");
    //   this.db.collection(this.conversations_collection).createIndex(
    //     { 'timelineOf': 1, 'conversWith': 1 }, { unique: 1 }
    //   );
    // }
    // else {
    //   console.log("Setting up simple conversations index: { 'timelineOf':1, 'conversWith': 1 }");
    //   this.db.collection(this.conversations_collection).createIndex(
    //     { 'timelineOf':1, 'conversWith': 1 }
    //   );
    // }
    // OTHER INDEXES
    this.db.collection(this.messages_collection).createIndex(
      { 'timelineOf':1, 'message_id': 1 }
    );
    
    this.db.collection(this.groups_collection).createIndex(
      { 'uid':1 }
    );
  }

  saveOrUpdateMessage(message, callback) {
    // logger.debug("saving message...", message)
    delete message['_id'] // if present (message is coming from a mongodb query?) it is illegal. It produces: MongoError: E11000 duplicate key error collection: tiledesk-dialogflow-proxy.messages index: _id_ dup key: { : "5ef72c2494e08ffec88a033a" }
    this.db.collection(this.messages_collection).updateOne({timelineOf: message.timelineOf, message_id: message.message_id}, { $set: message }, { upsert: true }, function(err, doc) {
      if (err) {
        console.error("db error...", err)
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
    // logger.debug("saving conversation...", conversation)
    this.db.collection(this.conversations_collection).updateOne({timelineOf: conversation.timelineOf, conversWith: conversation.conversWith}, { $set: conversation}, { upsert: true }, function(err, doc) {
      if (err) {
        logger.error("error saveOrUpdateConversation", err)
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          // logger.debug("Conversation saved.")
          callback(null, doc)
        }
      }
    });
  }

  saveOrUpdateGroup(group, callback) {
    logger.debug("saving group...", group)
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
    logger.debug("DB. app:", appid, "user:", userid, "archived:", archived)
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

  // DEPRECATED? //
  // getConversation(timelineOf, conversWith, callback) {
  //   this.db.collection(this.conversations_collection).findOne( { timelineOf: timelineOf, conversWith: conversWith }, function(err, doc) {
  //     if (err) {
  //       if (callback) {
  //         callback(err, null)
  //       }
  //     }
  //     else {
  //       if (callback) {
  //         callback(null, doc)
  //       }
  //     }
  //   });
  // }

  conversationDetail(appid, timelineOf, conversWith, archived, callback) {
    logger.debug("DB. app: "+ appid+ " user: " + timelineOf + " conversWith: "+ conversWith);
    this.db.collection(this.conversations_collection).find( { timelineOf: timelineOf, app_id: appid, conversWith: conversWith, archived: archived } ).limit(1).toArray(function(err, docs) {
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

  lastMessages(appid, userid, convid, sort, limit, callback) {
    logger.debug("DB. app:", appid, "user:", userid, "convid", convid)
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
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

    // Optimized index for lastMessages query
    this.db.collection(this.messages_collection).createIndex(
      { 'app_id': 1, 'timelineOf': 1, 'conversWith': 1, 'timestamp': -1 }
    );

    this.db.collection(this.groups_collection).createIndex(
      { 'uid':1 }
    );

    // Optimized index for lastConversations query
    this.db.collection(this.conversations_collection).createIndex(
      { 'app_id': 1, 'timelineOf': 1, 'archived': 1, 'timestamp': -1 }
    );
  }

  async saveOrUpdateMessage(message, callback) {
    // logger.debug("saving message...", message)
    delete message['_id'] // if present (message is coming from a mongodb query?) it is illegal. It produces: MongoError: E11000 duplicate key error collection: tiledesk-dialogflow-proxy.messages index: _id_ dup key: { : "5ef72c2494e08ffec88a033a" }
    try {
      const doc = await this.db.collection(this.messages_collection).updateOne({ timelineOf: message.timelineOf, message_id: message.message_id }, { $set: message }, { upsert: true });
      if (callback) {
        callback(null, doc)
      }
      return doc;
    }
    catch (err) {
      console.error("db error...", err)
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
  }

  async saveOrUpdateConversation(conversation, callback) {
    // logger.debug("saving conversation...", conversation)
    try {
      const doc = await this.db.collection(this.conversations_collection).updateOne({ timelineOf: conversation.timelineOf, conversWith: conversation.conversWith }, { $set: conversation }, { upsert: true });
      if (callback) {
        // logger.debug("Conversation saved.")
        callback(null, doc)
      }
      return doc;
    }
    catch (err) {
      logger.error("error saveOrUpdateConversation", err)
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
  }

  async saveOrUpdateGroup(group, callback) {
    logger.debug("saving group...", group)
    try {
      const doc = await this.db.collection(this.groups_collection).updateOne({ uid: group.uid }, { $set: group }, { upsert: true });
      if (callback) {
        callback(null, doc)
      }
      return doc;
    }
    catch (err) {
      logger.error("error saveOrUpdateGroup", err)
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
  }

  async getGroup(group_id, callback) {
    try {
      const doc = await this.db.collection(this.groups_collection).findOne({ uid: group_id });
      if (callback) {
        callback(null, doc)
      }
      return doc;
    }
    catch (err) {
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
  }

  async lastConversations(appid, userid, archived, callback) {
    logger.debug("DB. app:", appid, "user:", userid, "archived:", archived)
    try {
      const docs = await this.db.collection(this.conversations_collection).find({ timelineOf: userid, app_id: appid, archived: archived }).limit(200).sort({ timestamp: -1 }).toArray();
      if (callback) {
        callback(null, docs)
      }
      return docs;
    }
    catch (err) {
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
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

  async conversationDetail(appid, timelineOf, conversWith, archived, callback) {
    logger.debug("DB. app: " + appid + " user: " + timelineOf + " conversWith: " + conversWith);
    try {
      const docs = await this.db.collection(this.conversations_collection).find({ timelineOf: timelineOf, app_id: appid, conversWith: conversWith, archived: archived }).limit(1).toArray();
      if (callback) {
        callback(null, docs)
      }
      return docs;
    }
    catch (err) {
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
  }

  async lastMessages(appid, userid, convid, sort, limit, callback) {
    logger.debug("DB. app:", appid, "user:", userid, "convid", convid)
    try {
      const docs = await this.db.collection(this.messages_collection).find({ timelineOf: userid, app_id: appid, conversWith: convid }).limit(limit).sort({ timestamp: sort }).toArray();
      if (callback) {
        callback(null, docs)
      }
      return docs;
    }
    catch (err) {
      if (callback) {
        callback(err, null)
      }
      throw err;
    }
  }

}

module.exports = { ChatDB };

/* 
    ver 0.1
    Andrea Sponziello - (c) Tiledesk.com
*/

var Message = require("../models/message");

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
      throw new Error('mongodb option can NOT be empty.');
    }
    this.db = options.database
    this.messages_collection = 'messages'
  }

  saveMessage(message, callback) {
    console.log("saving message...", message)
    this.db.collection(this.messages_collection).insertOne(message, function(err, doc) {
      if (err) {
        console.log(err);
        if (callback) {
          callback(err, null)
        }
      }
      console.log("new message", doc);
      if (callback) {
        callback(null, doc)
      }
    });

    // message.save(function(err, savedMessage) {
    //     if (err) {
    //       console.log(err);
    //       callback(err, null)
    //     }
    //     console.log("new message", savedMessage.toObject());
    //     callback(null, savedMessage.toObject())
    //   });
  }

  updateMessage(message_fields, callback) {
    console.log("saving message...", message)
    this.db.collection(this.messages_collection).updateOne({message_id: message.message_id},
      {$set: message_fields}, function(err, doc) {
      if (err) {
        console.log(err);
        if (callback) {
          callback(err, null)
        }
      }
      console.log("updated message", doc);
      if (callback) {
        callback(null, doc)
      }
    });

    // message.save(function(err, savedMessage) {
    //     if (err) {
    //       console.log(err);
    //       callback(err, null)
    //     }
    //     console.log("new message", savedMessage.toObject());
    //     callback(null, savedMessage.toObject())
    //   });
  }
  

}

module.exports = { ChatDB };
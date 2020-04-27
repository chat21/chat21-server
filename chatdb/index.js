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
   * const chatdb = new ChatDB();
   *
   */
  constructor() {
  }

  saveMessage(message, callback) {
    console.log("saving message...", message)
    message.save(function(err, savedMessage) {
        if (err) {
          console.log(err);
          callback(err, null)
        }
        console.log("new message", savedMessage.toObject());
        callback(null, savedMessage.toObject())
      });
  }

  

}

module.exports = { ChatDB };
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

  saveMessage(newMessage, callback) {
    newMessage.save(function(err, savedMessage) {
        if (err) {
          console.log(err);
          return res.status(500).send({success: false, msg: 'Error saving object.', err:err});
        }
    
        console.log("new message", savedMessage.toObject());
        messageEvent.emit("message.create",savedMessage);
        res.json(savedMessage);
      });
  }

  

}

module.exports = { ChatDB };
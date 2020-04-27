var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ConversationSchema = new Schema({
  sender: {
    type: String,
    required: true
  },
  sender_fullname: {
    type: String,
    required: false
  },
  recipient: {
    type: String,
    required: true
  },
  recipient_fullname: {
    type: String,
    required: false
  },
  last_message_text: {
    type: String,
    required: true
  },
  app_id: {
    type: String,
    required: true,
    index: true
  },
  is_new : {
    type: Boolean,
    required: true,
    index: true,
    default: true
  },
  status: {
    type: String,
    required: true,
    index: true
  },
  
  channel_type: {
    type: String,
    required: true,
    index: true,
    default: "direct"
  },


  type: {
    type: String,
    required: true,
    index: true,
    default: "text"
  },

  attributes: {
    type: Object,
  },
  metadata: {
    type: Object,
  },
  createdBy: {
    type: String,
    required: true
  },
  timelineOf: {   
    type: String,
    required: true,
    index: true                                                                                                                                                       
  },                                                                                                                                                                            
   path: {
    type: String,
    required: true,
    index: true                                                                                                                                                       
                            
},        



},{
  timestamps: true
}
);

module.exports = mongoose.model('conversation', ConversationSchema);
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MessageSchema = new Schema({
  message_id: {
    type: String,
    required: true,
    index: true,
  },
  sender_id: {
    type: String,
    required: true,
    index: true
  },
  sender_fullname: {
    type: String,
    required: false,
    index: true
  },
  recipient_id: {
    type: String,
    required: true,
    index: true
  },
  recipient_fullname: {
    type: String,
    required: false,
    index: true
  },
  text: {
    type: String,
    required: true,
    index: true
  },
  app_id: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true,
    default: "text"
  },
  channel_type : {
    type: String,
    required: true,
    index: true,
    default: "direct"
  },
  status: {
    type: String,
    required: true,
    index: true
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

module.exports = mongoose.model('message', MessageSchema);
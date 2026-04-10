/*
    Chat21Client

    v0.1.12.6

    @Author Andrea Sponziello
    @Member Gabriele Panico
    (c) Tiledesk 2020
*/

import * as mqtt from 'mqtt';
import axios from 'axios';

const _CLIENTADDED = '/clientadded';
const _CLIENTUPDATED = '/clientupdated';
const _CLIENTDELETED = '/clientdeleted';
const CALLBACK_TYPE_ON_MESSAGE_UPDATED_FOR_CONVERSATION = 'onMessageUpdatedForConversation';
const CALLBACK_TYPE_ON_MESSAGE_ADDED_FOR_CONVERSATION = 'onMessageAddedForConversation';

export interface Chat21ClientOptions {
  MQTTendpoint?: string;
  APIendpoint: string;
  appId: string;
  log?: boolean;
}

interface ParsedTopic {
  conversWith: string;
}

interface CallbackHandler {
  type: string;
  conversWith: string;
  callback: (message: Record<string, unknown>, topic: ParsedTopic) => void;
}

interface RequestOptions {
  url: string;
  headers: Record<string, string>;
  data?: Record<string, unknown>;
  method: string;
}

type MessageCallback = (message: Record<string, unknown>, topic: ParsedTopic) => void;
type SimpleCallback = (err?: Error | null) => void;
type DataCallback = (err: Error | null, data: unknown) => void;
type RequestCallback = (err: Error | null, response: unknown, json: unknown) => void;

function isBrowser(): boolean {
  return false;
}

export class Chat21Client {
  private client: mqtt.MqttClient | null = null;
  private reconnections = 0;
  private client_id: string;
  private log: boolean;
  private endpoint: string;
  private APIendpoint: string;
  private appid: string;
  user_id: string | null = null;
  jwt: string | null = null;
  private last_handler = 0;
  private presence_topic: string | null = null;

  private onConversationAddedCallbacks: Map<number, MessageCallback> = new Map();
  private onConversationUpdatedCallbacks: Map<number, MessageCallback> = new Map();
  private onConversationDeletedCallbacks: Map<number, MessageCallback> = new Map();
  private onArchivedConversationAddedCallbacks: Map<number, MessageCallback> = new Map();
  private onArchivedConversationDeletedCallbacks: Map<number, MessageCallback> = new Map();
  private onMessageAddedCallbacks: Map<number, MessageCallback> = new Map();
  private onMessageUpdatedCallbacks: Map<number, MessageCallback> = new Map();
  private onGroupUpdatedCallbacks: Map<number, MessageCallback> = new Map();
  private callbackHandlers: Map<number, CallbackHandler> = new Map();
  private on_message_handler: unknown = null;
  private topic_inbox: string | null = null;
  connected = false;

  constructor(options: Chat21ClientOptions) {
    this.client_id = this.uuidv4();
    this.log = options.log ? true : false;

    if (options?.MQTTendpoint) {
      this.endpoint = options.MQTTendpoint;
    } else {
      this.endpoint = 'ws://34.253.207.0:15675/ws';
    }
    this.APIendpoint = options.APIendpoint;
    this.appid = options.appId;
    if (this.log) {
      console.log('final endpoint:', this.endpoint);
    }
  }

  subscribeToMyConversations(subscribedCallback: () => void): void {
    this.topic_inbox = 'apps/tilechat/users/' + this.user_id + '/#';
    console.log('subscribing to:', this.user_id, 'topic', this.topic_inbox);
    this.client!.subscribe(this.topic_inbox, (err) => {
      if (err) {
        console.error(
          'An error occurred while subscribing user',
          this.user_id,
          'on topic:',
          this.topic_inbox,
          'Error:',
          err,
        );
      }
      console.log('subscribed to:', this.topic_inbox, ' with err', err);
      subscribedCallback();
    });
  }

  sendMessage(
    text: string,
    type: string,
    recipient_id: string,
    recipient_fullname: string,
    sender_fullname: string,
    attributes: Record<string, unknown> | null,
    metadata: Record<string, unknown> | null,
    channel_type: string,
    callback: (err: Error | null, message: Record<string, unknown>) => void,
  ): void {
    const dest_topic = `apps/${this.appid}/outgoing/users/${this.user_id}/messages/${recipient_id}/outgoing`;
    const outgoing_message = {
      text,
      type,
      recipient_fullname,
      sender_fullname,
      attributes,
      metadata,
      channel_type,
    };
    const payload = JSON.stringify(outgoing_message);
    this.client!.publish(dest_topic, payload, {} as mqtt.IClientPublishOptions, (err) => {
      callback(err ?? null, outgoing_message);
    });
  }

  basicMessageBuilder(
    text: string,
    type: string,
    recipient_fullname: string,
    sender_fullname: string,
    attributes: Record<string, unknown> | null,
    metadata: Record<string, unknown> | null,
    channel_type: string,
  ): Record<string, unknown> {
    return { text, type, recipient_fullname, sender_fullname, attributes, metadata, channel_type };
  }

  sendMessageRaw(
    outgoing_message: Record<string, unknown>,
    recipient_id: string,
    callback: (err: Error | null, message: Record<string, unknown>) => void,
  ): void {
    const dest_topic = `apps/${this.appid}/outgoing/users/${this.user_id}/messages/${recipient_id}/outgoing`;
    if (this.log) {
      console.log('dest_topic:', dest_topic);
    }
    const payload = JSON.stringify(outgoing_message);
    this.client!.publish(dest_topic, payload, {} as mqtt.IClientPublishOptions, (err) => {
      callback(err ?? null, outgoing_message);
    });
  }

  updateMessageStatus(
    messageId: string,
    conversWith: string,
    status: number,
    callback?: (err: Error | null, patch: Record<string, unknown>) => void,
  ): void {
    if (this.log) {
      console.log('updating recipient_id:', messageId, 'on conversWith', conversWith, 'status', status);
    }
    const dest_topic = `apps/${this.appid}/users/${this.user_id}/messages/${conversWith}/${messageId}/update`;
    if (this.log) {
      console.log('update dest_topic:', dest_topic);
    }
    const message_patch = { status };
    const payload = JSON.stringify(message_patch);
    if (this.log) {
      console.log('payload:', payload);
    }
    this.client!.publish(dest_topic, payload, {} as mqtt.IClientPublishOptions, (err) => {
      if (callback) {
        callback(err ?? null, message_patch);
      }
    });
  }

  updateConversationIsNew(
    conversWith: string,
    is_new: boolean,
    callback?: SimpleCallback,
  ): void {
    if (this.log) {
      console.log('updating conversation with:', conversWith, 'is_new', is_new);
    }
    const dest_topic = `apps/${this.appid}/users/${this.user_id}/conversations/${conversWith}/update`;
    if (this.log) {
      console.log('update dest_topic:', dest_topic);
    }
    const patch = { is_new };
    const payload = JSON.stringify(patch);
    if (this.log) {
      console.log('payload:', payload);
    }
    this.client!.publish(dest_topic, payload, {} as mqtt.IClientPublishOptions, (err) => {
      if (callback) {
        callback(err ?? null);
      }
    });
  }

  groupCreate(
    name: string,
    group_id: string,
    members: Record<string, number>,
    callback: DataCallback,
  ): void {
    if (this.log) {
      console.log('creating group:', name, 'id', group_id, 'members', members);
    }
    const URL = `${this.APIendpoint}/${this.appid}/groups`;
    const options: RequestOptions = {
      url: URL,
      headers: {
        Authorization: this.jwt!,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      data: { group_name: name, group_id, group_members: members },
      method: 'POST',
    };
    Chat21Client.myrequest(options, (err, _response, json) => {
      if (err) callback(err, null);
      else if (json && callback) callback(null, json);
    }, this.log);
  }

  groupData(group_id: string, callback: DataCallback): void {
    const URL = `${this.APIendpoint}/${this.appid}/groups/${group_id}`;
    const options: RequestOptions = {
      url: URL,
      headers: {
        Authorization: this.jwt!,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      method: 'GET',
    };
    Chat21Client.myrequest(options, (err, _response, json) => {
      if (err) callback(err, null);
      else if (json && callback) callback(null, json);
    }, this.log);
  }

  groupLeave(group_id: string, member_id: string, callback: DataCallback): void {
    if (this.log) {
      console.log('leaving group:', group_id);
    }
    const URL = `${this.APIendpoint}/${this.appid}/groups/${group_id}/members/${member_id}`;
    if (this.log) {
      console.log('leaving group:', URL);
    }
    const options: RequestOptions = {
      url: URL,
      headers: {
        Authorization: this.jwt!,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      method: 'DELETE',
    };
    Chat21Client.myrequest(options, (err, _response, json) => {
      if (err) callback(err, null);
      else if (callback) callback(null, json);
    }, this.log);
  }

  groupJoin(group_id: string, member_id: string, callback: DataCallback): void {
    if (this.log) {
      console.log('leaving group:', group_id);
    }
    const URL = `${this.APIendpoint}/${this.appid}/groups/${group_id}/members`;
    if (this.log) {
      console.log('joining group:', URL);
    }
    const options: RequestOptions = {
      url: URL,
      headers: {
        Authorization: this.jwt!,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      data: { member_id },
      method: 'POST',
    };
    Chat21Client.myrequest(options, (err, _response, json) => {
      if (err) callback(err, null);
      else if (callback) callback(null, json);
    }, this.log);
  }

  groupSetMembers(
    group_id: string,
    members: Record<string, number>,
    callback: DataCallback,
  ): void {
    if (this.log) {
      console.log('setting group members of', group_id, 'members', members);
    }
    const URL = `${this.APIendpoint}/${this.appid}/groups/${group_id}/members`;
    if (this.log) {
      console.log('setting group members...', URL);
    }
    const options: RequestOptions = {
      url: URL,
      headers: {
        Authorization: this.jwt!,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      data: { members },
      method: 'PUT',
    };
    Chat21Client.myrequest(options, (err, _response, json) => {
      if (err) callback(err, null);
      else if (json && callback) callback(null, json);
    }, this.log);
  }

  saveInstance(
    instance_id: string,
    data: Record<string, unknown>,
    callback: DataCallback,
  ): void {
    if (this.log) {
      console.log('saving instance_id:', instance_id, 'data', data);
    }
    const URL = `${this.APIendpoint}/${this.appid}/${this.user_id}/instances/${instance_id}`;
    if (this.log) {
      console.log('saving instance...');
    }
    const options: RequestOptions = {
      url: URL,
      headers: {
        Authorization: this.jwt!,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      data,
      method: 'POST',
    };
    Chat21Client.myrequest(options, (err, _response, json) => {
      if (err) callback(err, null);
      else if (json && callback) callback(null, json);
    }, this.log);
  }

  archiveConversation(conversWith: string, callback?: SimpleCallback): void {
    if (this.log) {
      console.log('archiving conversation with:', conversWith);
    }
    const dest_topic =
      'apps/tilechat/users/' + this.user_id + '/conversations/' + conversWith + '/archive';
    if (this.log) {
      console.log('archive dest_topic:', dest_topic);
    }
    const payload = JSON.stringify({});
    this.client!.publish(dest_topic, payload, {} as mqtt.IClientPublishOptions, (err) => {
      if (callback) {
        callback(err ?? null);
      }
    });
  }

  onConversationAdded(callback: MessageCallback): number {
    this.last_handler++;
    this.onConversationAddedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onConversationUpdated(callback: MessageCallback): number {
    this.last_handler++;
    this.onConversationUpdatedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onConversationDeleted(callback: MessageCallback): number {
    this.last_handler++;
    this.onConversationDeletedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onArchivedConversationAdded(callback: MessageCallback): number {
    this.last_handler++;
    this.onArchivedConversationAddedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onArchivedConversationDeleted(callback: MessageCallback): number {
    this.last_handler++;
    this.onArchivedConversationDeletedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onMessageAdded(callback: MessageCallback): number {
    this.last_handler++;
    this.onMessageAddedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onMessageAddedInConversation(conversWith: string, callback: MessageCallback): number {
    this.last_handler++;
    const callback_obj: CallbackHandler = {
      type: CALLBACK_TYPE_ON_MESSAGE_ADDED_FOR_CONVERSATION,
      conversWith,
      callback,
    };
    this.callbackHandlers.set(this.last_handler, callback_obj);
    return this.last_handler;
  }

  onMessageUpdatedInConversation(conversWith: string, callback: MessageCallback): number {
    this.last_handler++;
    const callback_obj: CallbackHandler = {
      type: CALLBACK_TYPE_ON_MESSAGE_UPDATED_FOR_CONVERSATION,
      conversWith,
      callback,
    };
    this.callbackHandlers.set(this.last_handler, callback_obj);
    return this.last_handler;
  }

  onMessageUpdated(callback: MessageCallback): number {
    this.last_handler += 1;
    this.onMessageUpdatedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  onGroupUpdated(callback: MessageCallback): number {
    this.last_handler += 1;
    this.onGroupUpdatedCallbacks.set(this.last_handler, callback);
    return this.last_handler;
  }

  removeOnMessageAddedHandler(handler: number): void {
    this.onMessageAddedCallbacks.delete(handler);
  }

  removeOnGroupUpdatedHandler(handler: number): void {
    this.onGroupUpdatedCallbacks.delete(handler);
  }

  start(subscribedCallback: () => void): void {
    if (this.on_message_handler) {
      if (this.log) {
        console.log(
          'this.on_message_handler already subscribed. Reconnected num',
          this.reconnections,
        );
      }
      subscribedCallback();
      return;
    }
    this.subscribeToMyConversations(() => {
      console.log('Subscribed to MyConversations.');
      this.on_message_handler = this.client!.on('message', (topic, message) => {
        const _topic = this.parseTopic(topic);
        if (!_topic) {
          if (this.log) {
            console.log('Invalid message topic:', topic);
          }
          return;
        }
        const conversWith = _topic.conversWith;
        try {
          const message_json: Record<string, unknown> = JSON.parse(message.toString());

          if (this.onConversationUpdatedCallbacks) {
            if (topic.includes('/conversations/') && topic.endsWith(_CLIENTUPDATED)) {
              if (this.log) {
                console.log('conversation updated! /conversations/, topic:', topic);
              }
              this.onConversationUpdatedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
          }

          if (this.onConversationDeletedCallbacks) {
            if (topic.includes('/conversations/') && topic.endsWith(_CLIENTDELETED)) {
              if (this.log) {
                console.log(
                  'conversation deleted! /conversations/, topic:',
                  topic,
                  message.toString(),
                );
              }
              this.onConversationDeletedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
          }

          if (this.onArchivedConversationAddedCallbacks) {
            if (topic.includes('/archived_conversations/') && topic.endsWith(_CLIENTADDED)) {
              this.onArchivedConversationAddedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
          }

          if (this.onArchivedConversationDeletedCallbacks) {
            if (topic.includes('/archived_conversations/') && topic.endsWith(_CLIENTDELETED)) {
              this.onArchivedConversationDeletedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
          }

          if (topic.includes('/messages/') && topic.endsWith(_CLIENTADDED)) {
            if (this.onMessageAddedCallbacks) {
              this.onMessageAddedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
            let update_conversation = true;
            if (
              message_json.attributes &&
              (message_json.attributes as Record<string, unknown>).updateconversation === false
            ) {
              update_conversation = false;
            }
            if (update_conversation && this.onConversationAddedCallbacks) {
              this.onConversationAddedCallbacks.forEach((callback) => {
                message_json.is_new = true;
                const message_for_conv_string = JSON.stringify(message_json);
                callback(
                  JSON.parse(message_for_conv_string) as Record<string, unknown>,
                  _topic,
                );
              });
            }
          }

          if (this.onMessageUpdatedCallbacks) {
            if (topic.includes('/messages/') && topic.endsWith(_CLIENTUPDATED)) {
              this.onMessageUpdatedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
          }

          if (this.onGroupUpdatedCallbacks) {
            if (topic.includes('/groups/') && topic.endsWith(_CLIENTUPDATED)) {
              this.onGroupUpdatedCallbacks.forEach((callback) => {
                callback(JSON.parse(message.toString()) as Record<string, unknown>, _topic);
              });
            }
          }

          this.callbackHandlers.forEach((callback_obj) => {
            const type = callback_obj.type;
            if (topic.includes('/messages/') && topic.endsWith(_CLIENTADDED)) {
              if (this.log) {
                console.log('/messages/_CLIENTADDED');
              }
              if (type === CALLBACK_TYPE_ON_MESSAGE_ADDED_FOR_CONVERSATION) {
                if (conversWith === callback_obj.conversWith) {
                  if (this.log) {
                    console.log('/messages/_CLIENTADDED on: ', conversWith);
                  }
                  callback_obj.callback(
                    JSON.parse(message.toString()) as Record<string, unknown>,
                    _topic,
                  );
                }
              }
            }
            if (topic.includes('/messages/') && topic.endsWith(_CLIENTUPDATED)) {
              if (this.log) {
                console.log('/messages/_CLIENTUPDATED');
              }
              if (type === CALLBACK_TYPE_ON_MESSAGE_UPDATED_FOR_CONVERSATION) {
                if (conversWith === callback_obj.conversWith) {
                  if (this.log) {
                    console.log('/messages/_CLIENTUPDATED on: ', conversWith);
                  }
                  callback_obj.callback(
                    JSON.parse(message.toString()) as Record<string, unknown>,
                    _topic,
                  );
                }
              }
            }
          });
        } catch (err) {
          console.error('ERROR:', err);
        }
      });
      subscribedCallback();
    });
  }

  parseTopic(topic: string): ParsedTopic | null {
    const topic_parts = topic.split('/');
    if (topic_parts.length >= 7) {
      const recipient_id = topic_parts[5];
      return { conversWith: recipient_id };
    }
    return null;
  }

  conversationDetail(conversWith: string, callback: DataCallback): void {
    if (this.log) {
      console.log(
        'conversationDetail(). searching on user:',
        this.user_id,
        ' - conversWith:',
        conversWith,
      );
    }
    this.crossConversationDetail(conversWith, false, callback);
  }

  archivedConversationDetail(conversWith: string, callback: DataCallback): void {
    if (this.log) {
      console.log(
        'archivedConversationDetail(). searching on user:',
        this.user_id,
        ' - conversWith:',
        conversWith,
      );
    }
    this.crossConversationDetail(conversWith, true, callback);
  }

  crossConversationDetail(
    conversWith: string,
    archived: boolean,
    callback: DataCallback,
  ): void {
    if (this.log) {
      console.log(
        'searching on user:',
        this.user_id,
        ' - conv of conversWith:',
        conversWith,
        ' - archived:',
        archived,
      );
    }
    const path = archived ? 'archived_conversations' : 'conversations';
    const URL = `${this.APIendpoint}/${this.appid}/${this.user_id}/${path}/${conversWith}`;
    if (this.log) {
      console.log('getting conversation detail:', URL);
      console.log('conversWith:', conversWith);
    }

    const options: RequestOptions = {
      url: URL,
      headers: { Authorization: this.jwt! },
      method: 'GET',
    };
    Chat21Client.myrequest(
      options,
      (_err, _response, json) => {
        if (this.log) {
          console.log('JSON...', json);
        }
        const typed = json as { result?: unknown[] } | null;
        if (typed?.result && Array.isArray(typed.result) && typed.result.length === 1) {
          callback(null, typed.result[0]);
        } else {
          callback(null, null);
        }
      },
      this.log,
    );
  }

  static myrequest(options: RequestOptions, callback: RequestCallback, log: boolean): void {
    if (log) {
      // console.log("HTTP Request:", options);
    }
    if (isBrowser()) {
      // Browser path — kept for completeness but isBrowser() always returns false
      return;
    }
    axios({
      url: options.url,
      method: options.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      data: options.data,
      headers: options.headers,
    })
      .then((response) => {
        if (log) {
          console.log('response.status:', response.status);
        }
        if (callback) {
          callback(null, response.headers, response.data);
        }
      })
      .catch((error: Error) => {
        console.error('Axios call error:', error);
        if (callback) {
          callback(error, null, null);
        }
      });
  }

  connect(user_id: string, jwt: string, callback: () => void): void {
    this.user_id = user_id;
    this.jwt = jwt;
    if (this.log) {
      console.log('connecting user_id:', user_id);
      console.log('using jwt token:', jwt);
    }

    if (this.client) {
      this.client.end();
    }
    this.presence_topic = 'apps/tilechat/users/' + this.user_id + '/presence/' + this.client_id;
    const options: mqtt.IClientOptions = {
      keepalive: 10,
      reconnectPeriod: 1000,
      will: {
        topic: this.presence_topic,
        payload: '{"disconnected":true}',
        qos: 1,
        retain: true,
      },
      clientId: this.client_id,
      username: 'JWT',
      password: jwt,
      rejectUnauthorized: false,
    };
    if (this.log) {
      console.log(
        'starting mqtt connection with LWT on:',
        this.presence_topic,
        this.endpoint,
      );
    }
    this.client = mqtt.connect(this.endpoint, options);

    this.client.on('connect', () => {
      console.log('Client connected. User:' + user_id);
      if (!this.connected) {
        if (this.log) {
          console.log('Chat client first connection for:' + user_id);
        }
        this.connected = true;
        this.start(() => {
          callback();
        });
      }
      this.client!.publish(
        this.presence_topic!,
        JSON.stringify({ connected: true }),
        {} as mqtt.IClientPublishOptions,
        (err) => {
          if (err) {
            console.error('Error con presence publish:', err);
          }
        },
      );
    });

    this.client.on('reconnect', () => {
      if (this.log) {
        console.log('Chat client reconnect event');
      }
    });

    this.client.on('close', () => {
      if (this.log) {
        console.log('Chat client close event');
      }
    });

    this.client.on('offline', () => {
      if (this.log) {
        console.log('Chat client offline event');
      }
    });

    this.client.on('error', (error: Error) => {
      console.error('Chat client error event', error);
    });
  }

  ImHere(): void {
    if (this.client && this.presence_topic) {
      this.client.publish(
        this.presence_topic,
        JSON.stringify({ connected: true }),
        {} as mqtt.IClientPublishOptions,
        (err) => {
          if (err) {
            console.error('Error on presence publish:', err);
          }
        },
      );
    }
  }

  close(callback?: () => void): void {
    if (this.topic_inbox) {
      this.client!.unsubscribe(this.topic_inbox, (err: Error | undefined) => {
        if (this.log) {
          console.log('unsubscribed from', this.topic_inbox);
        }
        this.client!.end(false, () => {
          this.connected = false;
          this.onConversationAddedCallbacks = new Map();
          this.onConversationUpdatedCallbacks = new Map();
          this.onConversationDeletedCallbacks = new Map();
          this.onArchivedConversationAddedCallbacks = new Map();
          this.onArchivedConversationDeletedCallbacks = new Map();
          this.onMessageAddedCallbacks = new Map();
          this.onMessageUpdatedCallbacks = new Map();
          this.onGroupUpdatedCallbacks = new Map();
          this.callbackHandlers = new Map();
          this.on_message_handler = null;
          this.topic_inbox = null;
          if (callback) {
            callback();
          }
        });
      });
    }
  }

  uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/*
    ver 0.1.2
    Andrea Sponziello - (c) Tiledesk.com
*/

import { Db, UpdateWriteOpResult, FindAndModifyWriteOpResultObject } from 'mongodb';
import { logger } from '../tiledesk-logger';
import { ChatMessage, Group, Conversation } from '../types';

export interface ChatDBOptions {
  database: Db;
}

type Callback<T> = (err: Error | null, result: T | null) => void;

/**
 * Manages DB persistence for chat21-server.
 */
export class ChatDB {
  private db: Db;
  private readonly messages_collection = 'messages';
  private readonly groups_collection = 'groups';
  private readonly conversations_collection = 'conversations';

  constructor(options: ChatDBOptions) {
    if (!options.database) {
      throw new Error('database option can NOT be empty.');
    }
    this.db = options.database;

    this.db.collection(this.conversations_collection).createIndex(
      { timelineOf: 1, conversWith: 1 },
      { unique: true },
    );
    this.db.collection(this.messages_collection).createIndex(
      { timelineOf: 1, message_id: 1 },
    );
    this.db.collection(this.groups_collection).createIndex(
      { uid: 1 },
    );
  }

  saveOrUpdateMessage(message: ChatMessage, callback?: Callback<UpdateWriteOpResult>): void {
    // Remove _id if present — MongoDB will reject duplicate key errors otherwise
    delete (message as Record<string, unknown>)['_id'];
    this.db
      .collection(this.messages_collection)
      .updateOne(
        { timelineOf: message['timelineOf'], message_id: message.message_id },
        { $set: message },
        { upsert: true },
      )
      .then((doc) => callback?.(null, doc))
      .catch((err: Error) => {
        console.error('db error...', err);
        callback?.(err, null);
      });
  }

  saveOrUpdateConversation(conversation: Conversation, callback?: Callback<UpdateWriteOpResult>): void {
    this.db
      .collection(this.conversations_collection)
      .updateOne(
        { timelineOf: conversation['timelineOf'], conversWith: conversation['conversWith'] },
        { $set: conversation },
        { upsert: true },
      )
      .then((doc) => callback?.(null, doc))
      .catch((err: Error) => {
        logger.error('error saveOrUpdateConversation', err);
        callback?.(err, null);
      });
  }

  saveOrUpdateGroup(group: Group, callback?: Callback<UpdateWriteOpResult>): void {
    logger.debug('saving group...', group);
    this.db
      .collection(this.groups_collection)
      .updateOne({ uid: group.uid }, { $set: group }, { upsert: true })
      .then((doc) => callback?.(null, doc))
      .catch((err: Error) => callback?.(err, null));
  }

  getGroup(group_id: string, callback?: Callback<Group>): void {
    this.db
      .collection(this.groups_collection)
      .findOne<Group>({ uid: group_id })
      .then((doc) => callback?.(null, doc))
      .catch((err: Error) => callback?.(err, null));
  }

  lastConversations(
    appid: string,
    userid: string,
    archived: boolean,
    callback?: Callback<Conversation[]>,
  ): void {
    logger.debug('DB. app:', appid, 'user:', userid, 'archived:', archived);
    this.db
      .collection(this.conversations_collection)
      .find({ timelineOf: userid, app_id: appid, archived })
      .limit(200)
      .sort({ timestamp: -1 })
      .toArray()
      .then((docs) => callback?.(null, docs as Conversation[]))
      .catch((err: Error) => callback?.(err, null));
  }

  conversationDetail(
    appid: string,
    timelineOf: string,
    conversWith: string,
    archived: boolean,
    callback?: Callback<Conversation[]>,
  ): void {
    logger.debug('DB. app: ' + appid + ' user: ' + timelineOf + ' conversWith: ' + conversWith);
    this.db
      .collection(this.conversations_collection)
      .find({ timelineOf, app_id: appid, conversWith, archived })
      .limit(1)
      .toArray()
      .then((docs) => callback?.(null, docs as Conversation[]))
      .catch((err: Error) => callback?.(err, null));
  }

  lastMessages(
    appid: string,
    userid: string,
    convid: string,
    sort: 1 | -1,
    limit: number,
    callback?: Callback<ChatMessage[]>,
  ): void {
    logger.debug('DB. app:', appid, 'user:', userid, 'convid', convid);
    this.db
      .collection(this.messages_collection)
      .find({ timelineOf: userid, app_id: appid, conversWith: convid })
      .limit(limit)
      .sort({ timestamp: sort })
      .toArray()
      .then((docs) => callback?.(null, docs as ChatMessage[]))
      .catch((err: Error) => callback?.(err, null));
  }
}

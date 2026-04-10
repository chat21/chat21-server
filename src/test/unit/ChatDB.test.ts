import { expect } from 'chai';
import * as sinon from 'sinon';
import { ChatDB } from '../../chatdb/index';
import { Db, Collection } from 'mongodb';

function makeCollection(): Record<string, sinon.SinonStub> {
  return {
    updateOne: sinon.stub(),
    findOne: sinon.stub(),
    find: sinon.stub(),
    createIndex: sinon.stub().resolves(),
  };
}

function makeDb(messagesCol: Record<string, sinon.SinonStub>, groupsCol: Record<string, sinon.SinonStub>, convsCol: Record<string, sinon.SinonStub>): Db {
  const db = {
    collection: sinon.stub().callsFake((name: string) => {
      if (name === 'messages') return messagesCol;
      if (name === 'groups') return groupsCol;
      if (name === 'conversations') return convsCol;
      return makeCollection();
    }),
  } as unknown as Db;
  return db;
}

describe('ChatDB', function () {
  let messagesCol: Record<string, sinon.SinonStub>;
  let groupsCol: Record<string, sinon.SinonStub>;
  let convsCol: Record<string, sinon.SinonStub>;
  let db: Db;
  let chatdb: ChatDB;

  beforeEach(function () {
    messagesCol = makeCollection();
    groupsCol = makeCollection();
    convsCol = makeCollection();
    db = makeDb(messagesCol, groupsCol, convsCol);
    chatdb = new ChatDB({ database: db });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('saveOrUpdateMessage()', function () {
    it('upserts a message and calls callback with result', function (done) {
      const fakeResult = { result: { ok: 1 } };
      messagesCol.updateOne.resolves(fakeResult);
      const msg = { timelineOf: 'user1', message_id: 'msg1', text: 'hello' };
      chatdb.saveOrUpdateMessage(msg as unknown as import('../../types').ChatMessage, (err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal(fakeResult);
        expect(messagesCol.updateOne.calledOnce).to.be.true;
        const [filter, update, opts] = messagesCol.updateOne.getCall(0).args;
        expect(filter).to.deep.equal({ timelineOf: 'user1', message_id: 'msg1' });
        expect(update.$set).to.include({ text: 'hello' });
        expect(opts.upsert).to.be.true;
        done();
      });
    });

    it('calls callback with error when updateOne fails', function (done) {
      messagesCol.updateOne.rejects(new Error('db error'));
      const msg = { timelineOf: 'user1', message_id: 'msg1' };
      chatdb.saveOrUpdateMessage(msg as unknown as import('../../types').ChatMessage, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('db error');
        done();
      });
    });
  });

  describe('saveOrUpdateConversation()', function () {
    it('upserts a conversation and calls callback', function (done) {
      const fakeResult = { result: { ok: 1 } };
      convsCol.updateOne.resolves(fakeResult);
      const conv = { timelineOf: 'user1', conversWith: 'user2' };
      chatdb.saveOrUpdateConversation(conv as unknown as import('../../types').Conversation, (err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal(fakeResult);
        expect(convsCol.updateOne.calledOnce).to.be.true;
        const [filter, , opts] = convsCol.updateOne.getCall(0).args;
        expect(filter).to.deep.equal({ timelineOf: 'user1', conversWith: 'user2' });
        expect(opts.upsert).to.be.true;
        done();
      });
    });
  });

  describe('getGroup()', function () {
    it('calls callback with the group when found', function (done) {
      const fakeGroup = { uid: 'group-1', name: 'Test Group', members: {} };
      groupsCol.findOne.resolves(fakeGroup);
      chatdb.getGroup('group-1', (err, group) => {
        expect(err).to.be.null;
        expect(group).to.deep.equal(fakeGroup);
        expect(groupsCol.findOne.calledOnce).to.be.true;
        expect(groupsCol.findOne.getCall(0).args[0]).to.deep.equal({ uid: 'group-1' });
        done();
      });
    });

    it('calls callback with null when group not found', function (done) {
      groupsCol.findOne.resolves(null);
      chatdb.getGroup('group-unknown', (err, group) => {
        expect(err).to.be.null;
        expect(group).to.be.null;
        done();
      });
    });

    it('calls callback with error on db failure', function (done) {
      groupsCol.findOne.rejects(new Error('db error'));
      chatdb.getGroup('group-1', (err) => {
        expect(err).to.be.instanceOf(Error);
        done();
      });
    });
  });

  describe('saveOrUpdateGroup()', function () {
    it('upserts a group and calls callback', function (done) {
      const fakeResult = { result: { ok: 1 } };
      groupsCol.updateOne.resolves(fakeResult);
      const group: import('../../types').Group = {
        uid: 'group-1',
        name: 'Test',
        members: {},
        appId: 'tilechat'
      };
      chatdb.saveOrUpdateGroup(group, (err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal(fakeResult);
        expect(groupsCol.updateOne.calledOnce).to.be.true;
        done();
      });
    });
  });
});

import { expect } from 'chai';
import * as sinon from 'sinon';
import { TdCache } from '../../TdCache';

/** Helper: build a TdCache with a pre-injected fake redis client */
function cacheWithFakeClient(fakeClient: Record<string, sinon.SinonStub>): TdCache {
  const cache = new TdCache({ host: 'localhost', port: 6379 });
  (cache as unknown as Record<string, unknown>)['client'] = fakeClient;
  return cache;
}

describe('TdCache', function () {
  let fakeClient: Record<string, sinon.SinonStub>;

  beforeEach(function () {
    fakeClient = {
      on: sinon.stub(),
      set: sinon.stub(),
      get: sinon.stub(),
      del: sinon.stub(),
      incr: sinon.stub(),
      hset: sinon.stub(),
      hdel: sinon.stub(),
      hget: sinon.stub(),
      hgetall: sinon.stub(),
    };
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('set()', function () {
    it('rejects if client is not connected', async function () {
      const cache = new TdCache({ host: 'localhost', port: 6379 });
      try {
        await cache.set('k', 'v');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Redis client not connected');
      }
    });

    it('calls redis set without EX when no options', async function () {
      fakeClient.set.callsArgWith(2, null);
      const cache = cacheWithFakeClient(fakeClient);
      await cache.set('mykey', 'myval');
      expect(fakeClient.set.calledOnce).to.be.true;
      expect(fakeClient.set.getCall(0).args[0]).to.equal('mykey');
      expect(fakeClient.set.getCall(0).args[1]).to.equal('myval');
    });

    it('calls redis set with EX when options.EX is provided', async function () {
      fakeClient.set.callsArgWith(4, null);
      const cache = cacheWithFakeClient(fakeClient);
      await cache.set('mykey', 'myval', { EX: 300 });
      expect(fakeClient.set.getCall(0).args[2]).to.equal('EX');
      expect(fakeClient.set.getCall(0).args[3]).to.equal(300);
    });

    it('rejects on redis error', async function () {
      fakeClient.set.callsArgWith(2, new Error('write error'));
      const cache = cacheWithFakeClient(fakeClient);
      try {
        await cache.set('k', 'v');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('write error');
      }
    });
  });

  describe('get()', function () {
    it('rejects if client is not connected', async function () {
      const cache = new TdCache({ host: 'localhost', port: 6379 });
      try {
        await cache.get('k');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Redis client not connected');
      }
    });

    it('returns the value from redis', async function () {
      fakeClient.get.callsArgWith(1, null, 'hello');
      const cache = cacheWithFakeClient(fakeClient);
      const val = await cache.get('mykey');
      expect(val).to.equal('hello');
    });

    it('returns null when key does not exist', async function () {
      fakeClient.get.callsArgWith(1, null, null);
      const cache = cacheWithFakeClient(fakeClient);
      const val = await cache.get('missing');
      expect(val).to.be.null;
    });

    it('rejects on redis error', async function () {
      fakeClient.get.callsArgWith(1, new Error('read error'), null);
      const cache = cacheWithFakeClient(fakeClient);
      try {
        await cache.get('k');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('read error');
      }
    });
  });

  describe('del()', function () {
    it('calls redis del and resolves', async function () {
      fakeClient.del.callsArgWith(1, null);
      const cache = cacheWithFakeClient(fakeClient);
      await cache.del('mykey');
      expect(fakeClient.del.calledOnce).to.be.true;
    });

    it('rejects if client is not connected', async function () {
      const cache = new TdCache({ host: 'localhost', port: 6379 });
      try {
        await cache.del('k');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Redis client not connected');
      }
    });
  });

  describe('setJSON() / getJSON()', function () {
    it('serialises an object and stores it, then deserialises on get', async function () {
      fakeClient.set.callsArgWith(2, null);
      fakeClient.get.callsArgWith(1, null, '{"a":1}');
      const cache = cacheWithFakeClient(fakeClient);
      await cache.setJSON('obj', { a: 1 });
      const result = await cache.getJSON<{ a: number }>('obj');
      expect(result).to.deep.equal({ a: 1 });
    });
  });
});

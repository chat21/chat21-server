import { expect } from 'chai';
import * as sinon from 'sinon';
import RateManager from '../../services/RateManager';
import { TdCache } from '../../TdCache';

describe('RateManager', function () {
  let cache: TdCache;
  let getStub: sinon.SinonStub;
  let setStub: sinon.SinonStub;

  beforeEach(function () {
    // Create a minimal TdCache-shaped object with stubs
    cache = Object.create(TdCache.prototype) as TdCache;
    getStub = sinon.stub(cache, 'get');
    setStub = sinon.stub(cache, 'set').resolves();
  });

  afterEach(function () {
    sinon.restore();
  });

  it('throws if no config provided', function () {
    expect(() => new RateManager(null as unknown as { tdCache: TdCache })).to.throw('config is mandatory');
  });

  it('throws if no tdCache in config', function () {
    expect(() => new RateManager({ tdCache: null as unknown as TdCache })).to.throw('config.tdCache is mandatory');
  });

  it('allows request when bucket is empty (fresh bucket with capacity)', async function () {
    // No existing bucket → returns fresh one with full capacity
    getStub.resolves(null);
    const rm = new RateManager({ tdCache: cache });
    const result = await rm.canExecute('user1', 'message');
    expect(result).to.be.true;
    expect(setStub.calledOnce).to.be.true;
  });

  it('denies request when bucket has 0 tokens', async function () {
    // Place the timestamp in the future so elapsed is negative → no refill occurs
    const depleted = JSON.stringify({ tokens: 0, timestamp: new Date(Date.now() + 60_000).toISOString() });
    getStub.resolves(depleted);
    const rm = new RateManager({ tdCache: cache });
    const result = await rm.canExecute('user1', 'message');
    expect(result).to.be.false;
    // setBucket should NOT be called on denial
    expect(setStub.called).to.be.false;
  });

  it('allows request and decrements token by 1', async function () {
    const bucket = JSON.stringify({ tokens: 5, timestamp: new Date().toISOString() });
    getStub.resolves(bucket);
    const rm = new RateManager({ tdCache: cache });
    const result = await rm.canExecute('user1', 'message');
    expect(result).to.be.true;
    // setBucket is fire-and-forget — verify it's scheduled (may not be awaited)
    // Give the microtask queue a tick
    await new Promise(resolve => setImmediate(resolve));
    expect(setStub.calledOnce).to.be.true;
    const savedBucket = JSON.parse(setStub.getCall(0).args[1]);
    expect(savedBucket.tokens).to.equal(4);
  });

  it('refills tokens based on elapsed time', async function () {
    // Set a bucket that was created 60 seconds ago with 0 tokens
    const past = new Date(Date.now() - 60_000).toISOString();
    const bucket = JSON.stringify({ tokens: 0, timestamp: past });
    getStub.resolves(bucket);
    const rm = new RateManager({ tdCache: cache });
    // refill_rate for 'message' is 30/60 = 0.5 tokens/sec
    // After 60s: 0 + 60 * 0.5 = 30 tokens → capped at capacity (30) → 1 consumed → result=true
    const result = await rm.canExecute('user1', 'message');
    expect(result).to.be.true;
  });

  it('returns true and skips when type is missing', async function () {
    const rm = new RateManager({ tdCache: cache });
    const result = await rm.canExecute('user1', '');
    expect(result).to.be.true;
    expect(getStub.called).to.be.false;
  });

  it('setBucket serialises bucket to cache with EX=600', async function () {
    getStub.resolves(null);
    const rm = new RateManager({ tdCache: cache });
    await rm.canExecute('user1', 'message');
    await new Promise(resolve => setImmediate(resolve));
    expect(setStub.calledOnce).to.be.true;
    expect(setStub.getCall(0).args[0]).to.match(/^bucket:message:user1$/);
    expect(setStub.getCall(0).args[2]).to.deep.equal({ EX: 600 });
  });
});

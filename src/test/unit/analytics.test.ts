/**
 * Unit tests for src/observer/analytics.ts
 *
 * Tests that trackAnalyticsEvent():
 *  - no-ops when analytics_enabled=false
 *  - no-ops when id_project is missing
 *  - no-ops when pubChannel is not ready
 *  - publishes the correct envelope to the correct exchange/routing-key
 *  - does NOT throw even when pubChannel.publish() throws
 */
import { strict as assert } from 'assert';
import sinon from 'sinon';
import { observerState } from '../../observer/state';
import { trackAnalyticsEvent } from '../../observer/analytics';

// Reset relevant state fields before each test
function resetState() {
  observerState.analytics_enabled = false;
  observerState.analytics_exchange = 'tiledesk.analytics';
  observerState.analyticsPubChannel = null as unknown as typeof observerState.analyticsPubChannel;
}

describe('trackAnalyticsEvent', () => {
  let publishStub: sinon.SinonStub;

  beforeEach(() => {
    resetState();
    publishStub = sinon.stub().returns(true);
    observerState.analyticsPubChannel = {
      publish: publishStub,
    } as unknown as typeof observerState.analyticsPubChannel;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('does nothing when analytics_enabled=false', () => {
    observerState.analytics_enabled = false;
    trackAnalyticsEvent('message.delivered', 'proj-1', { foo: 'bar' });
    assert.equal(publishStub.callCount, 0);
  });

  it('does nothing when id_project is undefined', () => {
    observerState.analytics_enabled = true;
    trackAnalyticsEvent('message.delivered', undefined, { foo: 'bar' });
    assert.equal(publishStub.callCount, 0);
  });

  it('does nothing when id_project is null', () => {
    observerState.analytics_enabled = true;
    trackAnalyticsEvent('message.delivered', null, { foo: 'bar' });
    assert.equal(publishStub.callCount, 0);
  });

  it('does nothing when pubChannel is null', () => {
    observerState.analytics_enabled = true;
    observerState.analyticsPubChannel = null as unknown as typeof observerState.analyticsPubChannel;
    trackAnalyticsEvent('message.delivered', 'proj-1', { foo: 'bar' });
    assert.equal(publishStub.callCount, 0);
  });

  it('publishes to the correct exchange and routing key', () => {
    observerState.analytics_enabled = true;
    trackAnalyticsEvent('message.delivered', 'proj-1', { id_message: 'msg-1' });
    assert.equal(publishStub.callCount, 1);
    const [exchange, routingKey] = publishStub.firstCall.args as [string, string, Buffer, unknown];
    assert.equal(exchange, 'tiledesk.analytics');
    assert.equal(routingKey, 'analytics.message.delivered');
  });

  it('publishes an envelope with correct shape', () => {
    observerState.analytics_enabled = true;
    const payload = { id_message: 'msg-42', sender_id: 'alice', recipient_id: 'bob' };
    trackAnalyticsEvent('message.delivered', 'proj-99', payload);
    const [, , content] = publishStub.firstCall.args as [string, string, Buffer, unknown];
    const envelope = JSON.parse(content.toString()) as Record<string, unknown>;
    assert.equal(envelope.event_type, 'message.delivered');
    assert.equal(envelope.id_project, 'proj-99');
    assert.equal(envelope.source_service, 'c21srv');
    assert.equal(envelope.event_version, '1.0');
    assert.ok(typeof envelope.event_id === 'string' && envelope.event_id.length > 0, 'event_id should be a non-empty string (UUID)');
    assert.ok(typeof envelope.timestamp === 'string', 'timestamp should be a string');
    assert.deepEqual(envelope.payload, payload);
  });

  it('uses a custom analytics_exchange when configured', () => {
    observerState.analytics_enabled = true;
    observerState.analytics_exchange = 'my.custom.exchange';
    trackAnalyticsEvent('user.presence_changed', 'proj-1', { status: 'online' });
    const [exchange] = publishStub.firstCall.args as [string, string, Buffer, unknown];
    assert.equal(exchange, 'my.custom.exchange');
  });

  it('does NOT throw when pubChannel.publish() throws', () => {
    observerState.analytics_enabled = true;
    publishStub.throws(new Error('channel closed'));
    // Must not throw
    assert.doesNotThrow(() => {
      trackAnalyticsEvent('message.delivered', 'proj-1', {});
    });
  });
});

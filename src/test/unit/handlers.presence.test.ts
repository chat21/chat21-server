import { strict as assert } from 'assert';
import sinon from 'sinon';
import amqp from 'amqplib/callback_api';
import { work } from '../../observer/handlers';
import { observerState } from '../../observer/state';

function makePresenceMessage(userId: string, payload: Record<string, unknown>): amqp.Message {
  return {
    fields: {
      routingKey: `apps.tilechat.users.${userId}.presence.client-1`,
      deliveryTag: 1,
      redelivered: false,
      exchange: 'amq.topic',
      consumerTag: 'ct-1',
    },
    properties: {},
    content: Buffer.from(JSON.stringify(payload)),
  } as unknown as amqp.Message;
}

describe('process_presence analytics project resolution', () => {
  let publishStub: sinon.SinonStub;

  beforeEach(() => {
    publishStub = sinon.stub().returns(true);

    observerState.presence_enabled = true;
    observerState.webhook_enabled = false;

    observerState.analytics_enabled = true;
    observerState.analytics_exchange = 'tiledesk.analytics';
    observerState.analyticsPubChannel = {
      publish: publishStub,
    } as unknown as typeof observerState.analyticsPubChannel;

    observerState.userProjectCache.clear();
  });

  afterEach(() => {
    sinon.restore();
    observerState.presence_enabled = false;
    observerState.analytics_enabled = false;
  });

  it('falls back to app_id when user cache has no project mapping', () => {
    const msg = makePresenceMessage('presence-user-no-cache', { connected: true });
    work(msg, () => {});

    assert.equal(publishStub.callCount, 1);
    const [, , content] = publishStub.firstCall.args as [string, string, Buffer, unknown];
    const envelope = JSON.parse(content.toString()) as Record<string, unknown>;
    assert.equal(envelope.event_type, 'user.presence_changed');
    assert.equal(envelope.id_project, 'tilechat');
  });

  it('uses cached project when available for the user', () => {
    observerState.userProjectCache.set('presence-user-with-cache', 'project-from-cache');

    const msg = makePresenceMessage('presence-user-with-cache', { connected: false });
    work(msg, () => {});

    assert.equal(publishStub.callCount, 1);
    const [, , content] = publishStub.firstCall.args as [string, string, Buffer, unknown];
    const envelope = JSON.parse(content.toString()) as Record<string, unknown>;
    assert.equal(envelope.id_project, 'project-from-cache');
  });
});

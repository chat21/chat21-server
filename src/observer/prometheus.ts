/**
 * Prometheus metric counters for the observer.
 * Exported so that handlers can increment them.
 */
import prometheus from 'prom-client';

export const register = prometheus.register;

export const messagesProjectCounter = new prometheus.Counter({
  name: 'chat21_messages_per_project_total',
  help: 'Total number of messages per project',
  labelNames: ['project_id']
});

export const messagesIPCounter = new prometheus.Counter({
  name: 'chat21_messages_per_ip_total',
  help: 'Total number of messages per IP address',
  labelNames: ['ip_address']
});

export const messagesProjectIPCounter = new prometheus.Counter({
  name: 'chat21_messages_per_project_ip_total',
  help: 'Total number of messages per project and IP address',
  labelNames: ['project_id', 'ip_address']
});

export const messagesTopicCounter = new prometheus.Counter({
  name: 'chat21_messages_per_topic_total',
  help: 'Total number of messages per topic',
  labelNames: ['topic']
});

import { unconnectedTransport, type Channel, type MessageTransport } from 'src/lib/messaging';
import { configProblem, whatsAppConfig } from 'src/lib/whatsapp-config';
import { cloudApiTransport } from 'src/lib/whatsapp-transport';

/**
 * Which transport a channel gets. The one place the decision lives.
 *
 * This is deliberately NOT in messaging.ts: that module is pure and the front
 * component imports it, so anything reaching for process.env or fetch in there
 * would follow the inbox into a sandboxed browser worker that has neither.
 *
 * With nothing configured this returns the stub, which saves the message and
 * says plainly that it was not delivered. That is the same contract the real
 * transport honours, so no caller has to know which one it got.
 */
export const transportFor = (channel: Channel): MessageTransport => {
  if (channel !== 'WHATSAPP') return unconnectedTransport;

  const config = whatsAppConfig();

  return configProblem(config) ? unconnectedTransport : cloudApiTransport(config);
};

/** For telling the person why a message is sitting there unsent. */
export const transportProblem = (channel: Channel) =>
  channel === 'WHATSAPP' ? configProblem(whatsAppConfig()) : '';

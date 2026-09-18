import {
  cloudApiError,
  textMessagePayload,
  waIdOf,
} from 'src/lib/whatsapp-cloud';
import { sendEndpoint, type WhatsAppConfig } from 'src/lib/whatsapp-config';
import type { MessageTransport, TransportResult } from 'src/lib/messaging';

/**
 * The real transport: one POST to Meta.
 *
 * Every failure path ends in a TransportResult rather than a throw, because the
 * message has ALREADY been written by the time this is called. Throwing here
 * would leave a message in the database with no status and no explanation,
 * which is precisely the state this whole design exists to avoid. A send that
 * fails is a FAILED message carrying Meta's own sentence about why.
 */
export const cloudApiTransport = (config: WhatsAppConfig): MessageTransport => ({
  name: 'whatsapp-cloud-api',
  isConnected: true,
  send: async ({ to, body, isWithinServiceWindow }): Promise<TransportResult> => {
    const waId = waIdOf(to);

    if (!waId) {
      return {
        externalId: null,
        deliveryStatus: 'FAILED',
        deliveryDetail: `"${to}" is not a phone number WhatsApp can deliver to.`,
      };
    }

    // Meta would reject this anyway, but its error arrives as a code. Saying it
    // here means the person reads why instead of looking one up.
    if (!isWithinServiceWindow) {
      return {
        externalId: null,
        deliveryStatus: 'FAILED',
        deliveryDetail:
          'Not sent: more than 24 hours since they last wrote, so WhatsApp only accepts an approved template here.',
      };
    }

    try {
      const response = await fetch(sendEndpoint(config.phoneNumberId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textMessagePayload({ waId, body })),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          externalId: null,
          deliveryStatus: 'FAILED',
          deliveryDetail: cloudApiError(response.status, payload),
        };
      }

      // Meta accepted it. It is not delivered yet - the webhook says that
      // later - so SENT is the honest status, not DELIVERED.
      return {
        externalId: String(payload?.messages?.[0]?.id ?? '') || null,
        deliveryStatus: 'SENT',
        deliveryDetail: '',
      };
    } catch (error) {
      return {
        externalId: null,
        deliveryStatus: 'FAILED',
        deliveryDetail: `Could not reach WhatsApp: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  },
});

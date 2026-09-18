import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { WHATSAPP_WEBHOOK_VERIFY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import { whatsAppConfig } from 'src/lib/whatsapp-config';

/**
 * Meta's one-time handshake when you save the callback URL.
 *
 * Meta GETs the URL with a challenge and the verify token you typed into its
 * dashboard. Echo the challenge back, but only when the token matches - this
 * endpoint is public, and an unconditional echo tells anybody who finds it that
 * something real is listening here.
 */
const handler = async (payload: RoutePayload) => {
  const params = payload.queryStringParameters ?? {};
  const config = whatsAppConfig();

  const isValid =
    params['hub.mode'] === 'subscribe' &&
    config.verifyToken.length > 0 &&
    params['hub.verify_token'] === config.verifyToken &&
    typeof params['hub.challenge'] === 'string';

  if (!isValid) {
    return new Response({ error: 'Forbidden' }, { status: 403 });
  }

  // Meta wants the bare challenge, not JSON wrapping it.
  return new Response(params['hub.challenge'], {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
};

export default defineLogicFunction({
  universalIdentifier: WHATSAPP_WEBHOOK_VERIFY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'whatsapp-verify',
  description: "Answers Meta's webhook verification handshake",
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/whatsapp/webhook',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});

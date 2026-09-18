import { GRAPH_API_BASE } from 'src/lib/whatsapp-cloud';

/**
 * The Cloud API credentials, and an honest answer about whether we have them.
 *
 * Application variables arrive as environment variables in the logic function
 * runtime. Reading them anywhere else would mean copying a token around, so
 * this is the only module that touches them, and it never returns the token in
 * anything that gets logged or sent to a browser.
 */

export type WhatsAppConfig = {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
};

const read = (key: string) => String(process.env[key] ?? '').trim();

export const whatsAppConfig = (): WhatsAppConfig => ({
  phoneNumberId: read('WHATSAPP_PHONE_NUMBER_ID'),
  accessToken: read('WHATSAPP_ACCESS_TOKEN'),
  verifyToken: read('WHATSAPP_VERIFY_TOKEN'),
  appSecret: read('WHATSAPP_APP_SECRET'),
});

/** Empty when it is ready; otherwise the sentence saying what is missing. */
export const configProblem = (config: WhatsAppConfig) => {
  const missing = [
    !config.phoneNumberId && 'the phone number ID',
    !config.accessToken && 'the access token',
  ].filter(Boolean);

  if (missing.length === 0) return '';

  return `WhatsApp is not connected yet - ${missing.join(' and ')} ${
    missing.length > 1 ? 'are' : 'is'
  } missing from the app settings.`;
};

export const sendEndpoint = (phoneNumberId: string) =>
  `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

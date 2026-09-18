import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  WHATSAPP_PHONE_NUMBER_ID_VARIABLE_UNIVERSAL_IDENTIFIER,
  WHATSAPP_ACCESS_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
  WHATSAPP_VERIFY_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
  WHATSAPP_APP_SECRET_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

/**
 * The WhatsApp credentials are application variables, not a kv row and not a
 * settings screen of our own.
 *
 * An access token that can send messages as the business, and an app secret
 * that is the only thing standing between a public webhook URL and anyone who
 * finds it, do not belong in a row this app reads and writes. Twenty holds
 * them, an admin types them once in the app's settings, and no code here ever
 * has to store, echo or accidentally log a value.
 */
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    WHATSAPP_PHONE_NUMBER_ID: {
      universalIdentifier: WHATSAPP_PHONE_NUMBER_ID_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'WhatsApp phone number ID',
      description:
        'From Meta > WhatsApp > API Setup. Not the phone number itself - the long numeric ID beside it.',
    },
    WHATSAPP_ACCESS_TOKEN: {
      universalIdentifier: WHATSAPP_ACCESS_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'WhatsApp access token',
      description:
        'A permanent System User token. The temporary one on the API Setup page expires in 24 hours.',
      isSecret: true,
    },
    WHATSAPP_VERIFY_TOKEN: {
      universalIdentifier: WHATSAPP_VERIFY_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Webhook verify token',
      description:
        'Any string you invent. Paste the same one into Meta when you set the callback URL.',
      isSecret: true,
    },
    WHATSAPP_APP_SECRET: {
      universalIdentifier: WHATSAPP_APP_SECRET_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Meta app secret',
      description:
        'From Meta > App settings > Basic. Signs every webhook - without it, inbound messages are refused.',
      isSecret: true,
    },
  },
});

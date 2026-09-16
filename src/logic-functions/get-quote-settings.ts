import { defineLogicFunction } from 'twenty-sdk/define';

import { GET_QUOTE_SETTINGS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';
import { getQuoteSettings } from 'src/lib/quote-settings';
import { formatDocumentNumber } from 'src/lib/quote-math';

/**
 * Read the billing settings for the Settings screen.
 *
 * Returns a preview of the next document number alongside the raw values,
 * because "prefix Q- and padding 4" is much harder to check at a glance than
 * seeing "Q-0007" and recognising it.
 */
const handler = async () => {
  const settings = await getQuoteSettings();

  return {
    ...settings,
    nextDocumentNumberPreview: formatDocumentNumber(
      settings.quotePrefix,
      settings.quotePadding,
      settings.nextQuoteSequence,
    ),
  };
};

export default defineLogicFunction({
  universalIdentifier: GET_QUOTE_SETTINGS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'get-quote-settings',
  description: 'Reads the billing settings used when a quote is issued',
  timeoutSeconds: 5,
  handler,
  httpRouteTriggerSettings: {
    path: '/quote-settings',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});

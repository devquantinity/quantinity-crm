import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  useSelectedRecordIds,
  enqueueSnackbar,
  openCommandConfirmationModal,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';

import { WITHDRAW_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/** Withdraw action. Danger accent, because the client's live offer disappears. */

type WithdrawResponse = { ok?: boolean; error?: string; documentNumber?: string };

const WithdrawQuoteCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open a quote first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Withdraw this quotation?',
      subtitle:
        'The client link stays live but shows the quotation as withdrawn, and it can no longer be accepted. The document number stays spent.',
      confirmButtonText: 'Withdraw',
      confirmButtonAccent: 'danger',
    });

    if (choice !== 'confirm') {
      return;
    }

    try {
      const response = (await new RestApiClient().post('/s/quotes/withdraw', {
        quoteId: recordId,
      })) as WithdrawResponse;

      if (!response?.ok) {
        await enqueueSnackbar({
          message: response?.error ?? 'Could not withdraw this quote',
          variant: 'error',
        });
        return;
      }

      await enqueueSnackbar({
        message: `${response.documentNumber} withdrawn`,
        variant: 'success',
      });
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not withdraw this quote'),
        variant: 'error',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier:
    WITHDRAW_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'withdraw-quote-command',
  description: 'Closes an issued quotation without deleting its number',
  isHeadless: true,
  component: WithdrawQuoteCommand,
});

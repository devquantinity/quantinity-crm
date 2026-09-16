import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  useSelectedRecordIds,
  enqueueSnackbar,
  openCommandConfirmationModal,
  navigate,
  AppPath,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';

import { REVISE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/** Revise action. Lands the user on the new draft, which is where they wanted to be. */

type ReviseResponse = {
  ok?: boolean;
  error?: string;
  quoteId?: string;
  name?: string;
  copiedLineItems?: number;
};

const ReviseQuoteCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open a quote first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Create a revision?',
      subtitle:
        'This copies the quotation into a new draft with the same number and the next revision. The current version stays live until the revision is issued.',
      confirmButtonText: 'Revise',
    });

    if (choice !== 'confirm') {
      return;
    }

    try {
      const response = (await new RestApiClient().post('/s/quotes/revise', {
        quoteId: recordId,
      })) as ReviseResponse;

      if (!response?.ok) {
        await enqueueSnackbar({
          message: response?.error ?? 'Could not revise this quote',
          variant: 'error',
        });
        return;
      }

      await enqueueSnackbar({
        message: `${response.name} created`,
        variant: 'success',
        detailedMessage: `${response.copiedLineItems} line item${response.copiedLineItems === 1 ? '' : 's'} copied across.`,
      });

      if (response.quoteId) {
        await navigate(AppPath.RecordShowPage, {
          objectNameSingular: 'quote',
          objectRecordId: response.quoteId,
        });
      }
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not revise this quote'),
        variant: 'error',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: REVISE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'revise-quote-command',
  description: 'Clones an issued quote as the next draft revision',
  isHeadless: true,
  component: ReviseQuoteCommand,
});

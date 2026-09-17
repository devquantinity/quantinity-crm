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
import { DUPLICATE_QUOTE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

type DuplicateResponse = {
  quoteId?: string;
  name?: string;
  lines?: number;
  fromTemplate?: boolean;
};

const DuplicateQuoteCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open a quotation first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Duplicate this quotation?',
      subtitle:
        'Copies the lines into a new draft. The number, the dates and the deal are not carried over — attach the new deal before issuing.',
      confirmButtonText: 'Duplicate',
    });

    if (choice !== 'confirm') return;

    try {
      const response = (await new RestApiClient().post('/s/quotes/duplicate', {
        quoteId: recordId,
      })) as DuplicateResponse;

      await enqueueSnackbar({
        message: `${response.name} · ${response.lines} ${
          response.lines === 1 ? 'line' : 'lines'
        } copied`,
        variant: 'success',
        detailedMessage: 'Attach a deal to it before issuing.',
      });

      if (response.quoteId) {
        await navigate(AppPath.RecordShowPage, {
          objectNameSingular: 'quote',
          objectRecordId: response.quoteId,
        });
      }
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not duplicate the quotation'),
        variant: 'error',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: DUPLICATE_QUOTE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'duplicate-quote-command',
  description: 'Copies a quotation or template into a new draft',
  isHeadless: true,
  component: DuplicateQuoteCommand,
});

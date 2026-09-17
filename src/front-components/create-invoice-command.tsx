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
import { CREATE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';

type CreateInvoiceResponse = {
  invoiceId?: string;
  name?: string;
  kind?: string;
  amount?: string;
  partial?: boolean;
};

const CreateInvoiceCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open a milestone first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Bill this milestone?',
      subtitle:
        'Drafts an invoice for whatever is still unbilled on it. Nothing is sent until you issue it.',
      confirmButtonText: 'Draft invoice',
    });

    if (choice !== 'confirm') return;

    try {
      const response = (await new RestApiClient().post(
        '/s/invoices/create-from-milestone',
        { milestoneId: recordId },
      )) as CreateInvoiceResponse;

      await enqueueSnackbar({
        message: `Draft invoice for ${response.amount}`,
        variant: 'success',
        detailedMessage: response.partial
          ? 'This covers the unbilled remainder of the milestone.'
          : undefined,
      });

      if (response.invoiceId) {
        await navigate(AppPath.RecordShowPage, {
          objectNameSingular: 'invoice',
          objectRecordId: response.invoiceId,
        });
      }
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not draft the invoice'),
        variant: 'error',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: CREATE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-invoice-command',
  description: 'Drafts an invoice for the unbilled remainder of a milestone',
  isHeadless: true,
  component: CreateInvoiceCommand,
});

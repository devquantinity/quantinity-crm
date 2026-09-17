import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  useSelectedRecordIds,
  enqueueSnackbar,
  openCommandConfirmationModal,
  copyToClipboard,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';
import { resolveShareLink } from 'src/lib/share-url';
import { ISSUE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';

type IssueInvoiceResponse = {
  documentNumber?: string;
  amount?: string;
  dueDate?: string;
  shareUrl?: string;
};

const IssueInvoiceCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open an invoice first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Issue this invoice?',
      subtitle:
        'Assigns the next invoice number, freezes your business and client details onto it, and sets the due date from your payment terms. It cannot be undone.',
      confirmButtonText: 'Issue',
    });

    if (choice !== 'confirm') return;

    try {
      const response = (await new RestApiClient().post('/s/invoices/issue', {
        invoiceId: recordId,
      })) as IssueInvoiceResponse;

      const link = resolveShareLink(response.shareUrl, globalThis.location?.origin);

      if (link) await copyToClipboard(link);

      await enqueueSnackbar({
        message: `${response.documentNumber} issued, due ${response.dueDate}`,
        variant: 'success',
        detailedMessage: link
          ? `Client link copied: ${link}`
          : 'Could not build the client link - open the invoice and use its share token.',
      });
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not issue the invoice'),
        variant: 'error',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: ISSUE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'issue-invoice-command',
  description: 'Issues a draft invoice and copies its client link',
  isHeadless: true,
  component: IssueInvoiceCommand,
});

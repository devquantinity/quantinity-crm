import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  useSelectedRecordIds,
  enqueueSnackbar,
  openCommandConfirmationModal,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';
import { MARK_PAID_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';

type MarkPaidResponse = { documentNumber?: string };

const MarkInvoicePaidCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open an invoice first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Mark this invoice paid?',
      subtitle:
        'Records that the money arrived. Set "Paid via" on the record afterwards so reconciliation has the detail.',
      confirmButtonText: 'Mark paid',
    });

    if (choice !== 'confirm') return;

    try {
      const response = (await new RestApiClient().post('/s/invoices/mark-paid', {
        invoiceId: recordId,
      })) as MarkPaidResponse;

      await enqueueSnackbar({
        message: `${response.documentNumber} marked paid`,
        variant: 'success',
      });
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not mark the invoice paid'),
        variant: 'error',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: MARK_PAID_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mark-invoice-paid-command',
  description: 'Records payment of an issued invoice',
  isHeadless: true,
  component: MarkInvoicePaidCommand,
});

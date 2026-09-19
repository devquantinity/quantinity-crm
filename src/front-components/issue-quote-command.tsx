import { defineFrontComponent } from 'twenty-sdk/define';
import {
  Command,
  useSelectedRecordIds,
  enqueueSnackbar,
  copyToClipboard,
  openCommandConfirmationModal,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';
import { runOnce } from 'src/lib/in-flight';
import { resolveShareLink } from 'src/lib/share-url';

import { ISSUE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/**
 * The Issue action on a quote record.
 *
 * Headless: it has no UI of its own, it runs when the command is picked. The
 * confirmation modal is not politeness - issuing consumes a document number and
 * cannot be undone, so the one thing this component owes the user is a pause
 * before that happens.
 *
 * On success it puts the client link straight on the clipboard, because the
 * next thing anybody does after issuing is paste that link into WhatsApp.
 */

type IssueResponse = {
  ok?: boolean;
  error?: string;
  documentNumber?: string;
  shareUrl?: string;
};

const IssueQuoteCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      enqueueSnackbar({ message: 'Open a quote first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Issue this quotation?',
      subtitle:
        'This assigns the next document number, freezes your business and client details onto it, and locks the totals. It cannot be undone - a change after this means a new revision.',
      confirmButtonText: 'Issue',
    });

    if (choice !== 'confirm') {
      return;
    }

    const outcome = await runOnce('issue-quote', recordId, async () => {
      try {
        const response = (await new RestApiClient().post('/s/quotes/issue', {
          quoteId: recordId,
        })) as IssueResponse;

        if (!response?.ok) {
          await enqueueSnackbar({
            message: response?.error ?? 'Could not issue this quote',
            variant: 'error',
          });
          return;
        }

        // Front components run in a sandboxed worker, so `location` may not be
        // there. Fall back to the path rather than pasting "undefined/s/quote".
        const shareLink = resolveShareLink(
          response.shareUrl,
          globalThis.location?.origin,
        );

        if (shareLink) {
          await copyToClipboard(shareLink);
        }

        await enqueueSnackbar({
          message: `${response.documentNumber} issued`,
          variant: 'success',
          detailedMessage: shareLink
            ? `Client link copied to clipboard: ${shareLink}`
            : undefined,
        });
      } catch (error) {
        await enqueueSnackbar({
          message: commandErrorMessage(error, 'Could not issue this quote'),
          variant: 'error',
        });
      }
    });

    // Already running. Saying nothing would look like the click missed.
    if (!outcome.ran) {
      await enqueueSnackbar({
        message: 'This quotation is already being issued.',
        variant: 'info',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier:
    ISSUE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'issue-quote-command',
  description: 'Issues the selected draft quote and copies its client link',
  isHeadless: true,
  component: IssueQuoteCommand,
});

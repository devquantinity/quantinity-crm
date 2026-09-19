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
import { runOnce } from 'src/lib/in-flight';
import { CREATE_PROJECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';

/** Hand a won deal off to delivery, from the deal page. */

type CreateProjectResponse = {
  ok?: boolean;
  projectId?: string;
  name?: string;
  seededMilestones?: number;
  fromQuote?: string | null;
};

const CreateProjectCommand = () => {
  const [recordId] = useSelectedRecordIds();

  const execute = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open a deal first', variant: 'error' });
      return;
    }

    const choice = await openCommandConfirmationModal({
      title: 'Start the project?',
      subtitle:
        'Creates a delivery project for this deal, carries across the value from the accepted quotation, and turns its lines into milestones you can edit.',
      confirmButtonText: 'Start project',
    });

    if (choice !== 'confirm') {
      return;
    }

    const outcome = await runOnce('start-project', recordId, async () => {
      try {
        const response = (await new RestApiClient().post(
          '/s/projects/create-from-opportunity',
          { opportunityId: recordId },
        )) as CreateProjectResponse;

        const seeded = response.seededMilestones ?? 0;

        await enqueueSnackbar({
          message: `${response.name} started`,
          variant: 'success',
          detailedMessage: response.fromQuote
            ? `${seeded} milestone${seeded === 1 ? '' : 's'} from ${response.fromQuote}.`
            : 'No accepted quotation found, so the project starts empty.',
        });

        if (response.projectId) {
          await navigate(AppPath.RecordShowPage, {
            objectNameSingular: 'project',
            objectRecordId: response.projectId,
          });
        }
      } catch (error) {
        await enqueueSnackbar({
          message: commandErrorMessage(error, 'Could not start the project'),
          variant: 'error',
        });
      }
    });

    // Already running. Saying nothing would look like the click missed.
    if (!outcome.ran) {
      await enqueueSnackbar({
        message: 'A project is already being started for this deal.',
        variant: 'info',
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: CREATE_PROJECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-project-command',
  description: 'Creates a delivery project from the selected won deal',
  isHeadless: true,
  component: CreateProjectCommand,
});

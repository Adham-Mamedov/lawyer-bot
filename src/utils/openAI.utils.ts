import { failedStatuses, Run, successStatuses } from '@src/types/openAI.types';
import { poll } from '@src/utils/async.utils';
import { openai } from '@src/config/openAI.config';
import { openAIMessagesPageToTelegramMessages } from '@src/helpers/message.helpers';

type TProcessRunOptions = {
  run: Run;
  onSuccess: (run: Run) => void;
  onFailure: (run: Run) => void;
};
export const processRun = async ({
  run,
  onSuccess,
  onFailure,
}: TProcessRunOptions) => {
  const resolvedRun = await poll({
    pollingInterval: 1000,
    maxAttempts: 30,
    pollingFunction: async () => {
      return openai.beta.threads.runs.retrieve(run.thread_id, run.id);
    },
    isSuccessCondition: (run) => {
      return (
        successStatuses.includes(run.status) ||
        failedStatuses.includes(run.status)
      );
    },
  });

  if (!resolvedRun) {
    return onFailure(run);
  }

  if (successStatuses.includes(resolvedRun.status)) {
    return onSuccess(resolvedRun);
  }

  onFailure(resolvedRun);
};

// === ====================================================================================== ===
type TOnRunResolveOptions = {
  run: Run;
  messageId: string;
  callback: (messages: string[]) => unknown;
};
export const onRunSuccess = async ({
  run,
  messageId,
  callback,
}: TOnRunResolveOptions) => {
  const messages = await openai.beta.threads.messages.list(run.thread_id, {
    before: messageId,
  });

  const replyMessages = openAIMessagesPageToTelegramMessages(messages);

  return callback(replyMessages);
};

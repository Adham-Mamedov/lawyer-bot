import { Response } from 'openai/_shims/node-types';
import { failedStatuses, Run, successStatuses } from '@src/types/openAI.types';
import { poll } from '@src/utils/async.utils';
import { openai } from '@src/config/openAI.config';
import { appConfig } from '@src/config/app.config';
import { openAIMessagesPageToTelegramMessages } from '@src/helpers/message.helpers';

export const createThread = async () => {
  return openai.beta.threads.create();
};

export const deleteThread = async (threadId: string) => {
  return openai.beta.threads.del(threadId);
};

export const createRun = async (threadId: string) => {
  return openai.beta.threads.runs.create(threadId, {
    assistant_id: appConfig.openAIAssistantId,
  });
};

export const cancelRun = async (run: Run) => {
  try {
    await openai.beta.threads.runs.cancel(run.thread_id, run.id);
  } catch (error) {
    console.log(error);
  }
};

type TProcessRunOptions = {
  run: Run;
  onSuccess: (run: Run) => void;
  onFailure: (run: Run, response: Response) => void;
  onTimeout: (run: Run) => void;
};
export const processRun = async ({
  run,
  onSuccess,
  onTimeout,
  onFailure,
}: TProcessRunOptions) => {
  try {
    const result = await poll({
      pollingInterval: 2000,
      maxAttempts: 25,
      pollingFunction: async () => {
        return await openai.beta.threads.runs
          .retrieve(run.thread_id, run.id)
          .withResponse();
      },
      isSuccessCondition: ({ data: run }) => {
        console.log('Run status:', run.status);
        return (
          successStatuses.includes(run.status) ||
          failedStatuses.includes(run.status)
        );
      },
    });

    if (!result) {
      return onTimeout(run);
    }

    const { data: resolvedRun, response } = result;

    if (successStatuses.includes(resolvedRun.status)) {
      return onSuccess(resolvedRun);
    }

    onFailure(resolvedRun, response);
  } catch (error) {
    console.error('Error during run processing:', error);
  }
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

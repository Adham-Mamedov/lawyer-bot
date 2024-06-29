import {
  failedStatuses,
  FileCreateParams,
  FileListParams,
  IOpenAIService,
  Run,
  successStatuses,
} from '@src/types/openAI.types';
import OpenAI from 'openai';

import { poll } from '@src/utils/async.utils';
import { openAIMessagesPageToTelegramMessages } from '@src/helpers/message.helpers';
import { appConfig } from '@src/config/app.config';
import { Logger } from '@src/main';

export class OpenAIService implements IOpenAIService {
  private static instance: OpenAIService;
  private readonly openAI: OpenAI;
  private TEN_MINUTES = 10 * 60 * 1000;

  private constructor() {
    this.openAI = new OpenAI({
      apiKey: appConfig.openAiKey,
      timeout: this.TEN_MINUTES,
    });
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  // === ================================================== FILE METHODS ============================================================== ===

  getFileById: IOpenAIService['getFileById'] = async (id: string) => {
    try {
      return await this.openAI.files.retrieve(id);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error getting file by id');
      return null;
    }
  };

  getAllFiles: IOpenAIService['getAllFiles'] = async (
    query?: FileListParams,
  ) => {
    try {
      return await this.openAI.files.list(query);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error getting files');
      return null;
    }
  };

  createFile: IOpenAIService['createFile'] = async (
    params: FileCreateParams,
  ) => {
    try {
      return await this.openAI.files.create(params);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error creating file');
      return null;
    }
  };

  // === ================================================== ASSISTANT METHODS ============================================================== ===
  getAllAssistants: IOpenAIService['getAllAssistants'] = async () => {
    try {
      return await this.openAI.beta.assistants.list();
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error getting assistants');
      return null;
    }
  };

  updateAssistant: IOpenAIService['updateAssistant'] = async (
    id,
    assistantDTO,
  ) => {
    try {
      return await this.openAI.beta.assistants.update(id, assistantDTO);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error updating assistant');
      return null;
    }
  };

  // === ================================================== DB METHODS ============================================================== ===

  createThread: IOpenAIService['createThread'] = () => {
    return this.openAI.beta.threads.create();
  };

  deleteThread: IOpenAIService['deleteThread'] = async (threadId: string) => {
    try {
      return await this.openAI.beta.threads.del(threadId);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error deleting run');
      return null;
    }
  };

  createMessage: IOpenAIService['createMessage'] = async ({
    threadId,
    message,
  }) => {
    return this.openAI.beta.threads.messages.create(threadId, {
      content: message,
      role: 'user',
    });
  };

  createRun: IOpenAIService['createRun'] = async (threadId: string) => {
    return this.openAI.beta.threads.runs.create(threadId, {
      assistant_id: appConfig.openAIAssistantId,
    });
  };
  cancelRun: IOpenAIService['cancelRun'] = async (run: Run) => {
    try {
      return await this.openAI.beta.threads.runs.cancel(run.thread_id, run.id);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error canceling run');
      return null;
    }
  };

  // === ================================================== TELEGRAM METHODS ============================================================== ===

  processRun: IOpenAIService['processRun'] = async ({
    run,
    onSuccess,
    onTimeout,
    onFailure,
  }) => {
    try {
      const result = await poll({
        pollingInterval: 2000,
        maxAttempts: 25,
        pollingFunction: async () => {
          return await this.openAI.beta.threads.runs
            .retrieve(run.thread_id, run.id)
            .withResponse();
        },
        isSuccessCondition: ({ data: run }) => {
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

      return onFailure(resolvedRun, response);
    } catch (error) {
      Logger.error(error, '[OpenAIService]: Error during run processing');
    }
  };

  onRunSuccess: IOpenAIService['onRunSuccess'] = async ({
    run,
    messageId,
    callback,
  }) => {
    const messages = await this.openAI.beta.threads.messages.list(
      run.thread_id,
      {
        before: messageId,
      },
    );

    //TODO: remove log
    console.dir(run.usage, { depth: 3 });

    const replyMessages = openAIMessagesPageToTelegramMessages(messages);

    return callback(replyMessages);
  };
}

import { Response } from 'openai/_shims/node-types';
import { OpenAI } from 'openai';

export type FileObject = OpenAI.FileObject;
export type FileObjectsPage = OpenAI.FileObjectsPage;
export type FileListParams = OpenAI.FileListParams;
export type FileCreateParams = OpenAI.FileCreateParams;

export type Assistant = OpenAI.Beta.Assistant;
export type AssistantsPage = OpenAI.Beta.AssistantsPage;
export type AssistantUpdateParams = OpenAI.Beta.AssistantUpdateParams;

export type Run = OpenAI.Beta.Threads.Run;
export type ThreadMessagesPage = OpenAI.Beta.Threads.MessagesPage;
export type ThreadMessage = OpenAI.Beta.Threads.Message;
export type Thread = OpenAI.Beta.Threads.Thread;
export type ThreadDeleted = OpenAI.Beta.Threads.ThreadDeleted;

export const inProgressStatuses = ['in_progress', 'queued'] as const;
export const successStatuses = ['completed'] as const;
export const failedStatuses = [
  'failed',
  'cancelled',
  'expired',
  'cancelling',
  'requires_action',
] as const;

type TProcessRunOptions = {
  run: Run;
  onSuccess: (run: Run) => unknown;
  onFailure: (run: Run, response: Response) => unknown;
  onTimeout: (run: Run) => unknown;
};

type TOnRunResolveOptions = {
  run: Run;
  messageId: string;
  callback: (messages: string[]) => unknown;
};

export interface IOpenAIService {
  getFileById(id: string): Promise<FileObject | null>;
  getAllFiles(params?: FileListParams): Promise<FileObjectsPage | null>;
  createFile(params: FileCreateParams): Promise<FileObject | null>;

  getAllAssistants(): Promise<AssistantsPage | null>;
  updateAssistant(
    id: string,
    params: AssistantUpdateParams,
  ): Promise<Assistant | null>;

  createThread(): Promise<Thread>;
  deleteThread(threadId: string): Promise<ThreadDeleted>;

  createMessage(options: {
    threadId: string;
    message: string;
  }): Promise<ThreadMessage>;

  createRun(threadId: string): Promise<Run>;
  cancelRun(run: Run): Promise<Run | null>;

  processRun(options: TProcessRunOptions): Promise<unknown>;
  onRunSuccess(options: TOnRunResolveOptions): Promise<unknown>;
}

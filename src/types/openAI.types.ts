import { OpenAI } from 'openai';

export type Run = OpenAI.Beta.Threads.Run;

export type ThreadMessagesPage = OpenAI.Beta.Threads.ThreadMessagesPage;
export type ThreadMessage = OpenAI.Beta.Threads.ThreadMessage;

export const inProgressStatuses = ['in_progress', 'queued'] as const;
export const successStatuses = ['completed'] as const;
export const failedStatuses = [
  'failed',
  'cancelled',
  'expired',
  'cancelling',
  'requires_action',
] as const;

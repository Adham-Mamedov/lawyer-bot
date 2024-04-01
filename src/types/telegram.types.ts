import TelegramBot from 'node-telegram-bot-api';
import { Run, Thread } from '@src/types/openAI.types';

export type User = TelegramBot.User & { is_premium?: boolean };

export enum ETelegramCommands {
  Start = '/start',
  NewThread = '/new',
  CheckLimit = '/my_limit',
  Help = '/help',
}

type TelegramCommands = {
  [ETelegramCommands.Start]: (options: { chatId: number; user: User }) => void;
  [ETelegramCommands.NewThread]: (options: { chatId: number }) => void;
  [ETelegramCommands.CheckLimit]: (options: {
    chatId: number;
    userId: number;
  }) => void;
  [ETelegramCommands.Help]: (options: { chatId: number }) => void;
};

export type ITelegramService = {
  init(): void;
  handleNewUser(props: { user: User; chatId: number }): Promise<void>;
  processUserPrompt(props: {
    chatId: number;
    userPrompt: string;
    user: User;
  }): Promise<void>;

  onRunSuccess(props: {
    resolvedRun: Run;
    user: User;
    chatId: number;
    threadId: string;
    messageId: string;
  }): Promise<unknown>;

  onRunFailure(props: {
    run: Run;
    chatId: number;
    retryCount: number;
    retryCb: (run: Run, retryCount: number) => void;
  }): Promise<void>;

  onRunTimeout(props: {
    run: Run;
    chatId: number;
    retryCount: number;
    retryCb: (run: Run, retryCount: number) => void;
  }): Promise<void>;

  onUserInteraction(props: {
    user: User;
    chatId: number;
    totalUsage: number;
    threadId: string;
  }): Promise<void>;

  sendMessages(chatId: number, messages: string[]): void;

  createThread(props: { user: User; chatId: number }): Promise<Thread>;

  onStartCommand: TelegramCommands[ETelegramCommands.Start];
  onNewThreadCommand: TelegramCommands[ETelegramCommands.NewThread];
  onCheckLimitCommand: TelegramCommands[ETelegramCommands.CheckLimit];
  onHelpCommand: TelegramCommands[ETelegramCommands.Help];
};

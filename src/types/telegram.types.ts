import TelegramBot from 'node-telegram-bot-api';

export type User = TelegramBot.User & { is_premium?: boolean };

export enum ETelegramCommands {
  Start = '/start',
  NewThread = '/new',
  CheckLimit = '/my_limit',
  Help = '/help',
}

export type TelegramCommands = {
  [ETelegramCommands.Start]: {
    description: string;
    action: (options: { chatId: number; user: User }) => void;
  };
  [ETelegramCommands.NewThread]: {
    description: string;
    action: (options: { chatId: number }) => void;
  };
  [ETelegramCommands.CheckLimit]: {
    description: string;
    action: (options: { chatId: number; userId: number }) => void;
  };
  [ETelegramCommands.Help]: {
    description: string;
    action: (options: { chatId: number }) => void;
  };
};

import TelegramBot from 'node-telegram-bot-api';

export type User = TelegramBot.User & { is_premium?: boolean };

export interface INotificationService {
  onNewUser(user: User): void;
  healthPing(): void;
  onError(error: any): void;
}

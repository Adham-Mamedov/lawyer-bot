import { Limit, Thread, User } from '@prisma/client';
import { User as TelegramUser } from 'node-telegram-bot-api';

export type UpsertThreadDto = {
  id: string;
  chatId: number;
  userTgId: number;
};

export interface IPrismaService {
  createCustomIndexes(): void;
  createExpirationIndex(collection: string): void;

  getUserByTelegramId(id: number): Promise<User | null>;
  upsertUserByTelegramId(props: {
    user: TelegramUser;
    chatId: number;
  }): Promise<User | null>;

  getThreadByChatId(chatId: number): Promise<Thread | null>;
  upsertThread(props: UpsertThreadDto): Promise<Thread | null>;
  deleteThread(id: string): Promise<Thread | null>;

  getUserLimit(userId: number): Promise<number>;
  checkUserLimitReached(userId: number): Promise<boolean>;
  decreaseUserLimit(userId: number, totalUsage: number): Promise<Limit | null>;
}

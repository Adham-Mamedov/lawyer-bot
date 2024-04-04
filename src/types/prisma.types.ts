import { Limit, Thread, User } from '@prisma/client';
import { User as TelegramUser } from 'node-telegram-bot-api';

export type UpsertThreadDto = {
  id: string;
  chatId: number;
  userTgId: number;
};

type UpdateUserDto = Partial<
  Omit<User, 'id' | 'telegramId' | 'createdAt' | 'lastMessageAt' | 'limitId'>
> & { chatId: User['chatId'] };
export interface IPrismaService {
  createCustomIndexes(): void;
  createExpirationIndex(collection: string): void;

  getUserByTelegramId(id: number): Promise<User | null>;
  upsertUserByTelegramId(
    user: TelegramUser,
    update: UpdateUserDto,
  ): Promise<User | null>;
  checkUserInfoCompleteness(
    userId: number,
  ): Promise<{ firstName: boolean; lastName: boolean; phone: boolean }>;

  getThreadByChatId(chatId: number): Promise<Thread | null>;
  upsertThread(props: UpsertThreadDto): Promise<Thread | null>;
  deleteThread(id: string): Promise<Thread | null>;

  getUserLimit(userId: number): Promise<number>;
  checkUserLimitReached(userId: number): Promise<boolean>;
  decreaseUserLimit(userId: number, totalUsage: number): Promise<Limit | null>;
}

export enum ERegistrationSteps {
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  PHONE = 'phone',
}

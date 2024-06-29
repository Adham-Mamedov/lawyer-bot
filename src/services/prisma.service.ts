import { PrismaClient } from '@prisma/client';
import { IPrismaService } from '@src/types/prisma.types';
import { User } from '@src/types/telegram.types';
import { getNextDayMidnightInUTC } from '@src/utils/time.utils';
import {
  MIN_TOKENS_FOR_REQUEST,
  THREAD_EXPIRATION_TIME,
  TOKENS_PER_DAY_LIMIT,
} from '@src/config/defaults.config';
import { Logger } from '@src/main';

export class PrismaService implements IPrismaService {
  private static instance: PrismaService;
  private readonly prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public createCustomIndexes() {
    this.createExpirationIndex('threads');
    this.createExpirationIndex('limits');
  }

  createExpirationIndex: IPrismaService['createExpirationIndex'] = (
    collection,
  ) => {
    if (!collection) return;
    this.prisma
      .$runCommandRaw({
        createIndexes: collection,
        indexes: [
          {
            key: {
              expiresAt: 1,
            },
            name: 'expiresAt_auto_delete',
            expireAfterSeconds: 0,
          },
        ],
      })
      .then((res) => {
        console.dir(res, { depth: 3 });
      });
  };

  // === ========================================= USERS =============================================== ===
  private mapUserToDBUser(user: User) {
    return {
      firstName: user.first_name,
      lastName: user.last_name || null,
      username: user.username || null,
      languageCode: user.language_code || 'ru',
      isPremium: !!user.is_premium,
    };
  }

  getUserByTelegramId: IPrismaService['getUserByTelegramId'] = async (id) => {
    try {
      return await this.prisma.user.findUnique({
        where: {
          telegramId: id,
        },
      });
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error getting user by telegramId');
      return null;
    }
  };

  upsertUserByTelegramId: IPrismaService['upsertUserByTelegramId'] = async (
    user,
    updateDto,
  ) => {
    try {
      return await this.prisma.user.upsert({
        where: {
          telegramId: user.id,
        },
        update: {
          ...this.mapUserToDBUser(user),
          lastMessageAt: new Date(),
          ...updateDto,
        },
        create: {
          telegramId: user.id,
          ...this.mapUserToDBUser(user),
          phoneNumber: null,
          chatId: updateDto.chatId,
          Limit: {
            create: {
              tpd: TOKENS_PER_DAY_LIMIT,
              expiresAt: getNextDayMidnightInUTC(),
            },
          },
        },
      });
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error creating user');
      return null;
    }
  };

  checkUserInfoCompleteness: IPrismaService['checkUserInfoCompleteness'] =
    async (userId) => {
      const user = await this.getUserByTelegramId(userId);
      return {
        firstName: !!user?.enteredFirstName,
        lastName: !!user?.enteredLastName,
        phone: !!user?.phoneNumber,
      };
    };

  // === ========================================= THREADS =============================================== ===
  getThreadByChatId: IPrismaService['getThreadByChatId'] = async (chatId) => {
    try {
      return await this.prisma.thread.findFirst({
        where: {
          chatId,
        },
      });
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error getting thread by chatId');
      return null;
    }
  };

  upsertThread: IPrismaService['upsertThread'] = async ({
    id,
    userTgId,
    chatId,
  }) => {
    const expiresAt = new Date(Date.now() + THREAD_EXPIRATION_TIME);
    try {
      return await this.prisma.thread.upsert({
        where: {
          id,
        },
        update: {
          expiresAt,
        },
        create: {
          id,
          chatId,
          userId: userTgId,
          expiresAt,
        },
      });
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error upserting thread');
      return null;
    }
  };

  deleteThread: IPrismaService['deleteThread'] = async (id) => {
    try {
      return await this.prisma.thread.delete({
        where: {
          id,
        },
      });
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error deleting thread');
      return null;
    }
  };

  // === ========================================= LIMITS =============================================== ===

  getUserLimit: IPrismaService['getUserLimit'] = async (userId) => {
    try {
      let limit = await this.prisma.limit.findUnique({
        where: {
          userId,
        },
      });

      if (!limit) {
        limit = await this.prisma.limit.create({
          data: {
            userId,
            tpd: TOKENS_PER_DAY_LIMIT,
            expiresAt: getNextDayMidnightInUTC(),
          },
        });
      }

      return limit?.tpd || -1;
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error getting user limit');
      return -1;
    }
  };

  checkUserLimitReached: IPrismaService['checkUserLimitReached'] = async (
    userId: number,
  ) => {
    try {
      const limit = await this.getUserLimit(userId);
      return limit <= MIN_TOKENS_FOR_REQUEST;
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error checking user limit');
      return true;
    }
  };

  decreaseUserLimit: IPrismaService['decreaseUserLimit'] = async (
    userId: number,
    totalUsage: number,
  ) => {
    try {
      return await this.prisma.limit.upsert({
        where: {
          userId,
        },
        create: {
          userId,
          tpd: TOKENS_PER_DAY_LIMIT - totalUsage,
          expiresAt: getNextDayMidnightInUTC(),
        },
        update: {
          tpd: {
            decrement: totalUsage,
          },
        },
      });
    } catch (error) {
      Logger.error(error, '[PrismaService]: Error decreasing user limit');
      return null;
    }
  };
}

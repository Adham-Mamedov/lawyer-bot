import { PrismaClient } from '@prisma/client';
import { User } from '@src/types/telegram.types';
import {
  MIN_TOKENS_FOR_REQUEST,
  TOKENS_PER_DAY_LIMIT,
} from '@src/config/defaults.config';
import { getNextDayMidnightInUTC } from '@src/utils/time.utils';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const prisma = new PrismaClient();

const createExpirationIndex = (collection: string) => {
  if (!collection) return;
  prisma
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

// createExpirationIndex('threads');
// createExpirationIndex('limits');

// === ===================================== USERS =========================================== ===

const mapUserToDBUser = (user: User) => {
  return {
    firstName: user.first_name,
    lastName: user.last_name || null,
    username: user.username || null,
    languageCode: user.language_code || 'ru',
    isPremium: !!user.is_premium,
  };
};

export const createUser = async (
  user: User,
  { chatId }: { chatId: number },
) => {
  try {
    return await prisma.user.create({
      data: {
        telegramId: user.id,
        ...mapUserToDBUser(user),
        phoneNumber: null,
        chatId,
        Limit: {
          create: {
            tpd: TOKENS_PER_DAY_LIMIT,
            expiresAt: getNextDayMidnightInUTC(),
          },
        },
      },
    });
  } catch (error) {
    console.log('Error creating user:', error);
    return null;
  }
};

export const updateUserByTelegramId = async (
  user: User,
  { chatId }: { chatId: number },
) => {
  try {
    return await prisma.user.upsert({
      where: {
        telegramId: user.id,
      },
      update: {
        ...mapUserToDBUser(user),
        lastMessageAt: new Date(),
        chatId,
      },
      create: {
        telegramId: user.id,
        ...mapUserToDBUser(user),
        phoneNumber: null,
        chatId,
      },
    });
  } catch (error) {
    console.log('Error creating user:', error);
    return null;
  }
};

export const getUserByTelegramId = async (id: number) => {
  try {
    return await prisma.user.findUnique({
      where: {
        telegramId: id,
      },
    });
  } catch (error) {
    console.log('Error getting user by telegramId:', error);
    return null;
  }
};

// === ===================================== THREADS =========================================== ===
export type UpsertThreadDto = {
  id: string;
  chatId: number;
  userTgId: number;
};

export const upsertThread = async ({
  id,
  userTgId,
  chatId,
}: UpsertThreadDto) => {
  const expiresAt = new Date(Date.now() + SEVEN_DAYS);
  try {
    return await prisma.thread.upsert({
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
    console.log('Error updating thread:', error);
    return null;
  }
};

export const deleteThread = async (id: string) => {
  try {
    return await prisma.thread.delete({
      where: {
        id,
      },
    });
  } catch (error) {
    console.log('Error deleting thread:', error);
    return null;
  }
};

export const getThreadByChatId = async (chatId: number) => {
  try {
    return await prisma.thread.findFirst({
      where: {
        chatId,
      },
    });
  } catch (error) {
    console.log('Error getting thread by chatId:', error);
    return null;
  }
};

// === ===================================== LIMITS =========================================== ===

export const getUserLimit = async (userId: number) => {
  try {
    let limit = await prisma.limit.findUnique({
      where: {
        userId,
      },
    });

    if (!limit) {
      limit = await prisma.limit.create({
        data: {
          userId,
          tpd: TOKENS_PER_DAY_LIMIT,
          expiresAt: getNextDayMidnightInUTC(),
        },
      });
    }

    return limit?.tpd || -1;
  } catch (error) {
    console.log('Error getting user limit:', error);
    return -1;
  }
};

export const checkUserLimitReached = async (userId: number) => {
  const limit = await getUserLimit(userId);
  return limit <= MIN_TOKENS_FOR_REQUEST;
};

export const decreaseUserLimit = async (userId: number, totalUsage: number) => {
  try {
    await prisma.limit.upsert({
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
    console.log('Error decreasing user limit:', error);
    return null;
  }
};

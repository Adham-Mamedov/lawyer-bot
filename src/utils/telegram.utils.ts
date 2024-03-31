import TelegramBot from 'node-telegram-bot-api';
import { appConfig } from '@src/config/app.config';
import { openai } from '@src/config/openAI.config';
import { TELEGRAM_MESSAGES } from '@src/config/defaults.config';
import {
  cancelRun,
  createRun,
  createThread,
  deleteThread,
  onRunSuccess,
  processRun,
} from '@src/utils/openAI.utils';
import { Run } from '@src/types/openAI.types';
import { wait } from '@src/utils/async.utils';
import {
  checkUserLimitReached,
  createUser,
  decreaseUserLimit,
  deleteThread as deleteThreadFromDB,
  getThreadByChatId,
  getUserByTelegramId,
  getUserLimit,
  updateUserByTelegramId,
  upsertThread,
} from '@src/services/prisma.service';
import {
  ETelegramCommands,
  TelegramCommands,
  User,
} from '@src/types/telegram.types';

export const bot = new TelegramBot(appConfig.telegramBotToken, {
  polling: true,
});

// TODO: add commands and registration steps. Save user phone number, name, last name, etc.
// TODO: restrict out-of-context messages
// TODO: move to telegram service

const EMOJI_REGEX =
  /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const runIdsByChatId = new Map<number, string>();

export const initTelegramBot = () => {
  bot.onText(/^.{2,1000}$/m, async ({ chat, text, from }) => {
    if (telegramCommands[text as keyof TelegramCommands]) return;

    const user = from!;
    const chatId = chat.id;
    const userPrompt = formatInputText(text!);

    if (user.is_bot) {
      return bot.sendMessage(chatId, TELEGRAM_MESSAGES.BOTS_NOT_SUPPORTED);
    }

    if (!userPrompt) {
      return bot.sendMessage(chatId, TELEGRAM_MESSAGES.ONLY_TEXT_INPUT);
    }

    const hasLimitReached = await checkUserLimitReached(user.id);

    if (hasLimitReached) {
      return bot.sendMessage(chatId, TELEGRAM_MESSAGES.LIMIT_REACHED);
    }

    let threadId = await getThreadByChatId(chatId).then((thread) => thread?.id);

    if (runIdsByChatId.has(chatId))
      return bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.WAIT_FOR_PREVIOUS_REQUEST,
      );

    if (threadId === undefined) {
      const thread = await createThread();
      upsertThread({
        id: thread.id,
        userTgId: user.id,
        chatId,
      });
      threadId = thread.id;
    }
    const message = await openai.beta.threads.messages.create(threadId, {
      content: userPrompt,
      role: 'user',
    });

    const run = await createRun(threadId);
    runIdsByChatId.set(chatId, run.id);

    bot.sendMessage(chatId, TELEGRAM_MESSAGES.TAKEN_INTO_PROCESSING);

    const process = (run: Run, repeatCount: number = 0) =>
      processRun({
        run,
        onSuccess: (resolvedRun) => {
          onUserInteraction({
            user,
            chatId,
            threadId: threadId!,
            totalUsage: resolvedRun.usage?.total_tokens || 0,
          });

          return onRunSuccess({
            run: resolvedRun,
            messageId: message.id,
            callback: async (messages) => {
              await sendMessages(chatId, messages);
              runIdsByChatId.delete(chatId);
            },
          });
        },
        onFailure: async (run) => {
          console.error('[On Failure]:', run);

          if (
            repeatCount < 3 &&
            run.last_error?.code === 'rate_limit_exceeded'
          ) {
            bot.sendMessage(chatId, TELEGRAM_MESSAGES.RATE_LIMIT_EXCEEDED);
            await wait(60_000); // TODO: calculate time to wait based on message (Please try again in 2.357s.)
            const newRun = await createRun(run.thread_id);
            runIdsByChatId.set(chatId, newRun.id);
            process(newRun, repeatCount + 1);
            return;
          }

          bot.sendMessage(chatId, TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST);
        },
        onTimeout: async (run) => {
          console.log('[On Timeout]:', run);
          if (repeatCount > 0) {
            return bot.sendMessage(
              chatId,
              TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
            );
          }

          bot.sendMessage(chatId, TELEGRAM_MESSAGES.PROCESSING_TIMEOUT);
          await cancelRun(run);
          const newRun = await createRun(run.thread_id);
          runIdsByChatId.set(chatId, newRun.id);
          process(newRun, repeatCount + 1);
        },
      });

    process(run);
  });

  bot.onText(/^.$/, (msg) => {
    bot.sendMessage(msg.chat.id, TELEGRAM_MESSAGES.INPUT_MIN_LENGTH);
  });
  bot.onText(/.{1001,}/, (msg) => {
    bot.sendMessage(msg.chat.id, TELEGRAM_MESSAGES.INPUT_MAX_LENGTH);
  });

  bot.on('message', (msg) => {
    !msg.text &&
      bot.sendMessage(msg.chat.id, TELEGRAM_MESSAGES.ONLY_TEXT_SUPPORT);
  });

  bot.on('error', (error) => {
    console.error('An error occurred:', error);
  });

  bot.onText(new RegExp(ETelegramCommands.Start), ({ chat, from }) => {
    telegramCommands[ETelegramCommands.Start].action({
      user: from!,
      chatId: chat.id,
    });
  });

  bot.onText(new RegExp(ETelegramCommands.NewThread), ({ chat }) => {
    telegramCommands[ETelegramCommands.NewThread].action({
      chatId: chat.id,
    });
  });

  bot.onText(new RegExp(ETelegramCommands.CheckLimit), ({ chat, from }) => {
    telegramCommands[ETelegramCommands.CheckLimit].action({
      chatId: chat.id,
      userId: from?.id!,
    });
  });

  bot.onText(new RegExp(ETelegramCommands.Help), ({ chat }) => {
    telegramCommands[ETelegramCommands.Help].action({
      chatId: chat.id,
    });
  });
};

// === ================================================================================== ===
const sendMessages = async (chatId: number, messages: string[]) => {
  for (const message of messages) {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }
  await bot.sendMessage(chatId, TELEGRAM_MESSAGES.BOT_MAKES_MISTAKES);
};

// === ================================================================================== ===
const formatInputText = (text: string) => {
  return text.replace(EMOJI_REGEX, '').trim();
};

const handleNewUser = async ({
  user,
  chatId,
}: {
  user: User;
  chatId: number;
}) => {
  const dbUser = await getUserByTelegramId(user.id);

  if (!dbUser) {
    const createdUser = await createUser(user, { chatId });
    createdUser && console.log('[NEW_USER]:', createdUser.username);
  }
};

// === ================================================================================== ===
const onUserInteraction = async ({
  user,
  chatId,
  totalUsage,
  threadId,
}: {
  user: User;
  chatId: number;
  totalUsage: number;
  threadId: string;
}) => {
  decreaseUserLimit(user.id, totalUsage);
  updateUserByTelegramId(user, { chatId });
  upsertThread({ id: threadId, chatId, userTgId: user.id });
};

// === ================================== COMMANDS ================================================ ===

const onStartCommand: TelegramCommands[ETelegramCommands.Start]['action'] =
  async ({ user, chatId }) => {
    handleNewUser({ user, chatId });
    return bot.sendMessage(chatId, TELEGRAM_MESSAGES.START_MESSAGE, {
      parse_mode: 'HTML',
    });
  };

const onNewThreadCommand: TelegramCommands[ETelegramCommands.NewThread]['action'] =
  async ({ chatId }) => {
    const thread = await getThreadByChatId(chatId);
    if (thread) {
      deleteThreadFromDB(thread.id);
      deleteThread(thread.id);
    }
    return bot.sendMessage(chatId, TELEGRAM_MESSAGES.NEW_THREAD, {
      parse_mode: 'HTML',
    });
  };

const onCheckLimitCommand: TelegramCommands[ETelegramCommands.CheckLimit]['action'] =
  async ({ chatId, userId }) => {
    const limit = await getUserLimit(userId);
    return bot.sendMessage(
      chatId,
      TELEGRAM_MESSAGES.CHECK_LIMIT.replace('__limit__', limit.toString()),
      { parse_mode: 'HTML' },
    );
  };

const onHelpCommand: TelegramCommands[ETelegramCommands.Help]['action'] =
  async ({ chatId }) => {
    return bot.sendMessage(chatId, TELEGRAM_MESSAGES.HELP, {
      parse_mode: 'HTML',
    });
  };

const telegramCommands: TelegramCommands = {
  '/start': {
    description: 'Старт',
    action: onStartCommand,
  },
  '/new': {
    description: 'Начать новую тему',
    action: onNewThreadCommand,
  },
  '/my_limit': {
    description: 'Узнать остаток лимита на сегодня',
    action: onCheckLimitCommand,
  },
  '/help': {
    description: 'Помощь',
    action: onHelpCommand,
  },
};

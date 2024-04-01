import TelegramBot from 'node-telegram-bot-api';
import { ETelegramCommands, ITelegramService } from '@src/types/telegram.types';
import { IOpenAIService, Run } from '@src/types/openAI.types';
import { IPrismaService } from '@src/types/prisma.types';

import { PrismaService } from '@src/services/prisma.service';
import { OpenAIService } from '@src/services/openAI.service';
import { formatInputText } from '@src/utils/telegram.utils';
import { wait } from '@src/utils/async.utils';
import { appConfig } from '@src/config/app.config';
import { TELEGRAM_MESSAGES } from '@src/config/defaults.config';

// TODO: add global error handlers
// TODO: add commands and registration steps. Save user phone number, name, last name, etc.
// TODO: restrict out-of-context messages (Create separate assistant to check if message is related to the context)

export class TelegramService implements ITelegramService {
  private static instance: TelegramService;
  private readonly bot: TelegramBot;
  private readonly runIdsByChatId = new Map<number, string>();
  private dbService: IPrismaService;
  private openAIService: IOpenAIService;

  private constructor() {
    this.bot = new TelegramBot(appConfig.telegramBotToken, {
      polling: true,
    });
    this.dbService = PrismaService.getInstance();
    this.openAIService = OpenAIService.getInstance();
  }

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public init() {
    this.initBot();
    this.initCommands();
    this.initErrorHandlers();
  }

  private initBot() {
    this.bot.onText(/^.{2,1000}$/m, async ({ chat, text, from }) => {
      if (
        Object.keys(ETelegramCommands).includes(text!) ||
        text?.startsWith('/')
      )
        return;

      const user = from!;
      const chatId = chat.id;
      const userPrompt = formatInputText(text!);

      if (this.runIdsByChatId.has(chatId))
        return this.bot.sendMessage(
          chatId,
          TELEGRAM_MESSAGES.WAIT_FOR_PREVIOUS_REQUEST,
        );

      if (user.is_bot) {
        return this.bot.sendMessage(
          chatId,
          TELEGRAM_MESSAGES.BOTS_NOT_SUPPORTED,
        );
      }

      if (!userPrompt) {
        return this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.ONLY_TEXT_INPUT);
      }

      const hasLimitReached = await this.dbService.checkUserLimitReached(
        user.id,
      );

      if (hasLimitReached) {
        return this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.LIMIT_REACHED);
      }

      this.processUserPrompt({ chatId, user, userPrompt });
    });
  }

  private initCommands() {
    this.bot.onText(new RegExp(ETelegramCommands.Start), ({ chat, from }) => {
      this.onStartCommand({
        user: from!,
        chatId: chat.id,
      });
    });

    this.bot.onText(new RegExp(ETelegramCommands.NewThread), ({ chat }) => {
      this.onNewThreadCommand({
        chatId: chat.id,
      });
    });

    this.bot.onText(
      new RegExp(ETelegramCommands.CheckLimit),
      ({ chat, from }) => {
        this.onCheckLimitCommand({
          chatId: chat.id,
          userId: from?.id!,
        });
      },
    );

    this.bot.onText(new RegExp(ETelegramCommands.Help), ({ chat }) => {
      this.onHelpCommand({
        chatId: chat.id,
      });
    });
  }

  private initErrorHandlers() {
    this.bot.onText(/^.$/, (msg) => {
      this.bot.sendMessage(msg.chat.id, TELEGRAM_MESSAGES.INPUT_MIN_LENGTH);
    });
    this.bot.onText(/.{1001,}/, (msg) => {
      this.bot.sendMessage(msg.chat.id, TELEGRAM_MESSAGES.INPUT_MAX_LENGTH);
    });

    this.bot.on('message', (msg) => {
      !msg.text &&
        this.bot.sendMessage(msg.chat.id, TELEGRAM_MESSAGES.ONLY_TEXT_SUPPORT);
    });

    this.bot.on('error', (error) => {
      console.error('An error occurred:', error);
    });
  }

  // === ====================================== METHODS ==================================================== ===
  handleNewUser: ITelegramService['handleNewUser'] = async ({
    user,
    chatId,
  }) => {
    try {
      const dbUser = await this.dbService.getUserByTelegramId(user.id);

      if (!dbUser) {
        const createdUser = await this.dbService.upsertUserByTelegramId({
          user,
          chatId,
        });
        createdUser && console.log('[NEW_USER]:', createdUser.username);
      }
    } catch (err) {
      console.error('Error while handling new User:', err);
    }
  };

  processUserPrompt: ITelegramService['processUserPrompt'] = async ({
    chatId,
    user,
    userPrompt,
  }) => {
    let threadId = await this.dbService
      .getThreadByChatId(chatId)
      .then((thread) => thread?.id);

    if (!threadId) {
      const thread = await this.createThread({ user, chatId });
      threadId = thread.id;
    }

    const message = await this.openAIService.createMessage({
      threadId,
      message: userPrompt,
    });

    const run = await this.openAIService.createRun(threadId);
    this.runIdsByChatId.set(chatId, run.id);

    this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.TAKEN_INTO_PROCESSING);

    const process = (run: Run, retryCount: number = 0) =>
      this.openAIService.processRun({
        run,
        onSuccess: (resolvedRun) =>
          this.onRunSuccess({
            resolvedRun,
            user,
            chatId,
            threadId: threadId!,
            messageId: message.id,
          }),
        onFailure: async (run) => {
          this.onRunFailure({
            run,
            chatId,
            retryCount,
            retryCb: process,
          });
        },
        onTimeout: async (run) => {
          this.onRunTimeout({ run, chatId, retryCount, retryCb: process });
        },
      });

    process(run);
  };

  onRunSuccess: ITelegramService['onRunSuccess'] = async ({
    resolvedRun,
    user,
    chatId,
    threadId,
    messageId,
  }) => {
    this.onUserInteraction({
      user,
      chatId,
      threadId: threadId!,
      totalUsage: resolvedRun.usage?.total_tokens || 0,
    });

    return this.openAIService.onRunSuccess({
      run: resolvedRun,
      messageId: messageId,
      callback: async (messages) => {
        await this.sendMessages(chatId, messages);
        this.runIdsByChatId.delete(chatId);
      },
    });
  };

  onRunFailure: ITelegramService['onRunFailure'] = async ({
    run,
    chatId,
    retryCount,
    retryCb,
  }) => {
    console.error('[On Failure]:', run);

    if (retryCount < 3 && run.last_error?.code === 'rate_limit_exceeded') {
      this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.RATE_LIMIT_EXCEEDED);
      await wait(60_000); // TODO: Get time from headers when openAI adds to assistants' API
      const newRun = await this.openAIService.createRun(run.thread_id);
      this.runIdsByChatId.set(chatId, newRun.id);
      retryCb(newRun, retryCount);
    }

    this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST);
  };

  onRunTimeout: ITelegramService['onRunTimeout'] = async ({
    run,
    chatId,
    retryCount,
    retryCb,
  }) => {
    console.log('[On Timeout]:', run);
    if (retryCount > 0) {
      this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST);
      return;
    }

    this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.PROCESSING_TIMEOUT);
    await this.openAIService.cancelRun(run);
    const newRun = await this.openAIService.createRun(run.thread_id);
    this.runIdsByChatId.set(chatId, newRun.id);
    retryCb(newRun, retryCount + 1);
  };

  onUserInteraction: ITelegramService['onUserInteraction'] = async ({
    user,
    chatId,
    totalUsage,
    threadId,
  }) => {
    this.dbService.decreaseUserLimit(user.id, totalUsage);
    this.dbService.upsertUserByTelegramId({ user, chatId });
    this.dbService.upsertThread({ id: threadId, chatId, userTgId: user.id });
  };

  sendMessages: ITelegramService['sendMessages'] = async (chatId, messages) => {
    console.log('Sending messages:', messages);
    for (const message of messages) {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }
    await this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.BOT_MAKES_MISTAKES);
  };

  createThread: ITelegramService['createThread'] = async ({ user, chatId }) => {
    const thread = await this.openAIService.createThread();
    this.dbService.upsertThread({
      id: thread.id,
      userTgId: user.id,
      chatId,
    });

    return thread;
  };

  // === ====================================== COMMANDS ==================================================== ===

  onStartCommand: ITelegramService['onStartCommand'] = async ({
    user,
    chatId,
  }) => {
    try {
      this.handleNewUser({ user, chatId });
      return this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.START_MESSAGE, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('Error while handling Start:', err);
      return this.bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
      );
    }
  };

  onNewThreadCommand: ITelegramService['onNewThreadCommand'] = async ({
    chatId,
  }) => {
    try {
      const thread = await this.dbService.getThreadByChatId(chatId);
      if (thread) {
        this.dbService.deleteThread(thread.id);
        this.openAIService.deleteThread(thread.id);
      }
      return this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.NEW_THREAD, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('Error while handling new Thread:', err);
      return this.bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
      );
    }
  };

  onCheckLimitCommand: ITelegramService['onCheckLimitCommand'] = async ({
    chatId,
    userId,
  }) => {
    try {
      const limit = await this.dbService.getUserLimit(userId);
      return this.bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.CHECK_LIMIT.replace(
          '__limit__',
          limit.toLocaleString('ru-RU'),
        ),
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      console.error('Error while handling Check Limit:', err);
      return this.bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
      );
    }
  };

  onHelpCommand: ITelegramService['onHelpCommand'] = async ({ chatId }) => {
    try {
      return this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.HELP, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('Error while handling Help:', err);
      return this.bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
      );
    }
  };
}

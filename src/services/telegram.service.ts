import TelegramBot from 'node-telegram-bot-api';
import { ETelegramCommands, ITelegramService } from '@src/types/telegram.types';
import { IOpenAIService, Run } from '@src/types/openAI.types';
import { ERegistrationSteps, IPrismaService } from '@src/types/prisma.types';

import { PrismaService } from '@src/services/prisma.service';
import { OpenAIService } from '@src/services/openAI.service';
import {
  formatInputText,
  formatPhoneNumber,
  validatePhoneNumber,
} from '@src/utils/telegram.utils';
import { wait } from '@src/utils/async.utils';
import { appConfig } from '@src/config/app.config';
import {
  HEALTH_PING_INTERVAL,
  TELEGRAM_MESSAGES,
} from '@src/config/defaults.config';
import { Logger } from '@src/main';

// TODO: restrict out-of-context messages (Create separate assistant to check if message is related to the context)

export class TelegramService implements ITelegramService {
  private static instance: TelegramService;
  private readonly bot: TelegramBot;
  private dbService: IPrismaService;
  private openAIService: IOpenAIService;

  private readonly runIdsByChatId = new Map<number, string>();
  private readonly registrationSteps = new Map<number, ERegistrationSteps>();

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
    this.initHealthPing();
    this.initCommands();
    this.initErrorHandlers();
    Logger.info('Telegram bot is running', 'TelegramService');
  }

  private initHealthPing() {
    const healthPingChatId = appConfig.healthPingChatId;
    if (!healthPingChatId) return;
    setInterval(() => {
      this.bot.sendMessage(
        appConfig.healthPingChatId,
        'Telegram bot is running',
      );
    }, HEALTH_PING_INTERVAL);
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

      const canContinue = await this.runGuards({ user, chatId, userPrompt });

      if (!canContinue) return;

      return this.processUserPrompt({ chatId, user, userPrompt }).catch(
        (error) => {
          Logger.error(
            error,
            '[TelegramService]: Error processing user prompt',
          );
          this.sendMessageSafe(
            chatId,
            TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
          );
        },
      );
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
      this.sendMessageSafe(msg.chat.id, TELEGRAM_MESSAGES.INPUT_MIN_LENGTH);
    });
    this.bot.onText(/.{1001,}/, (msg) => {
      this.sendMessageSafe(msg.chat.id, TELEGRAM_MESSAGES.INPUT_MAX_LENGTH);
    });

    this.bot.on('message', (msg) => {
      const user = msg.from!;
      if (this.registrationSteps.get(user?.id!) === 'phone' && msg.contact) {
        this.checkUserRegistration({
          user,
          chatId: msg.chat.id,
          userPrompt: msg.contact.phone_number,
        });
        return;
      }
      !msg.text &&
        this.sendMessageSafe(msg.chat.id, TELEGRAM_MESSAGES.ONLY_TEXT_SUPPORT);
    });

    this.bot.on('error', (error) => {
      Logger.error(error, '[TelegramService]: Error in bot');
    });
  }

  // === ====================================== METHODS ==================================================== ===
  private runGuards = async (props: {
    user: TelegramBot.User;
    chatId: number;
    userPrompt: string;
  }) => {
    const { user, chatId, userPrompt } = props;
    if (!userPrompt) {
      this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ONLY_TEXT_INPUT);
      return false;
    }

    const isUserRegistered = await this.checkUserRegistration(props);
    if (!isUserRegistered) return false;

    if (this.runIdsByChatId.has(chatId)) {
      this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.WAIT_FOR_PREVIOUS_REQUEST);
      return false;
    }

    if (user.is_bot) {
      this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.BOTS_NOT_SUPPORTED);
      return false;
    }

    const hasLimitReached = await this.dbService.checkUserLimitReached(user.id);

    if (hasLimitReached) {
      this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.LIMIT_REACHED);
      return false;
    }

    return true;
  };

  private checkUserRegistration = async (props: {
    user: TelegramBot.User;
    chatId: number;
    userPrompt: string;
  }) => {
    try {
      const { user, chatId } = props;
      await this.saveUserRegistrationData(props);

      const { firstName, lastName } =
        await this.dbService.checkUserInfoCompleteness(user.id);

      if (!firstName) {
        this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ENTER_FIRST_NAME);
        this.registrationSteps.set(user.id, ERegistrationSteps.FIRST_NAME);
        return false;
      }

      if (!lastName) {
        this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ENTER_LAST_NAME);
        this.registrationSteps.set(user.id, ERegistrationSteps.LAST_NAME);
        return false;
      }

      // if (!phone) {
      //   this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ENTER_PHONE);
      //   this.registrationSteps.set(user.id, ERegistrationSteps.PHONE);
      //   return false;
      // }

      const hadRegistrationStep = this.registrationSteps.delete(user.id);
      if (hadRegistrationStep) {
        this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.REGISTRATION_SUCCESS);
        this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.START_MESSAGE, {
          parse_mode: 'HTML',
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(
        error,
        '[TelegramService]: Error checking user registration',
      );
      return false;
    }
  };

  private saveUserRegistrationData = async ({
    user,
    chatId,
    userPrompt,
  }: {
    user: TelegramBot.User;
    chatId: number;
    userPrompt: string;
  }) => {
    const registrationStep = this.registrationSteps.get(user.id);
    if (!registrationStep) return;

    switch (registrationStep) {
      case ERegistrationSteps.FIRST_NAME:
        await this.dbService.upsertUserByTelegramId(user, {
          chatId,
          enteredFirstName: userPrompt.slice(0, 50),
        });
        break;
      case ERegistrationSteps.LAST_NAME:
        await this.dbService.upsertUserByTelegramId(user, {
          chatId,
          enteredLastName: userPrompt.slice(0, 50),
        });
        break;
      case ERegistrationSteps.PHONE:
        const formattedPhoneNumber = formatPhoneNumber(userPrompt);
        const isValidPhone = validatePhoneNumber(formattedPhoneNumber);
        if (!isValidPhone) {
          this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ENTER_VALID_PHONE);
          return false;
        }
        await this.dbService.upsertUserByTelegramId(user, {
          chatId,
          phoneNumber: `+${formattedPhoneNumber}`,
        });
        break;
    }
  };

  sendMessageSafe: ITelegramService['sendMessageSafe'] = async (
    chatId,
    text,
    options,
  ) => {
    return this.bot.sendMessage(chatId, text, options).catch((error) => {
      Logger.error(error, '[TelegramService]: Error sending message');
    });
  };

  handleNewUser: ITelegramService['handleNewUser'] = async ({
    user,
    chatId,
  }) => {
    try {
      const dbUser = await this.dbService.getUserByTelegramId(user.id);

      if (!dbUser) {
        const createdUser = await this.dbService.upsertUserByTelegramId(user, {
          chatId,
        });
        createdUser && Logger.info(createdUser.username, '[NEW_USER]:');
      }
    } catch (err) {
      Logger.error(err, '[TelegramService]: Error handling new user');
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

    this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.TAKEN_INTO_PROCESSING);

    const process = (run: Run, retryCount: number = 0) =>
      this.openAIService.processRun({
        run,
        onSuccess: (resolvedRun) => {
          return this.onRunSuccess({
            resolvedRun,
            user,
            chatId,
            threadId: threadId!,
            messageId: message.id,
          });
        },
        onFailure: async (run) => {
          return this.onRunFailure({
            run,
            chatId,
            retryCount,
            retryCb: process,
          });
        },
        onTimeout: async (run) => {
          return this.onRunTimeout({
            run,
            chatId,
            retryCount,
            retryCb: process,
          });
        },
      });

    return process(run);
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
    Logger.error(run, '[TelegramService]: Error processing run');

    if (retryCount < 3 && run.last_error?.code === 'rate_limit_exceeded') {
      this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.RATE_LIMIT_EXCEEDED);
      await wait(60_000); // TODO: Get time from headers when openAI adds to assistants' API
      const newRun = await this.openAIService.createRun(run.thread_id);
      this.runIdsByChatId.set(chatId, newRun.id);
      retryCb(newRun, retryCount);
    }

    this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST);
  };

  onRunTimeout: ITelegramService['onRunTimeout'] = async ({
    run,
    chatId,
    retryCount,
    retryCb,
  }) => {
    Logger.info(run, '[On Timeout]');
    if (retryCount > 0) {
      this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST);
      return;
    }

    this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.PROCESSING_TIMEOUT);
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
    this.dbService.upsertUserByTelegramId(user, { chatId });
    this.dbService.upsertThread({ id: threadId, chatId, userTgId: user.id });
  };

  sendMessages: ITelegramService['sendMessages'] = async (chatId, messages) => {
    for (const message of messages) {
      await this.sendMessageSafe(chatId, message, { parse_mode: 'HTML' });
    }
    await this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.BOT_MAKES_MISTAKES);
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
      await this.handleNewUser({ user, chatId });

      const isRegistered = await this.checkUserRegistration({
        user,
        chatId,
        userPrompt: '',
      });
      if (!isRegistered) return;

      return this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.START_MESSAGE, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      Logger.error(err, '[TelegramService]: Error handling Start command');
      return this.sendMessageSafe(
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
      return this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.NEW_THREAD, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      Logger.error(err, '[TelegramService]: Error handling New Thread command');
      return this.sendMessageSafe(
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
      return this.sendMessageSafe(
        chatId,
        TELEGRAM_MESSAGES.CHECK_LIMIT.replace(
          '__limit__',
          limit.toLocaleString('ru-RU'),
        ),
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      Logger.error(
        err,
        '[TelegramService]: Error handling Check Limit command',
      );
      return this.sendMessageSafe(
        chatId,
        TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
      );
    }
  };

  onHelpCommand: ITelegramService['onHelpCommand'] = async ({ chatId }) => {
    try {
      return this.sendMessageSafe(chatId, TELEGRAM_MESSAGES.HELP, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      Logger.error(err, '[TelegramService]: Error handling Help command');
      return this.sendMessageSafe(
        chatId,
        TELEGRAM_MESSAGES.ERROR_PROCESSING_REQUEST,
      );
    }
  };
}

import TelegramBot from 'node-telegram-bot-api';
import { appConfig } from '@src/config/app.config';
import { openai } from '@src/config/openAI.config';
import { TELEGRAM_MESSAGES } from '@src/config/defaults.config';
import {
  cancelRun,
  createRun,
  onRunSuccess,
  processRun,
} from '@src/utils/openAI.utils';
import { Run } from '@src/types/openAI.types';
import { wait } from '@src/utils/async.utils';

export const bot = new TelegramBot(appConfig.telegramBotToken, {
  polling: true,
});

const EMOJI_REGEX =
  /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const threadIdsByChatId = new Map<number, string>();
const runIdsByChatId = new Map<number, string>();

export const initTelegramBot = () => {
  bot.onText(/^.{2,1000}$/, async ({ text, chat }) => {
    const chatId = chat.id;
    const userPrompt = formatInputText(text!);
    let threadId = threadIdsByChatId.get(chatId);

    if (!userPrompt) {
      return bot.sendMessage(chatId, TELEGRAM_MESSAGES.ONLY_TEXT_INPUT);
    }

    if (runIdsByChatId.has(chatId))
      return bot.sendMessage(
        chatId,
        TELEGRAM_MESSAGES.WAIT_FOR_PREVIOUS_REQUEST,
      );

    if (userPrompt === '/start' || !threadId) {
      const thread = await openai.beta.threads.create();
      threadIdsByChatId.set(chatId, thread.id);
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
        onSuccess: (resolvedRun) =>
          onRunSuccess({
            run: resolvedRun,
            messageId: message.id,
            callback: async (messages) => {
              await sendMessages(chatId, messages);
              runIdsByChatId.delete(chatId);
            },
          }),
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
};

// === ================================================================================== ===
const sendMessages = async (chatId: number, messages: string[]) => {
  for (const message of messages) {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }
};

// === ================================================================================== ===
const formatInputText = (text: string) => {
  return text.replace(EMOJI_REGEX, '').trim();
};

import TelegramBot from 'node-telegram-bot-api';
import { appConfig } from '@src/config/app.config';
import { openai } from '@src/config/openAI.config';
import { onRunSuccess, processRun } from '@src/utils/openAI.utils';

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
      return bot.sendMessage(chatId, 'Запрос может содержать только текст.');
    }

    // bot.sendMessage(chatId, `Запрос принят. В обработке..._test_`, {
    //   parse_mode: 'Markdown',
    // });
    // if (!threadId) return;

    if (runIdsByChatId.has(chatId))
      return bot.sendMessage(
        chatId,
        'Подождите, пока предыдущий запрос обработается',
      );

    if (userPrompt === '/start' || !threadId) {
      const thread = await openai.beta.threads.create();
      threadIdsByChatId.set(chatId, thread.id);
      threadId = thread.id;
    }

    const userMessage = await openai.beta.threads.messages.create(threadId, {
      content: userPrompt,
      role: 'user',
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: appConfig.openAIAssistantId,
    });

    runIdsByChatId.set(chatId, run.id);

    bot.sendMessage(chatId, `Запрос принят. В обработке...`);

    processRun({
      run,
      onSuccess: (resolvedRun) =>
        onRunSuccess({
          run: resolvedRun,
          messageId: userMessage.id,
          callback: async (messages) => {
            await sendMessages(chatId, messages);
            runIdsByChatId.delete(chatId);
          },
        }),
      onFailure: (run) => {
        console.error('[On Failure]:', run);
        openai.beta.threads.runs.cancel(run.thread_id, run.id);
        bot.sendMessage(chatId, `Ошибка обработки запроса. Попробуйте еще раз`);
      },
    });
  });

  bot.onText(/^.$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Запрос должен содержать не менее 1 символа');
  });
  bot.onText(/.{1001,}/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      'Запрос должен содержать не более 1000 символов',
    );
  });

  bot.on('message', (msg) => {
    !msg.text &&
      bot.sendMessage(
        msg.chat.id,
        `На данный момент поддерживаются только текстовые сообщения`,
      );
  });
};

// === ================================================================================== ===
const sendMessages = async (chatId: number, messages: string[]) => {
  for (const message of messages) {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
};

// === ================================================================================== ===
const formatInputText = (text: string) => {
  return text.replace(EMOJI_REGEX, '').trim();
};

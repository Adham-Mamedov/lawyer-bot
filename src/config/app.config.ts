import { AppConfig } from '@src/types/config.types';

export const appConfig: AppConfig = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  openAiKey: process.env.OPEN_AI_API_KEY || '',
  openAIAssistantId: process.env.OPEN_AI_ASSISTANT_ID || '',
  isDev: process.env.NODE_ENV === 'development',
};

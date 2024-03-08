import OpenAI from 'openai';
import { appConfig } from '@src/config/app.config';

const FIVE_MINUTES = 5 * 60 * 1000;
export const openai = new OpenAI({
  apiKey: appConfig.openAiKey,
  timeout: FIVE_MINUTES,
});

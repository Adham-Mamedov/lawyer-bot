import OpenAI from 'openai';
import {appConfig} from '@src/config/app.config';

const TEN_MINUTES = 10 * 60 * 1000;
export const openai = new OpenAI({
  apiKey: appConfig.openAiKey,
  timeout: TEN_MINUTES,
});

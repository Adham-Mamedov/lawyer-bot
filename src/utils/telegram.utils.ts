import { EMOJI_REGEX } from '@src/config/defaults.config';

export const formatInputText = (text: string) => {
  return text.replace(EMOJI_REGEX, '').trim();
};

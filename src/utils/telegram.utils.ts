import { EMOJI_REGEX } from '@src/config/defaults.config';

export const formatInputText = (text: string) => {
  return text.replace(EMOJI_REGEX, '').trim();
};

export const formatPhoneNumber = (phone: string) => {
  let normalizedPhone = phone.replace(/[\s-()]/g, '').replace(/^\+?998/, '998');

  if (normalizedPhone.length === 9 && !normalizedPhone.startsWith('998')) {
    normalizedPhone = `998${normalizedPhone}`;
  }
  return normalizedPhone;
};

export const validatePhoneNumber = (phone: string) => {
  const regex = /^998\d{2}\d{3}\d{4}$/;
  return regex.test(phone);
};

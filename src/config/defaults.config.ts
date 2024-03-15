export const TELEGRAM_MESSAGES = {
  ONLY_TEXT_INPUT: 'Запрос может содержать только текст.',
  ONLY_TEXT_SUPPORT:
    'На данный момент поддерживаются только текстовые сообщения',
  INPUT_MIN_LENGTH: 'Запрос должен содержать не менее 1 символа',
  INPUT_MAX_LENGTH: 'Запрос должен содержать не более 1000 символов',
  WAIT_FOR_PREVIOUS_REQUEST: 'Подождите, пока предыдущий запрос обработается',
  TAKEN_INTO_PROCESSING: 'Запрос принят. В обработке...',
  ERROR_PROCESSING_REQUEST: 'Ошибка обработки запроса. Попробуйте еще раз',
  PROCESSING_TIMEOUT:
    'Это займет чуть больше времени, чем обычно. Подождите пожалуйста...',
  RATE_LIMIT_EXCEEDED:
    'Это займет чуть больше времени, чем обычно. Подождите пожалуйста...',
} as const;

export const MAX_TG_MESSAGE_LENGTH = 3600;

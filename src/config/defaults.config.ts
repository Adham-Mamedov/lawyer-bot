const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export const MAX_TG_MESSAGE_LENGTH = 3600;

export const TOKENS_PER_DAY_LIMIT = 100_000;
export const MIN_TOKENS_FOR_REQUEST = 2000;

export const THREAD_EXPIRATION_TIME = SEVEN_DAYS;

export const EMOJI_REGEX =
  /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

//TODO: adjust string length to fit in phone screen
// === ================================================================================== ===
const START_MESSAGE = `🌟 <b>Добро пожаловать в Юридического Консультанта!</b> 🌟

Вас приветствует ваш помощник по трудовому праву! Задавайте ваши вопросы прямо здесь, и получайте квалифицированные ответы.

✅ <b>Ваши возможности:</b>

🟢 <b>Бесплатные юридические консультации.</b>
🟢 <b>До 7 вопросов в день — ваши токены обновляются в полночь.</b>

📝 <b>Начнём?</b>

🟢 <b>Задайте ваш вопрос</b> в одном сообщении, чтобы максимально эффективно использовать токены.
🟢 Узнайте <b>остаток токенов</b> с помощью команды <b>/my_limit</b>.
🟢 Для начала новой беседы отправьте <b>/new</b>.

👉 <b>Готовы? Задайте ваш первый вопрос!</b> 🚀`;

// === ================================================================================== ===

const HELP_MESSAGE = `🎉 <b>Добро пожаловать в бота для юридических консультаций!</b> 🎉

На данный момент наш бот специализируется на вопросах, связанных с <b>трудовым кодексом</b>.

💡 <b>Как это работает?</b>

🟢 Вам доступно <b>100,000 токенов</b> в день, что соответствует примерно 5-7 вопросам.
🟢 Постарайтесь формулировать ваш вопрос максимально конкретно и вместительно в одно сообщение.
🟢 <b>Обновление токенов</b> происходит автоматически <b>каждый день в 00:00</b>.

🔍 <b>Управление вашими токенами:</b>

Чтобы узнать, сколько токенов осталось на сегодня, отправьте команду <b>/my_limit</b>.
Если вы хотите начать беседу заново и забыть предыдущие сообщения, используйте <b>/new</b>.

✨ Этот бот <b>абсолютно бесплатный</b> и создан для того, чтобы помочь с юридическими консультациям в области трудового права.

Мы готовы помочь вам сейчас! Просто задайте свой вопрос. 🚀`;

// === ================================================================================== ===

const CHECK_LIMIT_MESSAGE = `
✨ <b>Ваш текущий баланс токенов</b> ✨

На данный момент у вас осталось <b>__limit__</b> токенов. Ваши токены будут автоматически пополнены до 100,000 в 00:00.`;

// === ================================================================================== ===

const NEW_THREAD_MESSAGE = `🔄 <b>Начинаем новую беседу!</b>

Ваша история вопросов была очищена. Теперь вы можете задать новый вопрос.`;

export const TELEGRAM_MESSAGES = {
  START_MESSAGE: START_MESSAGE,
  CHECK_LIMIT: CHECK_LIMIT_MESSAGE,
  NEW_THREAD: NEW_THREAD_MESSAGE,
  HELP: HELP_MESSAGE,
  BOTS_NOT_SUPPORTED:
    'Бот не поддерживает обработку сообщений от других ботов.',
  ONLY_TEXT_INPUT: 'Запрос может содержать только текст.',
  ONLY_TEXT_SUPPORT:
    'На данный момент поддерживаются только текстовые сообщения',
  INPUT_MIN_LENGTH: 'Запрос должен содержать не менее 1 символа',
  INPUT_MAX_LENGTH: 'Запрос должен содержать не более 1000 символов',
  LIMIT_REACHED: `К сожалению, вы достигли лимита. Этот бот бесплатный, поэтому вы можете использовать лишь ${TOKENS_PER_DAY_LIMIT.toLocaleString('ru-RU')} токенов (5-6 вопросов) в день. Спасибо за понимание! Возвращайтесь завтра)`,
  WAIT_FOR_PREVIOUS_REQUEST: 'Подождите, пока предыдущий запрос обработается',
  TAKEN_INTO_PROCESSING: 'Запрос принят. В обработке...',
  ERROR_PROCESSING_REQUEST: 'Ошибка обработки запроса. Попробуйте еще раз',
  PROCESSING_TIMEOUT:
    'Это займет чуть больше времени, чем обычно. Подождите пожалуйста...',
  RATE_LIMIT_EXCEEDED:
    'Это займет чуть больше времени, чем обычно. Подождите пожалуйста...',
  BOT_MAKES_MISTAKES:
    'Бот может допускать ошибки. Пожалуйста, проверяйте важную информацию.',
} as const;

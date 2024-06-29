import { ThreadMessage, ThreadMessagesPage } from '../types/openAI.types';
import { MAX_TG_MESSAGE_LENGTH } from '@src/config/defaults.config';

export const openAIMessagesPageToTelegramMessages = (
  messages: ThreadMessagesPage,
) => {
  return messages.data.flatMap((message) => {
    if (message.role !== 'assistant') return [];
    return openAIMessageToTelegramMessages(message);
  });
};

export const openAIMessageToTelegramMessages = (message: ThreadMessage) => {
  return message.content
    .flatMap<string>((content) => {
      if (content.type !== 'text') return '';
      let textWithCitations = content.text.value;
      content.text.annotations.forEach((annotation) => {
        if (annotation.type !== 'file_citation') return;
        textWithCitations = textWithCitations.replaceAll(
          annotation.text,
          '', // TODO: add citation when openAI adds it to response
          // annotation.text
          //   ? `<pre>${annotation.file_citation.quote.trim()}</pre>`
          //   : '',
        );
      });

      return splitMessages(textWithCitations, MAX_TG_MESSAGE_LENGTH).filter(
        (text) => text !== '.',
      );
    })
    .filter(Boolean);
};

const splitByAnnotations = (text: string, maxLength: number): string[] => {
  const indexOfFirstQuote = text.indexOf('<pre>');
  if (indexOfFirstQuote === -1) return [text];

  const messages = [text.slice(0, indexOfFirstQuote)];
  let i = indexOfFirstQuote;
  let hasOpenQuote = true;

  while (i < text.length) {
    const searchQuery = hasOpenQuote ? '</pre>' : '<pre>';
    const searchShift = hasOpenQuote ? 5 : 0;

    const nextQuote = text.indexOf(searchQuery, i + searchShift);
    if (nextQuote === -1) {
      messages.push(text.slice(i));
      break;
    }

    const sliceShift = hasOpenQuote ? 6 : 0;
    messages.push(text.slice(i, nextQuote + sliceShift));

    i = nextQuote + sliceShift;
    hasOpenQuote = !hasOpenQuote;
  }
  return splitByLength(messages, maxLength, {
    startSymbol: '<pre>',
    endSymbol: '</pre>',
  });
};

const splitMessages = (message: string, maxLength: number): string[] => {
  if (message.length <= maxLength) return [message];

  const messages = splitByAnnotations(message, maxLength);

  return splitByLength(messages, maxLength);
};

const splitByLength = (
  messages: string[],
  maxLength: number,
  symbols?: { startSymbol: string; endSymbol: string },
): string[] => {
  const { startSymbol, endSymbol } = symbols || {
    startSymbol: '',
    endSymbol: '',
  };
  const maxLengthWithSymbols =
    maxLength - startSymbol.length - endSymbol.length;
  return messages.flatMap<string>((text) => {
    if (text.length <= maxLength) return text;

    const texts = [];
    let i = 0;
    while (i < text.length) {
      let slicedText = text.slice(i, i + maxLengthWithSymbols);
      if (!slicedText.startsWith(startSymbol)) {
        slicedText = startSymbol + slicedText;
      }
      if (!slicedText.endsWith(endSymbol)) {
        slicedText += endSymbol;
      }
      texts.push(slicedText);
      i += maxLengthWithSymbols;
    }
    return texts;
  });
};

import { ThreadMessage, ThreadMessagesPage } from '../types/openAI.types';

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
    .map((content) => {
      if (content.type !== 'text') return;
      let textWithCitations = content.text.value;
      content.text.annotations.forEach((annotation) => {
        if (annotation.type !== 'file_citation') return;
        textWithCitations = textWithCitations.replaceAll(
          annotation.text,
          annotation.file_citation?.quote
            ? `\`\`\`${annotation.file_citation.quote.trim()}\`\`\``
            : '',
        );
      });

      return textWithCitations;
    })
    .filter(Boolean);
};

import { TelegramService } from '@src/services/telegram.service';

import { HEALTH_PING_INTERVAL } from '@src/config/defaults.config';

import { INotificationService } from '@src/types/notification.types';
import { ITelegramService } from '@src/types/telegram.types';

export class TelegramNotificationService implements INotificationService {
  private readonly telegramService: ITelegramService;
  private healthPingTimeout?: NodeJS.Timeout;
  private lastHealthPingMessageId?: number;

  constructor(private notifierChatId: string) {
    this.telegramService = TelegramService.getInstance();
  }

  onNewUser: INotificationService['onNewUser'] = (user) => {
    this.telegramService.sendMessageSafe(
      this.notifierChatId,
      `New User: ${JSON.stringify({ username: user.username, first_name: user.first_name })}`,
    );
  };

  healthPing: INotificationService['healthPing'] = () => {
    if (!this.notifierChatId || this.healthPingTimeout) return;

    this.healthPingTimeout = setInterval(async () => {
      if (this.lastHealthPingMessageId) {
        this.telegramService.deleteMessageSafe(
          this.notifierChatId,
          this.lastHealthPingMessageId,
        );
      }
      const message = await this.telegramService.sendMessageSafe(
        this.notifierChatId,
        'Telegram bot is running',
      );
      if (!message) return;
      this.lastHealthPingMessageId = message.message_id;
    }, HEALTH_PING_INTERVAL);
  };

  onError: INotificationService['onError'] = (error) => {
    this.telegramService.sendMessageSafe(
      this.notifierChatId,
      `Error: ${error}`,
    );
  };
}

import { INotificationService } from '@src/types/notification.types';
import { ITelegramService } from '@src/types/telegram.types';
import { TelegramService } from '@src/services/telegram.service';
import { HEALTH_PING_INTERVAL } from '@src/config/defaults.config';

export class TelegramNotificationService implements INotificationService {
  private readonly telegramService: ITelegramService;
  private healthPingTimeout?: NodeJS.Timeout;

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

    this.healthPingTimeout = setInterval(() => {
      this.telegramService.sendMessageSafe(
        this.notifierChatId,
        'Telegram bot is running',
      );
    }, HEALTH_PING_INTERVAL);
  };

  onError: INotificationService['onError'] = (error) => {
    this.telegramService.sendMessageSafe(
      this.notifierChatId,
      `Error: ${error}`,
    );
  };
}

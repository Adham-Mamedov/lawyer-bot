import 'dotenv/config';
import '@total-typescript/ts-reset';
import fastify from 'fastify';
import { registerAPIRoutes } from '@src/routes';
import { validateEnv } from '@src/utils/app.utils';
import { TelegramService } from '@src/services/telegram.service';
import { appConfig } from '@src/config/app.config';

const server = fastify({
  logger: {
    level: 'info',
    customLevels: ['error'],
  },
});

export const Logger = {
  info: (message: unknown, scope?: string) => {
    server.log.info({
      type: 'INFO',
      scope,
      message,
    });
  },
  error: (message: unknown, scope?: string) => {
    server.log.error({
      type: 'ERROR',
      scope,
      message,
    });
  },
};

if (appConfig.isDev) {
  registerAPIRoutes(server);
}

const runServer = () => {
  validateEnv();
  server.listen({ port: 3000 }, (err: Error | null) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
};

const telegramService = TelegramService.getInstance();

runServer();
telegramService.init();

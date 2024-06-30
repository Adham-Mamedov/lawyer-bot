import 'dotenv/config';
import '@total-typescript/ts-reset';
import fastify from 'fastify';
import { registerAPIRoutes } from '@src/routes';
import { validateEnv } from '@src/utils/app.utils';
import { TelegramService } from '@src/services/telegram.service';
import { appConfig } from '@src/config/app.config';
import { PrismaService } from '@src/services/prisma.service';

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
  const dbService = PrismaService.getInstance();
  dbService.createCustomIndexes();
  server.route({
    url: '/',
    method: 'GET',
    handler: async () => {
      return { status: 'ok' };
    },
  });

  server.listen({ port: 3000 }, (err: Error | null) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });

  Logger.info(`Server running in ${process.env.NODE_ENV} mode`, 'Server');
};

const telegramService = TelegramService.getInstance();

runServer();
telegramService.init();

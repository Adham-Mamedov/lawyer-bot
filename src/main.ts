import 'dotenv/config';
import '@total-typescript/ts-reset';
import fastify from 'fastify';
import { registerRoutes } from '@src/routes';
import { initTelegramBot } from '@src/utils/telegram.utils';
import { validateEnv } from '@src/utils/app.utils';

const server = fastify({
  logger: true,
});

registerRoutes(server);

const runServer = () => {
  validateEnv();
  server.listen({ port: 3000 }, (err: Error | null) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
};

runServer();
initTelegramBot();

import { FastifyInstance } from 'fastify';

import assistantRoutes from './assistants';
import fileRoutes from './files';

const routes = { ...fileRoutes, ...assistantRoutes };

export const registerAPIRoutes = (server: FastifyInstance) => {
  Object.values(routes).forEach((route) => {
    server.route(route);
  });
};

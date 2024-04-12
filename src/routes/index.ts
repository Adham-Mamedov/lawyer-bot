import fileRoutes from './files';
import assistantRoutes from './assistants';
import { FastifyInstance } from 'fastify';

const routes = { ...fileRoutes, ...assistantRoutes };

export const registerAPIRoutes = (server: FastifyInstance) => {
  Object.values(routes).forEach((route) => {
    server.route(route);
  });
};

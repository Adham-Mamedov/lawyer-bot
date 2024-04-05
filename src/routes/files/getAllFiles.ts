import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { OpenAIService } from '@src/services/openAI.service';
import { Logger } from '@src/main';

const openAIService = OpenAIService.getInstance();

export const getAllFilesRoute: RouteOptions = {
  method: 'GET' as HTTPMethods,
  url: '/files',
  schema: {
    response: {
      200: {
        type: 'array',
      },
    },
  },
  handler: async function (_request: FastifyRequest, reply: FastifyReply) {
    try {
      const res = await openAIService.getAllFiles({ purpose: 'assistants' });
      const files = res?.data || [];
      reply.send(files);
    } catch (error) {
      Logger.error(error, 'getAllFilesRoute');
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { openai } from '@src/config/openAI.config';

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
      const res = await openai.files.list({ purpose: 'assistants' });
      const files = res.data || [];
      reply.send(files);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

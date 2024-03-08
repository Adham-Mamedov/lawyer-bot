import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { openai } from '@src/config/openAI.config';

export const getAllAssistantsRoute: RouteOptions = {
  method: 'GET' as HTTPMethods,
  url: '/assistants',
  schema: {
    response: {
      200: {
        type: 'array',
      },
    },
  },
  handler: async function (_request: FastifyRequest, reply: FastifyReply) {
    try {
      const res = await openai.beta.assistants.list();
      const assistants = res.data || [];
      reply.send(assistants);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

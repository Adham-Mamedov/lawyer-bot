import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { OpenAIService } from '@src/services/openAI.service';

const openAIService = OpenAIService.getInstance();

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
      const res = await openAIService.getAllAssistants();
      const assistants = res?.data || [];
      reply.send(assistants);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

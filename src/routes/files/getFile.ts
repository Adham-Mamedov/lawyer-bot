import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { APIError } from 'openai';
import { OpenAIService } from '@src/services/openAI.service';

const openAIService = OpenAIService.getInstance();

export const getFileRoute: RouteOptions = {
  method: 'GET' as HTTPMethods,
  url: '/files/:id',
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          object: { type: 'string' },
          id: { type: 'string' },
          purpose: { type: 'string', enum: ['assistant', 'fine-tuning'] },
          filename: { type: 'string' },
          bytes: { type: 'number' },
          created_at: { type: 'number' },
          status: { type: 'string' },
          status_details: { type: 'object', nullable: true },
        },
      },
    },
  },
  handler: async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const file = await openAIService.getFileById(id);
      reply.send(file);
    } catch (error) {
      if (error instanceof APIError) {
        return reply.status(error.status || 500).send({ error: error.message }); // TODO: error.message can contain sensitive info!
      }
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

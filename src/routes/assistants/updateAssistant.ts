import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { openai } from '@src/config/openAI.config';
import { IAssistantWithRetrievalUpdateDTO } from '@src/types/assistant.types';

export const updateAssistantRoute: RouteOptions = {
  method: 'PUT' as HTTPMethods,
  url: '/assistants/:id',
  schema: {
    params: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
      },
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        model: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        instructions: { type: 'string', nullable: true },
        tools: { type: 'array', nullable: true },
        file_ids: { type: 'array', nullable: true },
        metadata: { type: 'object', nullable: true },
      },
    },
    response: {
      201: {
        type: 'object',
      },
    },
  },
  handler: async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const assistantDTO = request.body as IAssistantWithRetrievalUpdateDTO;
      const assistant = await openai.beta.assistants.update(id, assistantDTO);
      reply.send(assistant);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

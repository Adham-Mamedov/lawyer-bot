import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { OpenAIService } from '@src/services/openAI.service';
import { AssistantUpdateParams } from '@src/types/openAI.types';
import { Logger } from '@src/main';

const openAIService = OpenAIService.getInstance();

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
      const assistantDTO = request.body as AssistantUpdateParams;
      const assistant = await openAIService.updateAssistant(id, assistantDTO);
      reply.send(assistant);
    } catch (error) {
      Logger.error(error, 'updateAssistantRoute');
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

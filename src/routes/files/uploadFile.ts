import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import fs from 'fs';
import { getDatasetPath } from '@src/utils/dataset.utils';
import { OpenAIService } from '@src/services/openAI.service';

const openAIService = OpenAIService.getInstance();

export const uploadFileRoute: RouteOptions = {
  method: 'POST' as HTTPMethods,
  url: '/files/upload/:fileName',
  schema: {
    params: {
      type: 'object',
      properties: {
        fileName: { type: 'string', minLength: 2 },
      },
      required: ['fileName'],
    },
    response: {
      201: {
        type: 'array',
      },
    },
  },
  handler: async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const { fileName } = request.params as { fileName: string };
      const res = await openAIService.createFile({
        file: fs.createReadStream(getDatasetPath(fileName)),
        purpose: 'assistants',
      });

      reply.send(res);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  },
};

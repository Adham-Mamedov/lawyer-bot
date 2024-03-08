import {
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RouteOptions,
} from 'fastify';
import { openai } from '@src/config/openAI.config';
import fs from 'fs';
import { getDatasetPath } from '@src/utils/dataset.utils';

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
      const res = await openai.files.create({
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

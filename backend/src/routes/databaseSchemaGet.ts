import { existsSync, readFileSync } from 'node:fs';

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

interface RegisterOptions {
  schemaSvgPath?: string;
  preHandler?: preHandlerHookHandler;
}

/**
 * Register `GET /schema` — serve a hand-crafted database schema SVG diagram.
 *
 * Returns 404 when no `schemaSvgPath` is configured or the file does not
 * exist; the React component handles 404 gracefully and hides the diagram
 * panel, so consumers can omit the option entirely.
 * @param fastify - Fastify instance.
 * @param options - Optional path to the SVG file and auth pre-handler.
 */
export function registerDatabaseSchemaGet(
  fastify: FastifyInstance,
  options: RegisterOptions,
): void {
  const { schemaSvgPath, preHandler } = options;

  fastify.get('/schema', { preHandler }, (_request, reply) => {
    if (!schemaSvgPath || !existsSync(schemaSvgPath)) {
      return reply.status(404).send({ error: 'Schema diagram not found' });
    }
    const svg = readFileSync(schemaSvgPath, 'utf8');
    return reply.type('image/svg+xml').send(svg);
  });
}

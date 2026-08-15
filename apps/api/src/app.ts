import cors from '@fastify/cors';
import Fastify from 'fastify';
import { BrowserStopError } from '@signal-room/browser-ego';
import { objectiveSchema, reviewStatusSchema } from '@signal-room/domain';
import { z } from 'zod';
import { IntakeError, type SignalRoomService } from './service.js';

const inputBody = z.object({ input: z.string().min(1) });
const projectBody = z.object({
  contentId: z.uuid(),
  objective: objectiveSchema,
  researchQuestion: z.string().min(1).optional(),
});
const reviewBody = z.object({
  nextStatus: reviewStatusSchema.exclude(['machine_draft']),
  nextStatement: z.string().min(1).optional(),
  reason: z.string().min(1),
  actor: z.string().min(1).default('local_user'),
});

export function buildApp(service: SignalRoomService) {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof BrowserStopError) {
      return reply.status(409).send({
        error: error.reason,
        message: error.message,
        recoveryAction: error.recoveryAction,
        hardStop: true,
      });
    }
    if (error instanceof IntakeError) {
      return reply
        .status(400)
        .send({ error: error.code, message: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply
        .status(400)
        .send({ error: 'invalid_request', issues: error.issues });
    }
    return reply.status(500).send({
      error: 'internal_error',
      message:
        error instanceof Error ? error.message : 'Unknown internal error',
    });
  });

  app.post('/api/intake/inspect', async (request) => {
    const { input } = inputBody.parse(request.body);
    return service.inspectInput(input);
  });

  app.post('/api/intake/resolve', async (request) => {
    const { input } = inputBody.parse(request.body);
    return service.resolveAndCollect(input);
  });

  app.post('/api/projects', async (request, reply) => {
    const project = service.createProject(projectBody.parse(request.body));
    return reply.status(201).send(project);
  });

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (request, reply) => {
      const project = service.getProject(request.params.id);
      return project
        ? project
        : reply.status(404).send({ error: 'project_not_found' });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/runs',
    async (request, reply) => {
      return reply.status(202).send(service.startRun(request.params.id));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/runs/:id/events',
    async (request, reply) => {
      const run = service.getRun(request.params.id);
      if (!run) return reply.status(404).send({ error: 'run_not_found' });
      reply.header('content-type', 'text/event-stream; charset=utf-8');
      return `event: progress\ndata: ${JSON.stringify({ status: run.status, checkpoint: run.checkpoint })}\n\n`;
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/content/:id/evidence',
    async (request) => {
      return { items: service.getEvidence(request.params.id) };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/findings/:id/reviews',
    async (request) => {
      return service.reviewFinding({
        findingId: request.params.id,
        ...reviewBody.parse(request.body),
      });
    },
  );

  return app;
}

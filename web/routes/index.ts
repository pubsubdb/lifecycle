import { FastifyInstance } from 'fastify';
import { Params, Query, Body } from '../../types/http';
import { PubSubDB } from '@pubsubdb/pubsubdb';
import {
  JobData,
  JobStatsInput,
  RollCallMessage } from '@pubsubdb/pubsubdb/build/types';

export const registerAppRoutes = (server: FastifyInstance, pubSubDB: PubSubDB) => {

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/pub/:topic', async (request, reply) => {
    return await pubSubDB.pub(request.params.topic, request.body);
  });

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/pubsub/:topic', async (request, reply) => {
    const delay = (request.query as Query).timeout;
    const delayMS = parseInt(delay) || undefined;
    return await pubSubDB.pubsub(request.params.topic, request.body, delayMS);
  });

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/quorum/actions/deploy/:app/:version', async (request, reply) => {
    return await pubSubDB.deploy(`/app/pubsubdb/apps/${request.params.app}/v${request.params.version}/pubsubdb.yaml`);
  });

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/quorum/actions/activate/:app/:version', async (request, reply) => {
    return await pubSubDB.activate(request.params.version);
  });

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/quorum/actions/throttle', async (request, reply) => {
    return await pubSubDB.quorum.pub({
      type: 'throttle',
      throttle: parseInt(request.body.throttle),
      guid: request.body.guid === '$self' ? pubSubDB.guid : request.body.guid,
      topic: request.body.topic,
    });
  });

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/quorum/actions/rollcall', async (request, reply) => {
    const payload: RollCallMessage = {
      type: 'rollcall',
      guid: request.body.guid === '$self' ? pubSubDB.guid : request.body.guid,
      topic: request.body.topic,
    };
    if (request.body.guid === '$self') {
      request.body.topic == pubSubDB.guid;
    }
    if (request.body.guid) {
      payload.guid = request.body.guid;
    }
    if (request.body.topic) {
      payload.topic = request.body.topic;
    }
    return await pubSubDB.quorum.pub(payload);
  });

  server.post<{ Params: Params; Body: Body }>('/v1/stats/general/:topic', async (request, reply) => {
    const jobStats: JobStatsInput = {
      data: request.body.data as unknown as Record<string, unknown>,
      start: request.body.start,
      end: request.body.end,
      range: request.body.range,
    }
    return await pubSubDB.getStats(request.params.topic, jobStats);
  });

  server.post<{ Params: Params; Body: Body }>('/v1/stats/index/:topic', async (request, reply) => {
    const jobStats: JobStatsInput = {
      data: request.body.data as unknown as Record<string, unknown>,
      start: request.body.start,
      end: request.body.end,
      range: request.body.range,
    }
    return await pubSubDB.getIds(request.params.topic, jobStats, request.body.facets as unknown as string[]);
  });

  server.post<{ Params: Params; Body: Body }>('/v1/actions/hook/:topic', async (request, reply) => {
    await pubSubDB.hook(request.params.topic, request.body as JobData);
    return { status: 'ok' };
  });

  server.post<{ Params: Params; Body: Body }>('/v1/actions/hookall/:topic', async (request, reply) => {
    const hookData = request.body.data as unknown as JobData;
    const whereQuery: JobStatsInput = {
      data: request.body.where as unknown as Record<string, unknown>,
      start: request.body.start,
      end: request.body.end,
      range: request.body.range,
    }
    const items = await pubSubDB.hookAll(request.params.topic, hookData, whereQuery, request.body.facets as unknown as string[]);
    return { status: 'ok', items };
  });

  server.get<{ Params: Params }>('/v1/jobs/:topic/:job_id', async (request, reply) => {
    if ((request.query as Query).metadata) {
      return await pubSubDB.getState(request.params.topic, request.params.job_id);
    }
    return (await pubSubDB.getState(request.params.topic, request.params.job_id)).data;
  });
};

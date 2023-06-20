import { RedisConnection } from '../../../cache/ioredis';
import {
  IORedisStore,
  IORedisStream,
  IORedisSub,
  PubSubDB,
  PubSubDBConfig } from '@pubsubdb/pubsubdb';
import { NumberHandler } from '@pubsubdb/pubsubdb/build/services/pipe/functions/number';
import { StreamSignaler } from '@pubsubdb/pubsubdb/build/services/signaler/stream';
import {
  QuorumMessage,
  StreamData,
  StreamDataResponse,
  StreamStatus } from '@pubsubdb/pubsubdb/build/types';

export type PSDBConfig = {
  role: 'ENGINE' | 'WORKER' | 'MODERATOR'; //the moderator for the demo is the machine that runs the web server
  topic?: string;
};

export class PSDBCalculator {
  private static instance: PubSubDB | Promise<PubSubDB>;

  static async init(config: PSDBConfig): Promise<PubSubDB> {
    if (!this.instance) {
      // Wrap initialization logic in a promise and assign it to this.instance
      this.instance = (async (): Promise<PubSubDB> => {
        // instance standard redis connection and clients
        const redisStoreConnection = await RedisConnection.getConnection('store');
        const redisStoreClient = await redisStoreConnection.getClient();
        const redisSubConnection = await RedisConnection.getConnection('sub');
        const redisSubClient = await redisSubConnection.getClient();
        const redisEStreamConnection = await RedisConnection.getConnection('estream');
        const redisEStreamClient = await redisEStreamConnection.getClient();
        const redisWStreamConnection = await RedisConnection.getConnection('wstream');
        const redisWStreamClient = await redisWStreamConnection.getClient();

        //wrap the ioredis clients with the pubsubdb ioredis wrappers
        const redisStore = new IORedisStore(redisStoreClient);
        const redisEStream = new IORedisStream(redisEStreamClient);
        const redisWStream = new IORedisStream(redisWStreamClient);
        const redisSub = new IORedisSub(redisSubClient);

        //initialize pubsubdb such that every instance 
        // includes 1 engine and an optional worker. This is
        // driven by the docker-compose environment variables
        // that specify if the instance is an engine and/or worker
        const pubSubDBConfig: PubSubDBConfig = {

          logLevel: 'debug',

          //the appId matches the id in the `pubsubdb.yaml` descriptor
          appId: 'calc',

          //initialize the `engine`
          engine: {
            store: redisStore,
            stream: redisEStream,
            sub: redisSub,
          },

          //initialize a `worker`
          workers: config.role === 'WORKER' ? [{
            topic: config.topic || 'calculation.execute',
            store: redisStore,
            stream: redisWStream,
            sub: redisSub,

            //the callback is invoked when a message is received on the topic
            callback: async (streamData: StreamData): Promise<StreamDataResponse> => {
              const values = JSON.parse(streamData.data.values as string) as number[];
              const operation = streamData.data.operation as 'add'|'subtract'|'multiply'|'divide';
              const result = new NumberHandler()[operation](values);
              return {
                status: StreamStatus.SUCCESS,
                metadata: { ...streamData.metadata },
                data: { result },
              } as StreamDataResponse;
            }
          }] : []
        };

        //initialize pubsubdb
        const pubSubDB = await PubSubDB.init(pubSubDBConfig);

        //check if the app is already deployed
        const app = await pubSubDB.engine.store.getApp('calc');
        const appVersion = app?.version as unknown as number;
        if (config.role === 'MODERATOR') {
          //deploy v1 of the app if it's not already deployed
          if(isNaN(appVersion)) {
            try {
              await pubSubDB.deploy('/app/pubsubdb/apps/calc/v1/pubsubdb.yaml');
              await pubSubDB.activate('1');
            } catch (err) {
              console.log('err activating', err);
            }
          }
          //subscribe to quorum events
          pubSubDB.quorum.sub((topic: string, message: QuorumMessage) => {
            if (message.type === 'report') {
              if (message.profile.d.length) {
                pubSubDB.logger.info(`${topic}: ${JSON.stringify(message, null, 1)}`);
              }
            } else if (message.type === 'job') {
              const jobId = message.job.metadata.jid;
              const result = message.job.data?.result;
              pubSubDB.logger.info(`job [${jobId}] answer [${result}]`);
            } else {
              pubSubDB.logger.info(`quorum msg: ${JSON.stringify(message, null, 2)}`);
            }
          });
        } else if (isNaN(appVersion)) {
          pubSubDB.logger.info('point-of-presence paused; waiting for app version `1`');
        } else {
          pubSubDB.logger.info(`point-of-presence active; version ${appVersion} deployed and active`);
        }
        return pubSubDB;
      })();
    }

    // Ensure this.instance is always a resolved PubSubDB instance when returned
    return (this.instance instanceof Promise) ? await this.instance : this.instance;
  }

  static async shutDown(): Promise<void> {
    await StreamSignaler.stopConsuming();
    await RedisConnection.disconnectAll();
  }
}

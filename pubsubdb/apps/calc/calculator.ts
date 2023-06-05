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
  StreamStatus } from '@pubsubdb/pubsubdb/build/typedefs';
  
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
        // Initialization logic here...
        const redisStoreConnection = await RedisConnection.getConnection('store');
        const redisStoreClient = await redisStoreConnection.getClient();
        const redisSubConnection = await RedisConnection.getConnection('sub');
        const redisSubClient = await redisSubConnection.getClient();

        const redisEStreamConnection = await RedisConnection.getConnection('estream');
        const redisEStreamClient = await redisEStreamConnection.getClient();
        const redisWStreamConnection = await RedisConnection.getConnection('wstream');
        const redisWStreamClient = await redisWStreamConnection.getClient();

        const redisStore = new IORedisStore(redisStoreClient);
        const redisEStream = new IORedisStream(redisEStreamClient);
        const redisWStream = new IORedisStream(redisWStreamClient);
        const redisSub = new IORedisSub(redisSubClient);

        const pubSubDBConfig: PubSubDBConfig = {
          appId: 'calc',
          //init an engine instance
          engine: {
            store: redisStore,
            stream: redisEStream,
            sub: redisSub,
          },
          //optionally declare the worker
          workers: config.role === 'WORKER' ? [
            {
              topic: config.topic || 'calculation.execute',
              store: redisStore,
              stream: redisWStream,
              sub: redisSub,
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
            }
          ] : []
        };

        const pubSubDB = await PubSubDB.init(pubSubDBConfig);
        const app = await pubSubDB.engine.store.getApp('calc');
        if (config.role === 'MODERATOR') {
          //deploy v1 of the app if it's not already deployed
          if(app?.version !== '1') {
            try {
              await pubSubDB.deploy('/app/pubsubdb/apps/calc/v1/pubsubdb.yaml');
              await pubSubDB.activate('1');
            } catch (err) {
              console.log('err activating', err);
            }
          }
          //subscribe to quorum events
          pubSubDB.quorum.sub((topic: string, message: QuorumMessage) => {
            console.log('quorum msg', message);
          });
        } else if (app?.version !== '1') {
          console.log('waiting for moderator to initialize app version `1`');
        } else {
          console.log('app version `1` already activate');

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

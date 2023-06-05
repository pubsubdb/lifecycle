import { PSDBCalculator } from '../pubsubdb/apps/calc/calculator';

const start = async () => {
  //initialize pubsubdb point of presence (POP)
  // using the role/topic specified in the docker-compose file
  const pubSubDB = await PSDBCalculator.init({
    role: process.env.PSDB_ROLE as 'ENGINE' | 'WORKER' | 'MODERATOR',
    topic: process.env.PSDB_TOPIC || '',
  });

  console.log('PubSubDB initialized successfully', { 
    name: pubSubDB.namespace,
    app: pubSubDB.appId,
    guid: pubSubDB.guid,
    role: process.env.PSDB_ROLE,
    topic: process.env.PSDB_TOPIC,
  });

  //shutdown gracefully
  async function shutdown() {
    await PSDBCalculator.shutDown();
    process.exit(0);
  }

  // quit on ctrl-c when running docker in terminal
  process.on('SIGINT', async function onSigint() {
    console.log('Got SIGINT (aka ctrl-c in docker). Graceful shutdown', { loggedAt: new Date().toISOString() });
    await shutdown();
  });

  // quit properly on docker stop
  process.on('SIGTERM', async function onSigterm() {
    console.log('Got SIGTERM (docker container stop). Graceful shutdown', { loggedAt: new Date().toISOString() });
    await shutdown();
  });
};

start();

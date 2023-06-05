import fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyAuth from '@fastify/auth';
import fastifyBasicAuth from '@fastify/basic-auth';
import fastifyMultipart from '@fastify/multipart';
import { registerAppRoutes } from './routes';
import { registerSocketRoutes } from './routes/socket';
import { PSDBCalculator } from '../pubsubdb/apps/calc/calculator';

//init server and plugins
const server = fastify({ logger: true });
server.register(websocket);
server.register(fastifyAuth);
server.register(fastifyBasicAuth, { validate: async (username, password, req, reply) => { /* Your validation logic here */ } });
server.register(fastifyMultipart, { /* Multipart options here */ });

//start services and server
const start = async () => {
  //init (this machine will now be a point of presence in the pubsubdb cluster)
  const pubsubdb = await PSDBCalculator.init({
    role: process.env.PSDB_ROLE as 'ENGINE' | 'WORKER',
    topic: process.env.PSDB_TOPIC || '',
  });

  //init the socket routes
  registerSocketRoutes(server, pubsubdb);

  //init the http routes
  registerAppRoutes(server, pubsubdb);

  try {
    await server.listen({ port: 3000, path: '0.0.0.0' });
    console.log('Server is running on port 3000');

    async function shutdown() {
      server.close(async () => {
        await PSDBCalculator.shutDown();
        process.exit(0);
      });
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
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

//start();
start();

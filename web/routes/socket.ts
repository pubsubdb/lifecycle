import { FastifyInstance } from 'fastify';
import { PubSubDB } from '@pubsubdb/pubsubdb';

export const registerSocketRoutes = (server: FastifyInstance, pubSubDB: PubSubDB) => {

  server.get('/ws', { websocket: true }, (connection, req) => {
    // Client connect
    console.log('Client connected');

    // ping pong using websocket
    connection.socket.on('message', message => {
      console.log(`Client message: ${message}`);
      connection.socket.send('This is a message from the server!');
    });

    // Client disconnect
    connection.socket.on('close', () => {
      console.log('Client disconnected');
      //todo: cleanup
    });

  });
};


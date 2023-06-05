# PubSubDB Connectivity Test Application
This helps you test inter-service connectivity using PubSubDB. It is written in TypeScript and uses the [PubSubDB](https://github.com/pubsubdb/pubsubdb) NPM package.

The concept behind PubSubDB is to turn Redis inside/out and instead of using it as a microservice *cache* to instead use it to control the entire microservices fleet. The design is based upon the principle of CQRS. In this embodiment, the quorum of PubSubDB engines write to Redis while the quorum of microservices read from it.

The heart of the demo are 10 separate docker instances:  9 running Node and a 1 running a standard Redis instance. Every Node instance has a connection to Redis and will play a different role per its configuration. All instances run the same code; the docker-compose specifies the specific role and topic to listen to.

* [Redis-latest]
* [node:19.8.1-alpine] engine
* [node:19.8.1-alpine] 1 engine + HTTP Server (gateway entry point)
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.execute]
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.multiply]
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.multiply]
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.subtract]
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.subtract]
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.divide]
* [node:19.8.1-alpine] 1 engine + 1 worker [topic: calculation.add]

The idea behind the demo is to show that the different microservices don't need to be network-aware. They should be stateless, single-purpose workers. Perhaps they write to a database or call an external SaaS service, but the worker should execute its single purpose and then return/exit.

As long as the microservice has a Redis connection, it can take part in the PubSubDB network. The network is self-healing and self-organizing. If a microservice goes down, the network will continue to function. If a microservice comes back up, it will rejoin the network and continue to function.

The APIs are simple. The HTTP server accepts a POST request with a JSON body. Even though multiple microservices are involved (up to 3 hops), the response is returned to the caller in a single round-trip. The HTTP server will return a 200 status code and a JSON body with the result of the calculation.

The server/http route code is as follows:

```javascript
  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/pub/:topic', async (request, reply) => {
    return await pubSubDB.pub(request.params.topic, request.body);
  });

  server.post<{ Params: Params; Body: Body; QueryString: Query }>('/v1/pubsub/:topic', async (request, reply) => {
    return await pubSubDB.pubsub(request.params.topic, request.body);
  });
```

## Running the Demo

Download from GitHub and run the following command to load dependencies:

```bash
npm install
```

Then run the following command to build/start the application:

```bash
 docker-compose up --build
 ```
 
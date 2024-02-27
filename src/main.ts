import fastify from "fastify";

const server = fastify({ logger: true });

server.get("/", async (request: any, reply: any) => {
  return "Hello World!";
});

server.listen({ port: 3000 }, (err: any, address: any) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

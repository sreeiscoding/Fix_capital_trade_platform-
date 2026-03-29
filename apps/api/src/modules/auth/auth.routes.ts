import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { registerUser, verifyUser } from "./auth.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  wantsToBeMaster: z.boolean().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type AuthPayload = NonNullable<FastifyRequest["authUser"]>;

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await registerUser(input);
    const token = app.jwt.sign(user, { expiresIn: "7d" });

    return reply.send({ user, token });
  });

  app.post("/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await verifyUser(input.email, input.password);

    if (!user) {
      return reply.code(401).send({ message: "Invalid email or password" });
    }

    const token = app.jwt.sign(user, { expiresIn: "7d" });
    return reply.send({ user, token });
  });

  app.get("/me", { preHandler: [ensureAuth(app)] }, async (request) => {
    return { user: request.authUser };
  });
}

function ensureAuth(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        return reply.code(401).send({ message: "Missing bearer token" });
      }

      const payload = await app.jwt.verify<AuthPayload>(token);
      request.authUser = payload;
    } catch (error) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
  };
}

export { ensureAuth };
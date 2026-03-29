import DerivAPI from "@deriv/deriv-api/dist/DerivAPI.js";
import CircuitBreaker from "opossum";
import WebSocket from "ws";
import { env } from "../config/env.js";

type BasicDerivApi = {
  authorize: (args: { authorize: string }) => Promise<any>;
  balance: (args?: Record<string, unknown>) => Promise<any>;
  portfolio: (args?: Record<string, unknown>) => Promise<any>;
  proposal: (args: Record<string, unknown>) => Promise<any>;
  buy: (args: Record<string, unknown>) => Promise<any>;
  activeSymbols: (args: Record<string, unknown>) => Promise<any>;
  transaction: (args: Record<string, unknown>) => Promise<any>;
  subscribe: (args: Record<string, unknown>) => Promise<any>;
};

type DerivConnection = {
  api: InstanceType<typeof DerivAPI>;
  basic: BasicDerivApi;
  connection: WebSocket;
};

async function buildConnection(): Promise<DerivConnection> {
  const connection = new WebSocket(`${env.DERIV_WS_URL}?app_id=${env.DERIV_APP_ID}`);
  const api = new DerivAPI({ connection });
  const basic = api.basic as BasicDerivApi;

  await new Promise<void>((resolve, reject) => {
    connection.once("open", () => resolve());
    connection.once("error", (error) => reject(error));
  });

  return { api, basic, connection };
}

export async function withDerivConnection<T>(
  accessToken: string,
  handler: (connection: DerivConnection) => Promise<T>
) {
  const breaker = new CircuitBreaker(
    async () => {
      const client = await buildConnection();
      await client.basic.authorize({ authorize: accessToken });

      try {
        return await handler(client);
      } finally {
        client.connection.close();
      }
    },
    {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    }
  );

  return breaker.fire() as Promise<T>;
}

export async function createSubscribedDerivClient(accessToken: string) {
  const client = await buildConnection();
  await client.basic.authorize({ authorize: accessToken });
  return client;
}

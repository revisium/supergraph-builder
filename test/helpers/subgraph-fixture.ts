import * as http from 'node:http';
import { AddressInfo } from 'node:net';

export type IncomingRequest = {
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
};

export function closeServer(server: http.Server): Promise<void> {
  return new Promise<void>((done) => server.close(() => done()));
}

export function listenOnRandomPort(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(port);
    });
  });
}

function recordRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requests: IncomingRequest[],
  sdl: string,
): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    requests.push({
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString('utf-8'),
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: { _service: { sdl } } }));
  });
}

export type SubgraphFixture = {
  port: number;
  requests: IncomingRequest[];
  close: () => Promise<void>;
};

export function makeFederationSdl(fieldName: string = 'hello'): string {
  return `
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

type Query {
  ${fieldName}: String
}
`;
}

export async function startSubgraphFixture(
  fieldName: string = 'hello',
): Promise<SubgraphFixture> {
  const requests: IncomingRequest[] = [];
  const sdl = makeFederationSdl(fieldName);
  const server = http.createServer((req, res) =>
    recordRequest(req, res, requests, sdl),
  );
  const port = await listenOnRandomPort(server);
  return { port, requests, close: () => closeServer(server) };
}

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const SDL = `
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

type Query {
  hello: String
}
`;

function startSubgraphFixture(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = http.createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: { _service: { sdl: SDL } } }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

describe('AppModule (e2e)', () => {
  const ORIGINAL_ENV = process.env;
  let app: INestApplication<App>;
  let fixture: Awaited<ReturnType<typeof startSubgraphFixture>>;

  beforeEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    Object.keys(process.env)
      .filter((k) => k.startsWith('SUBGRAPH_'))
      .forEach((k) => delete process.env[k]);

    fixture = await startSubgraphFixture();
    process.env.SUBGRAPH_DEMO_DATA = `http://127.0.0.1:${fixture.port}/graphql`;
    process.env.SUBGRAPH_DEMO_POLL_INTERVAL_S = '9999';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await fixture.close();
    process.env = ORIGINAL_ENV;
  });

  it('exposes liveness probe', () => {
    return request(app.getHttpServer())
      .get('/health/liveness')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('exposes composed supergraph for the configured project', () => {
    return request(app.getHttpServer())
      .get('/supergraph/demo')
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect((res) => {
        expect(res.text).toContain('schema');
      });
  });

  it('returns 404 for unknown projects', () => {
    return request(app.getHttpServer())
      .get('/supergraph/unknown')
      .expect(404);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import {
  startSubgraphFixture,
  SubgraphFixture,
} from './helpers/subgraph-fixture';

describe('Subgraph headers (e2e)', () => {
  const ORIGINAL_ENV = process.env;
  let fixture: SubgraphFixture | undefined;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    // Strip any inherited SUBGRAPH_* keys so the test env is hermetic.
    Object.keys(process.env)
      .filter((k) => k.startsWith('SUBGRAPH_'))
      .forEach((k) => delete process.env[k]);
    fixture = await startSubgraphFixture();
  });

  afterEach(async () => {
    try {
      if (app) {
        await app.close();
        app = undefined;
      }
      if (fixture) {
        await fixture.close();
        fixture = undefined;
      }
    } finally {
      process.env = ORIGINAL_ENV;
    }
  });

  it('forwards configured headers to subgraph SDL introspection requests', async () => {
    if (!fixture) throw new Error('fixture not initialized');
    process.env.SUBGRAPH_DEMO_DATA = `http://127.0.0.1:${fixture.port}/graphql`;
    process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = 'secret-from-env';
    process.env.SUBGRAPH_DEMO_DATA__HEADER_AUTHORIZATION = 'Bearer token-xyz';
    // Long poll interval so the test only sees the initial bootstrap fetch.
    process.env.SUBGRAPH_DEMO_POLL_INTERVAL_S = '9999';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    expect(fixture.requests.length).toBeGreaterThanOrEqual(1);
    const captured = fixture.requests[0];
    expect(captured.headers['x-api-key']).toBe('secret-from-env');
    expect(captured.headers['authorization']).toBe('Bearer token-xyz');
    expect(captured.headers['content-type']).toBe('application/json');
    expect(captured.body).toContain('GetServiceSDL');
  });

  it('omits auth headers when no header env var is configured', async () => {
    if (!fixture) throw new Error('fixture not initialized');
    process.env.SUBGRAPH_DEMO_DATA = `http://127.0.0.1:${fixture.port}/graphql`;
    process.env.SUBGRAPH_DEMO_POLL_INTERVAL_S = '9999';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    expect(fixture.requests.length).toBeGreaterThanOrEqual(1);
    const captured = fixture.requests[0];
    expect(captured.headers['x-api-key']).toBeUndefined();
    expect(captured.headers['authorization']).toBeUndefined();
    expect(captured.headers['content-type']).toBe('application/json');
  });

  it('isolates headers between subgraphs in the same project', async () => {
    if (!fixture) throw new Error('fixture not initialized');
    const second = await startSubgraphFixture('greetings');
    try {
      process.env.SUBGRAPH_DEMO_DATA = `http://127.0.0.1:${fixture.port}/graphql`;
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = 'data-key';
      process.env.SUBGRAPH_DEMO_CMS = `http://127.0.0.1:${second.port}/graphql`;
      process.env.SUBGRAPH_DEMO_CMS__HEADER_X_API_KEY = 'cms-key';
      process.env.SUBGRAPH_DEMO_POLL_INTERVAL_S = '9999';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleFixture.createNestApplication();
      await app.init();

      expect(fixture.requests.length).toBeGreaterThanOrEqual(1);
      expect(second.requests.length).toBeGreaterThanOrEqual(1);
      expect(fixture.requests[0].headers['x-api-key']).toBe('data-key');
      expect(second.requests[0].headers['x-api-key']).toBe('cms-key');
    } finally {
      await second.close();
    }
  });
});

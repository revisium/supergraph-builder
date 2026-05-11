import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  startSubgraphFixture,
  SubgraphFixture,
} from './helpers/subgraph-fixture';

describe('AppModule (e2e)', () => {
  const ORIGINAL_ENV = process.env;
  let app: INestApplication<App> | undefined;
  let fixture: SubgraphFixture | undefined;

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

  it('exposes liveness probe', () => {
    if (!app) throw new Error('app not initialized');
    return request(app.getHttpServer())
      .get('/health/liveness')
      .expect(200)
      .expect((res: Response) => {
        const body = res.body as { status?: string };
        expect(body.status).toBe('ok');
      });
  });

  it('exposes composed supergraph for the configured project', () => {
    if (!app) throw new Error('app not initialized');
    return request(app.getHttpServer())
      .get('/supergraph/demo')
      .expect(200)
      .expect('Content-Type', /text\/plain/)
      .expect((res: Response) => {
        expect(res.text).toContain('schema');
      });
  });

  it('returns 404 for unknown projects', () => {
    if (!app) throw new Error('app not initialized');
    return request(app.getHttpServer()).get('/supergraph/unknown').expect(404);
  });
});

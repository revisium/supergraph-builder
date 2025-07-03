import { getProjectsFromEnvironment } from 'src/supergraph/utils/get-projects-from-env';

describe('getProjectsFromEnvironment', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('returns empty array when no SUBGRAPH env vars', () => {
    Object.keys(process.env)
      .filter((key) => key.startsWith('SUBGRAPH_'))
      .forEach((key) => delete process.env[key]);

    const result = getProjectsFromEnvironment();
    expect(result).toEqual([]);
  });

  test('collects subGraphs and system keys correctly', () => {
    process.env.SUBGRAPH_PROJECT1_SERVICEA =
      'https://project1-service-a.example.com/graphql';
    process.env.SUBGRAPH_PROJECT1_SERVICEB =
      'https://project1-service-b.example.com/graphql';
    process.env.SUBGRAPH_PROJECT1_POLL_INTERVAL_S = '20';

    process.env.SUBGRAPH_PROJECT2_SERVICEB =
      'https://project2-service-b.example.com/graphql';
    process.env.OTHER_VAR = 'shouldBeIgnored';

    const [project1, project2] = getProjectsFromEnvironment();

    expect(project1).toBeDefined();
    expect(project1.subGraphs).toEqual([
      {
        name: 'servicea',
        url: 'https://project1-service-a.example.com/graphql',
      },
      {
        name: 'serviceb',
        url: 'https://project1-service-b.example.com/graphql',
      },
    ]);
    expect(project1.system).toMatchObject({
      POLL_INTERVAL_S: 20,
    });

    expect(project2).toBeDefined();
    expect(project2.subGraphs).toEqual([
      {
        name: 'serviceb',
        url: 'https://project2-service-b.example.com/graphql',
      },
    ]);
    expect(project2.system).toMatchObject({
      POLL_INTERVAL_S: 60,
    });
  });
});

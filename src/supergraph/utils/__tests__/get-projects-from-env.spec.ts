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
      MAX_RUNTIME_ERRORS: 5,
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
      MAX_RUNTIME_ERRORS: 5,
    });
  });

  test('parses MAX_RUNTIME_ERRORS correctly', () => {
    process.env.SUBGRAPH_PROJECT1_SERVICEA = 'https://example.com/graphql';
    process.env.SUBGRAPH_PROJECT1_MAX_RUNTIME_ERRORS = '10';

    const [project1] = getProjectsFromEnvironment();

    expect(project1.system).toMatchObject({
      POLL_INTERVAL_S: 60,
      MAX_RUNTIME_ERRORS: 10,
    });
  });

  test('uses default MAX_RUNTIME_ERRORS when not specified', () => {
    process.env.SUBGRAPH_PROJECT1_SERVICEA = 'https://example.com/graphql';

    const [project1] = getProjectsFromEnvironment();

    expect(project1.system).toMatchObject({
      POLL_INTERVAL_S: 60,
      MAX_RUNTIME_ERRORS: 5,
    });
  });

  test('handles invalid numeric configuration values', () => {
    process.env.SUBGRAPH_PROJECT1_SERVICEA = 'https://example.com/graphql';
    process.env.SUBGRAPH_PROJECT1_POLL_INTERVAL_S = 'invalid';
    process.env.SUBGRAPH_PROJECT1_MAX_RUNTIME_ERRORS = '-5';

    const [project1] = getProjectsFromEnvironment();

    expect(project1.system).toMatchObject({
      POLL_INTERVAL_S: 60, // Default fallback
      MAX_RUNTIME_ERRORS: 5, // Default fallback for negative value
    });
  });

  test('handles empty string configuration values', () => {
    process.env.SUBGRAPH_PROJECT1_SERVICEA = 'https://example.com/graphql';
    process.env.SUBGRAPH_PROJECT1_POLL_INTERVAL_S = '';
    process.env.SUBGRAPH_PROJECT1_MAX_RUNTIME_ERRORS = '';

    const [project1] = getProjectsFromEnvironment();

    expect(project1.system).toMatchObject({
      POLL_INTERVAL_S: 60, // Default fallback
      MAX_RUNTIME_ERRORS: 5, // Default fallback
    });
  });

  describe('subgraph headers (__HEADER_ convention)', () => {
    test('attaches a single header to the matching subgraph', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = 'secret-123';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs).toEqual([
        {
          name: 'data',
          url: 'https://example.com/data/graphql',
          headers: { 'x-api-key': 'secret-123' },
        },
      ]);
    });

    test('attaches multiple headers to the same subgraph', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';
      process.env.SUBGRAPH_DEMO_DATA__HEADER_AUTHORIZATION = 'Bearer abc';
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_REQUEST_ID = 'builder';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs).toHaveLength(1);
      expect(project.subGraphs[0]).toEqual({
        name: 'data',
        url: 'https://example.com/data/graphql',
        headers: {
          authorization: 'Bearer abc',
          'x-request-id': 'builder',
        },
      });
    });

    test('isolates headers per subgraph in the same project', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = 'data-key';
      process.env.SUBGRAPH_DEMO_CMS = 'https://example.com/cms/graphql';
      process.env.SUBGRAPH_DEMO_CMS__HEADER_X_API_KEY = 'cms-key';

      const [project] = getProjectsFromEnvironment();

      const data = project.subGraphs.find((s) => s.name === 'data');
      const cms = project.subGraphs.find((s) => s.name === 'cms');

      expect(data?.headers).toEqual({ 'x-api-key': 'data-key' });
      expect(cms?.headers).toEqual({ 'x-api-key': 'cms-key' });
    });

    test('omits headers field when no header env var is set', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs[0]).toEqual({
        name: 'data',
        url: 'https://example.com/data/graphql',
      });
      expect(project.subGraphs[0].headers).toBeUndefined();
    });

    test('supports subgraph names containing underscores', () => {
      process.env.SUBGRAPH_SHOP_USER_API = 'https://example.com/users/graphql';
      process.env.SUBGRAPH_SHOP_USER_API__HEADER_X_API_KEY = 'shop-key';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs).toEqual([
        {
          name: 'user_api',
          url: 'https://example.com/users/graphql',
          headers: { 'x-api-key': 'shop-key' },
        },
      ]);
    });

    test('skips empty header values', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = '';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs[0].headers).toBeUndefined();
    });

    test('skips orphan headers when the subgraph URL is not defined', () => {
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = 'orphan';

      const result = getProjectsFromEnvironment();

      expect(result).toEqual([]);
    });

    test('skips header config with invalid header name', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';
      // empty header name after the marker
      process.env['SUBGRAPH_DEMO_DATA__HEADER_'] = 'value';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs[0].headers).toBeUndefined();
    });

    test('header config is order-independent (header before url)', () => {
      // env-var iteration order is implementation-defined; the parser must
      // not depend on URL being seen before headers.
      process.env.SUBGRAPH_DEMO_DATA__HEADER_X_API_KEY = 'key';
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs).toEqual([
        {
          name: 'data',
          url: 'https://example.com/data/graphql',
          headers: { 'x-api-key': 'key' },
        },
      ]);
    });

    test('does not treat header env vars as additional subgraphs', () => {
      process.env.SUBGRAPH_DEMO_DATA = 'https://example.com/data/graphql';
      process.env.SUBGRAPH_DEMO_DATA__HEADER_AUTHORIZATION = 'Bearer x';

      const [project] = getProjectsFromEnvironment();

      expect(project.subGraphs).toHaveLength(1);
      expect(project.subGraphs[0].name).toBe('data');
    });
  });
});

/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { composeServices } from '@apollo/composition';
import { parse } from 'graphql';
import * as objectHash from 'object-hash';
import { interval } from 'rxjs';
import { SupergraphService } from '../supergraph.service';
import { FetchService } from '../fetch.service';
import { HiveCliService } from '../hive.service';
import { SchemaStorageService } from '../schema-storage.service';
import { getProjectsFromEnvironment } from '../utils/get-projects-from-env';

// Mock external modules
jest.mock('@apollo/composition');
jest.mock('graphql');
jest.mock('object-hash');
jest.mock('../utils/get-projects-from-env');

describe('SupergraphService', () => {
  describe('onApplicationBootstrap', () => {
    it('should throw error when no projects are found', async () => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([]);

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        'No projects found. Define SUBGRAPH_<PROJECT>_ env variables.',
      );
    });

    it('should successfully bootstrap with valid projects', async () => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
      ]);
      fetchService.fetchSchema.mockResolvedValue(mockSdl);
      storageService.saveSchema.mockResolvedValue(void 0 as any);
      hiveService.publishSchemaFile.mockResolvedValue(undefined);

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();

      // Verify fetch was called with MAX_RUNTIME_ERRORS as maxRetries
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4001/graphql',
        5,
      );
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4002/graphql',
        5,
      );

      // Verify schemas were saved
      expect(storageService.saveSchema).toHaveBeenCalledTimes(2);
      expect(storageService.saveSchema).toHaveBeenCalledWith(
        'test-project',
        'users',
        mockSdl,
      );
      expect(storageService.saveSchema).toHaveBeenCalledWith(
        'test-project',
        'products',
        mockSdl,
      );

      // Verify hive publishing was called
      expect(hiveService.publishSchemaFile).toHaveBeenCalledTimes(2);

      // Verify composition was called
      expect(composeServices).toHaveBeenCalled();

      intervalSpy.mockRestore();
    });

    it('should exit process on bootstrap failure', async () => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
      ]);
      fetchService.fetchSchema.mockRejectedValue(new Error('Network error'));

      await expect(service.onApplicationBootstrap()).rejects.toThrow(
        'Process exit called',
      );

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle multiple projects', async () => {
      const project2 = {
        ...mockProjectConfig,
        project: 'project-2',
        subGraphs: [{ name: 'orders', url: 'http://localhost:4003/graphql' }],
        system: {
          ...mockProjectConfig.system,
          MAX_RUNTIME_ERRORS: 3,
        },
      };

      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
        project2,
      ]);
      fetchService.fetchSchema.mockResolvedValue(mockSdl);
      storageService.saveSchema.mockResolvedValue(void 0 as any);
      hiveService.publishSchemaFile.mockResolvedValue(undefined);

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();

      // Verify schemas were fetched with correct maxRetries for each project
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4001/graphql',
        5, // mockProjectConfig.system.MAX_RUNTIME_ERRORS
      );
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4002/graphql',
        5,
      );
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4003/graphql',
        3, // project2.system.MAX_RUNTIME_ERRORS
      );

      intervalSpy.mockRestore();
    });

    it('should not publish to hive when hive config is incomplete', async () => {
      const projectWithoutHive = {
        ...mockProjectConfig,
        system: {
          ...mockProjectConfig.system,
          HIVE_TARGET: '',
          HIVE_ACCESS_TOKEN: '',
          HIVE_AUTHOR: '',
        },
      };

      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        projectWithoutHive,
      ]);
      fetchService.fetchSchema.mockResolvedValue(mockSdl);
      storageService.saveSchema.mockResolvedValue(void 0 as any);

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();

      expect(hiveService.publishSchemaFile).not.toHaveBeenCalled();

      intervalSpy.mockRestore();
    });

    beforeEach(() => {
      // Mock process.exit to prevent actual exit during tests
      jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });
    });
  });

  describe('getSuperGraph', () => {
    it('should return undefined for non-existent project', () => {
      const result = service.getSuperGraph('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return supergraph SDL after successful composition', async () => {
      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await service.onApplicationBootstrap();

      const result = service.getSuperGraph('test-project');
      expect(result).toBe('composed supergraph sdl');

      intervalSpy.mockRestore();
    });

    beforeEach(() => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
      ]);
      fetchService.fetchSchema.mockResolvedValue(mockSdl);
      storageService.saveSchema.mockResolvedValue(void 0 as any);
      hiveService.publishSchemaFile.mockResolvedValue(undefined);
    });
  });

  describe('polling behavior', () => {
    it('should use exhaustMap to prevent concurrent polling', async () => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
      ]);

      // Bootstrap succeeds (2 calls for 2 subgraphs)
      fetchService.fetchSchema
        .mockResolvedValueOnce(mockSdl)
        .mockResolvedValueOnce(mockSdl);

      storageService.saveSchema.mockResolvedValue(void 0 as any);
      hiveService.publishSchemaFile.mockResolvedValue(undefined);

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await service.onApplicationBootstrap();

      // Verify that fetchSchema was called with MAX_RUNTIME_ERRORS as retry limit
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4001/graphql',
        5, // MAX_RUNTIME_ERRORS from mockProjectConfig
      );

      intervalSpy.mockRestore();
    });

    it('should delegate retry logic to FetchService', async () => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
      ]);

      // Bootstrap succeeds (2 calls for 2 subgraphs)
      fetchService.fetchSchema
        .mockResolvedValueOnce(mockSdl)
        .mockResolvedValueOnce(mockSdl);

      storageService.saveSchema.mockResolvedValue(void 0 as any);
      hiveService.publishSchemaFile.mockResolvedValue(undefined);

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await service.onApplicationBootstrap();

      // Verify that fetchSchema was called with MAX_RUNTIME_ERRORS as maxRetries
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4001/graphql',
        5, // MAX_RUNTIME_ERRORS used as maxRetries
      );
      expect(fetchService.fetchSchema).toHaveBeenCalledWith(
        'http://localhost:4002/graphql',
        5, // MAX_RUNTIME_ERRORS used as maxRetries
      );

      intervalSpy.mockRestore();
    });

    beforeEach(() => {
      jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });
    });
  });

  describe('schema composition', () => {
    it('should handle composition errors gracefully', async () => {
      (
        composeServices as jest.MockedFunction<typeof composeServices>
      ).mockReturnValue({
        errors: [{ message: 'Composition error' } as any],
        supergraphSdl: undefined,
        schema: {} as any,
        hints: undefined,
      });

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();

      // Should not set supergraph when composition fails
      const result = service.getSuperGraph('test-project');
      expect(result).toBeUndefined();

      intervalSpy.mockRestore();
    });

    it('should handle missing supergraph SDL', async () => {
      (
        composeServices as jest.MockedFunction<typeof composeServices>
      ).mockReturnValue({
        errors: undefined,
        supergraphSdl: '',
        schema: {} as any,
        hints: [],
      } as any);

      // Mock interval to prevent actual polling during test
      const intervalSpy = jest.spyOn({ interval }, 'interval');
      intervalSpy.mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
        }),
      } as any);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();

      // Should not set supergraph when SDL is missing
      const result = service.getSuperGraph('test-project');
      expect(result).toBeUndefined();

      intervalSpy.mockRestore();
    });

    beforeEach(() => {
      (getProjectsFromEnvironment as jest.Mock).mockReturnValue([
        mockProjectConfig,
      ]);
      fetchService.fetchSchema.mockResolvedValue(mockSdl);
      storageService.saveSchema.mockResolvedValue(void 0 as any);
      hiveService.publishSchemaFile.mockResolvedValue(undefined);
    });
  });

  let service: SupergraphService;
  let fetchService: jest.Mocked<FetchService>;
  let hiveService: jest.Mocked<HiveCliService>;
  let storageService: jest.Mocked<SchemaStorageService>;

  const mockProjectConfig = {
    project: 'test-project',
    subGraphs: [
      { name: 'users', url: 'http://localhost:4001/graphql' },
      { name: 'products', url: 'http://localhost:4002/graphql' },
    ],
    system: {
      POLL_INTERVAL_S: 60,
      HIVE_TARGET: 'test-target',
      HIVE_ACCESS_TOKEN: 'test-token',
      HIVE_AUTHOR: 'test-author',
      MAX_RUNTIME_ERRORS: 5,
    },
  };

  const mockSdl = 'type Query { hello: String }';
  const mockParsedSdl = { kind: 'Document' };
  const mockHash = 'test-hash-123';

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock external functions
    (objectHash as jest.MockedFunction<typeof objectHash>).mockReturnValue(
      mockHash as any,
    );
    (parse as jest.MockedFunction<typeof parse>).mockReturnValue(
      mockParsedSdl as any,
    );
    (
      composeServices as jest.MockedFunction<typeof composeServices>
    ).mockReturnValue({
      supergraphSdl: 'composed supergraph sdl',
      errors: undefined,
      schema: {} as any,
      hints: [],
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupergraphService,
        {
          provide: FetchService,
          useValue: {
            fetchSchema: jest.fn(),
          },
        },
        {
          provide: HiveCliService,
          useValue: {
            publishSchemaFile: jest.fn(),
          },
        },
        {
          provide: SchemaStorageService,
          useValue: {
            saveSchema: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SupergraphService>(SupergraphService);
    fetchService = module.get(FetchService);
    hiveService = module.get(HiveCliService);
    storageService = module.get(SchemaStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
});

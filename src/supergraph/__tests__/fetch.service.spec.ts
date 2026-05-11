/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { FetchService } from '../fetch.service';

describe('FetchService', () => {
  describe('fetchSchema', () => {
    it('should successfully fetch schema on first attempt', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: {
            _service: {
              sdl: mockSdl,
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      const result = await service.fetchSchema(mockUrl);

      expect(result).toBe(mockSdl);
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.post).toHaveBeenCalledWith(
        mockUrl,
        expect.stringContaining('query GetServiceSDL'),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    it('should retry on network error and eventually succeed', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: {
            _service: {
              sdl: mockSdl,
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };

      // First two calls fail, third succeeds
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValue(of(mockResponse));

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      const result = await service.fetchSchema(mockUrl, { maxRetries: 3 });

      expect(result).toBe(mockSdl);
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should log successful recovery after retries', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: {
            _service: {
              sdl: mockSdl,
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };

      // First call fails, second succeeds
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValue(of(mockResponse));

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      const logSpy = jest.spyOn(service['logger'], 'log');

      const result = await service.fetchSchema(mockUrl, { maxRetries: 2 });

      expect(result).toBe(mockSdl);
      expect(logSpy).toHaveBeenCalledWith(
        'Successfully fetched schema from https://example.com/graphql after 2 attempts',
      );
    });

    it('should fail after exceeding max retries', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Persistent network error')),
      );

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 2 }),
      ).rejects.toThrow(
        'Failed to fetch schema from https://example.com/graphql after 3 attempts',
      );

      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid response structure - missing data', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 0 }),
      ).rejects.toThrow(
        'Invalid response structure from https://example.com/graphql: SDL not found',
      );
    });

    it('should handle invalid response structure - missing _service', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 0 }),
      ).rejects.toThrow(
        'Invalid response structure from https://example.com/graphql: SDL not found',
      );
    });

    it('should handle invalid response structure - missing sdl', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          data: {
            _service: {},
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };

      httpService.post.mockReturnValue(of(mockResponse));

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 0 }),
      ).rejects.toThrow(
        'Invalid response structure from https://example.com/graphql: SDL not found',
      );
    });

    it('should use default maxRetries when not specified', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
        cb();
        return {} as NodeJS.Timeout;
      });

      await expect(service.fetchSchema(mockUrl)).rejects.toThrow(
        'Failed to fetch schema from https://example.com/graphql after 4 attempts',
      );

      // Should try 4 times (0, 1, 2, 3 - maxRetries default is 3)
      expect(httpService.post).toHaveBeenCalledTimes(4);
    });

    it('should handle AxiosError properly', async () => {
      const axiosError = {
        message: 'Request failed with status code 500',
        isAxiosError: true,
      };

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 0 }),
      ).rejects.toThrow(
        'Failed to fetch schema from https://example.com/graphql: Request failed with status code 500',
      );
    });

    it('should implement exponential backoff with jitter', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: () => void) => {
          cb();
          return {} as NodeJS.Timeout;
        });

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 2 }),
      ).rejects.toThrow();

      // Check that setTimeout was called with exponential backoff delays (with jitter)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

      // First retry should be around 1000ms ±25% jitter (750-1250ms range)
      const firstDelay = setTimeoutSpy.mock.calls[0][1] as number;
      expect(firstDelay).toBeGreaterThanOrEqual(750);
      expect(firstDelay).toBeLessThanOrEqual(1250);

      // Second retry should be around 2000ms ±25% jitter (1500-2500ms range)
      const secondDelay = setTimeoutSpy.mock.calls[1][1] as number;
      expect(secondDelay).toBeGreaterThanOrEqual(1500);
      expect(secondDelay).toBeLessThanOrEqual(2500);
    });

    it('forwards custom headers alongside Content-Type', async () => {
      const mockResponse: AxiosResponse = {
        data: { data: { _service: { sdl: mockSdl } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };
      httpService.post.mockReturnValue(of(mockResponse));

      await service.fetchSchema(mockUrl, {
        headers: {
          'x-api-key': 'secret-123',
          authorization: 'Bearer abc',
        },
      });

      expect(httpService.post).toHaveBeenCalledWith(
        mockUrl,
        expect.stringContaining('query GetServiceSDL'),
        {
          headers: {
            'x-api-key': 'secret-123',
            authorization: 'Bearer abc',
            'Content-Type': 'application/json',
          },
        },
      );
    });

    it('does not allow Content-Type to be overridden via headers', async () => {
      const mockResponse: AxiosResponse = {
        data: { data: { _service: { sdl: mockSdl } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };
      httpService.post.mockReturnValue(of(mockResponse));

      await service.fetchSchema(mockUrl, {
        headers: { 'Content-Type': 'text/plain' },
      });

      const callArgs = httpService.post.mock.calls[0];
      const usedHeaders = (callArgs[2] as { headers: Record<string, string> })
        .headers;
      expect(usedHeaders['Content-Type']).toBe('application/json');
    });

    it('strips case-variant content-type overrides before applying canonical one', async () => {
      const mockResponse: AxiosResponse = {
        data: { data: { _service: { sdl: mockSdl } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };
      httpService.post.mockReturnValue(of(mockResponse));

      await service.fetchSchema(mockUrl, {
        headers: {
          'content-type': 'text/plain',
          'x-api-key': 'preserved',
        },
      });

      const callArgs = httpService.post.mock.calls[0];
      const usedHeaders = (callArgs[2] as { headers: Record<string, string> })
        .headers;
      const lowerKeys = Object.keys(usedHeaders).map((k) => k.toLowerCase());
      expect(lowerKeys.filter((k) => k === 'content-type')).toEqual([
        'content-type',
      ]);
      expect(usedHeaders['Content-Type']).toBe('application/json');
      expect(usedHeaders['x-api-key']).toBe('preserved');
    });

    it('sends no extra headers when none are provided', async () => {
      const mockResponse: AxiosResponse = {
        data: { data: { _service: { sdl: mockSdl } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      };
      httpService.post.mockReturnValue(of(mockResponse));

      await service.fetchSchema(mockUrl);

      expect(httpService.post).toHaveBeenCalledWith(
        mockUrl,
        expect.any(String),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    it('should cap backoff delay at 30 seconds', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: () => void) => {
          cb();
          return {} as NodeJS.Timeout;
        });

      await expect(
        service.fetchSchema(mockUrl, { maxRetries: 10 }),
      ).rejects.toThrow();

      // Check that the delay is capped at 30000ms for higher attempts
      const calls = setTimeoutSpy.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toBeLessThanOrEqual(30000);
    });
  });

  let service: FetchService;
  let httpService: jest.Mocked<HttpService>;

  const mockUrl = 'https://example.com/graphql';
  const mockSdl = 'type Query { hello: String }';

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<FetchService>(FetchService);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
});

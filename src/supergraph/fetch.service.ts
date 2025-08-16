import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';

const sdlQuery = `
  query GetServiceSDL {
    _service {
      sdl
    }
  }
`;

type ReturnType = {
  data?: {
    _service?: {
      sdl?: string;
    };
  };
};

@Injectable()
export class FetchService {
  private readonly logger = new Logger(FetchService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchSchema(url: string, maxRetries: number = 3): Promise<string> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data } = await firstValueFrom(
          this.httpService
            .post<ReturnType>(
              url,
              JSON.stringify({
                query: sdlQuery,
              }),
              { headers: { 'Content-Type': 'application/json' } },
            )
            .pipe(
              catchError((error: AxiosError) => {
                throw new Error(
                  `Failed to fetch schema from ${url}: ${error.message}`,
                );
              }),
            ),
        );

        if (!data?.data?._service?.sdl) {
          throw new Error(
            `Invalid response structure from ${url}: SDL not found`,
          );
        }

        if (attempt > 0) {
          this.logger.log(
            `Successfully fetched schema from ${url} after ${attempt + 1} attempts`,
          );
        }

        return data.data._service.sdl;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
          // Add jitter to prevent thundering herd (±25% randomization)
          const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
          const backoffDelay = Math.max(
            100,
            Math.min(30000, baseDelay + jitter),
          );

          this.logger.warn(
            `Retry attempt ${attempt + 1}/${maxRetries + 1} for ${url} in ${Math.round(backoffDelay)}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    this.logger.error(
      `Failed to fetch schema from ${url} after ${maxRetries + 1} attempts: ${lastError.message}`,
    );

    throw new Error(
      `Failed to fetch schema from ${url} after ${maxRetries + 1} attempts: ${lastError.message}`,
    );
  }
}

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

  async fetchSchema(url: string): Promise<string> {
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
            this.logger.error(
              `Failed to fetch schema from ${url}: ${error.message}`,
              error.response?.data,
            );

            throw new Error(
              `Failed to fetch schema from ${url}: ${error.message}`,
            );
          }),
        ),
    );

    if (!data?.data?._service?.sdl) {
      throw new Error(`Invalid response structure from ${url}: SDL not found`);
    }

    return data.data._service.sdl;
  }
}

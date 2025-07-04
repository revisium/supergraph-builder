import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class SchemaStorageService {
  private readonly logger = new Logger(SchemaStorageService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = join(process.cwd(), 'schemas');
  }

  async saveSchema(
    projectId: string,
    name: string,
    sdl: string,
  ): Promise<string> {
    const projectDir = join(this.baseDir, projectId, name);
    const filePath = join(projectDir, 'schema.graphql');

    try {
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(filePath, sdl, 'utf8');
      this.logger.log(
        `Schema for project '${projectId}'/${name} saved to: ${filePath}`,
      );
      return filePath;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to save schema for project '${projectId}/${name}': ${error.message}`,
        );
      }

      throw error;
    }
  }
}

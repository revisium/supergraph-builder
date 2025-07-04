import { Injectable, Logger } from '@nestjs/common';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

@Injectable()
export class HiveCliService {
  private readonly logger = new Logger(HiveCliService.name);

  constructor() {}

  async publishSchemaFile(
    target: string,
    service: string,
    url: string,
    schemaPath: string,
    token: string,
  ): Promise<void> {
    const cmd = [
      'hive',
      'schema:publish',
      `--registry.accessToken "${token}"`,
      `--target "${target}"`,
      `--service "${service}"`,
      `--url "${url}"`,
      `"${schemaPath}"`,
    ].join(' ');

    this.logger.log(`Executing Hive CLI: target=${target}`);
    try {
      const { stdout, stderr } = await exec(cmd, {
        cwd: process.cwd(),
        env: process.env,
      });
      if (stdout) this.logger.log(stdout);
      if (stderr) this.logger.error(stderr);
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error(
          `Failed to publish schema via Hive CLI for target=${target}: ${err.message}`,
        );
      }

      throw err;
    }
  }
}

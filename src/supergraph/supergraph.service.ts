import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { composeServices } from '@apollo/composition';
import { ServiceDefinition } from '@apollo/federation-internals';
import { parse } from 'graphql';
import * as objectHash from 'object-hash';
import { interval, startWith, exhaustMap, from } from 'rxjs';
import { FetchService } from 'src/supergraph/fetch.service';
import { HiveCliService } from 'src/supergraph/hive.service';
import { SchemaStorageService } from 'src/supergraph/schema-storage.service';
import {
  ProjectConfig,
  SubGraphEntry,
  getProjectsFromEnvironment,
} from 'src/supergraph/utils/get-projects-from-env';

interface SuperGraphCacheEntry {
  serviceDefinition: ServiceDefinition;
  hash: string;
  sdl: string;
}

@Injectable()
export class SupergraphService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SupergraphService.name);
  private readonly supergraphs = new Map<string, string>();
  private readonly caches = new Map<string, SuperGraphCacheEntry[]>();

  constructor(
    private readonly fetchService: FetchService,
    private readonly schemaStorage: SchemaStorageService,
    private readonly hiveCliService: HiveCliService,
  ) {}

  public onApplicationBootstrap() {
    const projects = getProjectsFromEnvironment();

    if (!projects.length) {
      throw new Error(
        'No projects found. Define SUBGRAPH_<PROJECT>_ env variables.',
      );
    }

    projects.forEach((project) => this.startPolling(project));
  }

  public getSuperGraph(projectId: string): string | undefined {
    return this.supergraphs.get(projectId);
  }

  private startPolling(project: ProjectConfig): void {
    const { project: id, subGraphs, system } = project;
    this.logger.log(`Project "${id}" polling every ${system.POLL_INTERVAL_S}s`);
    subGraphs.forEach(({ name, url }) =>
      this.logger.log(` - Subgraph "${name}" at ${url}`),
    );

    this.caches.set(id, []);
    interval(system.POLL_INTERVAL_S * 1000)
      .pipe(
        startWith(0),
        exhaustMap(() => from(this.refreshProject(project))),
      )
      .subscribe({
        error: (error: Error) => {
          this.logger.error(
            `[${id}] Polling failed: ${error.message}`,
            error.stack,
          );
        },
      });
  }

  private async refreshProject(project: ProjectConfig): Promise<void> {
    const { project: projectId, subGraphs } = project;

    const newDefs = await this.loadDefinitions(subGraphs);
    const changed = this.findChanges(projectId, newDefs);

    if (changed.length) {
      this.logChanges(projectId, changed);
      await this.saveChanges(projectId, changed);
      await this.publishSchema(project, changed);
      this.buildSupergraph(projectId, newDefs);
    }

    this.caches.set(projectId, newDefs);
  }

  private async loadDefinitions(
    subGraphs: SubGraphEntry[],
  ): Promise<SuperGraphCacheEntry[]> {
    return Promise.all(
      subGraphs.map(async ({ name, url }) => {
        const sdl = await this.fetchService.fetchSchema(url);
        const hash = objectHash(sdl);
        return {
          serviceDefinition: { name, url, typeDefs: parse(sdl) },
          hash,
          sdl,
        };
      }),
    );
  }

  private findChanges(
    projectId: string,
    newDefs: SuperGraphCacheEntry[],
  ): SuperGraphCacheEntry[] {
    const oldDefs = this.caches.get(projectId) || [];
    return newDefs.filter(({ serviceDefinition: { name }, hash }) => {
      const existing = oldDefs.find((e) => e.serviceDefinition.name === name);
      return !existing || existing.hash !== hash;
    });
  }

  private logChanges(projectId: string, changed: SuperGraphCacheEntry[]): void {
    changed.forEach(({ serviceDefinition: { name }, hash }) =>
      this.logger.log(`[${projectId}] "${name}" changed (hash=${hash})`),
    );
  }

  private async saveChanges(
    projectId: string,
    changed: SuperGraphCacheEntry[],
  ) {
    for (const {
      serviceDefinition: { name },
      sdl,
    } of changed) {
      await this.schemaStorage.saveSchema(projectId, name, sdl);
    }
  }

  private async publishSchema(
    project: ProjectConfig,
    changed: SuperGraphCacheEntry[],
  ) {
    if (project.system.HIVE_TARGET && project.system.HIVE_ACCESS_TOKEN) {
      for (const {
        serviceDefinition: { name, url },
      } of changed) {
        if (!url) {
          this.logger.warn(
            `[${project.project}] Skipping schema publish for "${name}" - no URL provided`,
          );
          continue;
        }

        const schemaPath = `schemas/${project.project}/${name}`;
        await this.hiveCliService.publishSchemaFile(
          project.system.HIVE_TARGET,
          name,
          url,
          schemaPath,
          project.system.HIVE_ACCESS_TOKEN,
        );
      }
    }
  }

  private buildSupergraph(
    projectId: string,
    definitions: SuperGraphCacheEntry[],
  ): void {
    this.logger.log(
      `[${projectId}] Composing supergraph from ${definitions.length} services`,
    );

    const result = composeServices(definitions.map((d) => d.serviceDefinition));

    if (result.errors?.length) {
      this.logger.error(`[${projectId}] Composition failed`, result.errors);
      return;
    }

    if (!result.supergraphSdl) {
      this.logger.error(`[${projectId}] No supergraph SDL generated`);
      return;
    }

    this.supergraphs.set(projectId, result.supergraphSdl);
    this.logger.log(`[${projectId}] Supergraph updated successfully`);
  }
}

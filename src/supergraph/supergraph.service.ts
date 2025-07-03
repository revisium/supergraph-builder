import { composeServices } from '@apollo/composition';
import { ServiceDefinition } from '@apollo/federation-internals';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { parse } from 'graphql';
import * as objectHash from 'object-hash';
import { exhaustMap, from, interval, startWith } from 'rxjs';
import { FetchService } from 'src/supergraph/fetch.service';
import {
  getProjectsFromEnvironment,
  ProjectConfig,
  SubGraphEntry,
} from 'src/supergraph/utils/get-projects-from-env';

type SuperGraphCache = { serviceDefinition: ServiceDefinition; hash: string };

@Injectable()
export class SupergraphService implements OnApplicationBootstrap {
  private supergraphs = new Map<string, string>();

  private superGraphCaches = new Map<string, SuperGraphCache[]>();

  private readonly logger = new Logger(SupergraphService.name);
  private projects: ProjectConfig[] = [];

  constructor(private readonly fetchService: FetchService) {}

  public onApplicationBootstrap() {
    this.projects = getProjectsFromEnvironment();

    if (this.projects.length === 0) {
      throw new Error(
        'No projects found. Please define SUBGRAPH_* environment variables.',
      );
    }

    for (const project of this.projects) {
      this.runProject(project);
    }
  }

  public getSuperGraph(projectId: string) {
    return this.supergraphs.get(projectId);
  }

  private runProject(project: ProjectConfig) {
    this.logger.log(
      `Found project: ${project.project}, poll internal in seconds = ${project.system.POLL_INTERVAL_S}`,
    );

    for (const subGraph of project.subGraphs) {
      this.logger.log(`Found subgraph: ${subGraph.name} at ${subGraph.url}`);
    }

    this.superGraphCaches.set(project.project, []);

    interval(project.system.POLL_INTERVAL_S * 1000)
      .pipe(
        startWith(0),
        exhaustMap(() => from(this.updateSubGraphForProject(project))),
      )
      .subscribe(() => {});
  }

  private async updateSubGraphForProject(project: ProjectConfig) {
    const definitions = await this.getDefinitions(project.subGraphs);
    const changedDefinitions = this.getChangedDefinitions(
      project.project,
      definitions,
    );

    for (const definition of changedDefinitions) {
      this.logger.log(
        `[${project.project}] changed subgraph definition "${definition.serviceDefinition.name}" hash=${definition.hash}`,
      );
    }

    this.updateCache(project.project, definitions);

    if (!changedDefinitions.length) {
      return;
    }

    this.logger.log(
      `[${project.project}] building supergraph from ${project.subGraphs.length} subgraphs`,
    );

    const result = composeServices(
      definitions.map((item) => item.serviceDefinition),
    );

    if (result.errors && result.errors.length > 0) {
      this.logger.error(
        `[${project.project}] supergraph composition failed:`,
        result.errors,
      );
      return;
    }

    if (result.supergraphSdl) {
      this.logger.log(`[${project.project}] supergraph built successfully`);

      this.supergraphs.set(project.project, result.supergraphSdl);
    } else {
      this.logger.error(
        `[${project.project}] failed to generate supergraph SDL`,
      );
    }
  }

  private getChangedDefinitions(
    project: string,
    definitions: SuperGraphCache[],
  ) {
    const cache = this.superGraphCaches.get(project);

    if (!cache) {
      throw new Error(`No supergraph found for ${project}`);
    }

    return definitions.filter((definition) => {
      const found = cache.find(
        (cache) =>
          cache.serviceDefinition.name === definition.serviceDefinition.name,
      );

      return !found || found.hash !== definition.hash;
    });
  }

  private updateCache(project: string, definitions: SuperGraphCache[]) {
    this.superGraphCaches.set(project, definitions);
  }

  private getDefinitions(subGraphs: SubGraphEntry[]) {
    return Promise.all<SuperGraphCache>(
      subGraphs.map(async (subgraph) => {
        const schemaSDL = await this.fetchService.fetchSchema(subgraph.url);
        const hash = objectHash(schemaSDL);

        return {
          serviceDefinition: {
            name: subgraph.name,
            url: subgraph.url,
            typeDefs: parse(schemaSDL),
          },
          hash,
        };
      }),
    );
  }
}

import { composeServices } from '@apollo/composition';
import { ServiceDefinition } from '@apollo/federation-internals';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { parse } from 'graphql';
import * as objectHash from 'object-hash';
import { exhaustMap, from, interval, startWith } from 'rxjs';
import { FetchService } from 'src/supergraph/fetch.service';
import { getSubGraphsFromEnvironment } from 'src/supergraph/utils/get-sub-graphs-from-env';

type SuperGraphCache = { serviceDefinition: ServiceDefinition; hash: string };

@Injectable()
export class SupergraphService implements OnApplicationBootstrap {
  public supergraph: string | null = null;

  private superGraphCaches: SuperGraphCache[] = [];

  private readonly logger = new Logger(SupergraphService.name);
  private subGraphs: { name: string; url: string }[] = [];

  constructor(private readonly fetchService: FetchService) {}

  public onApplicationBootstrap() {
    this.subGraphs = getSubGraphsFromEnvironment();

    for (const subGraph of this.subGraphs) {
      this.logger.log(`Found subgraph: ${subGraph.name} at ${subGraph.url}`);
    }

    interval(10_000)
      .pipe(
        startWith(0),
        exhaustMap(() => from(this.updateSubGraph())),
      )
      .subscribe(() => {});
  }

  private async updateSubGraph() {
    if (this.subGraphs.length === 0) {
      throw new Error(
        'No subgraphs found in environment variables. Please define SUBGRAPH_* environment variables.',
      );
    }

    const definitions = await this.getDefinitions();
    const changedDefinitions = this.getChangedDefinitions(definitions);

    for (const definition of changedDefinitions) {
      this.logger.log(
        `Changed subgraph definition: ${definition.serviceDefinition.name}, hash=${definition.hash}`,
      );
    }

    this.updateCache(definitions);

    if (!changedDefinitions.length) {
      return;
    }

    this.logger.log(
      `Building supergraph from ${this.subGraphs.length} subgraphs`,
    );

    const result = composeServices(
      definitions.map((item) => item.serviceDefinition),
    );

    if (result.errors && result.errors.length > 0) {
      this.logger.error('Supergraph composition failed:', result.errors);
      return;
    }

    if (result.supergraphSdl) {
      this.logger.log('Supergraph built successfully');

      this.supergraph = result.supergraphSdl;
    } else {
      this.logger.error('Failed to generate supergraph SDL');
    }
  }

  private getChangedDefinitions(definitions: SuperGraphCache[]) {
    return definitions.filter((definition) => {
      const found = this.superGraphCaches.find(
        (cache) =>
          cache.serviceDefinition.name === definition.serviceDefinition.name,
      );

      return !found || found.hash !== definition.hash;
    });
  }

  private updateCache(definitions: SuperGraphCache[]) {
    this.superGraphCaches = definitions;
  }

  private getDefinitions() {
    return Promise.all<SuperGraphCache>(
      this.subGraphs.map(async (subgraph) => {
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

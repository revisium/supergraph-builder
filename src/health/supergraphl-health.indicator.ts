import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { SupergraphService } from 'src/supergraph/supergraph.service';

export interface Dog {
  name: string;
  type: string;
}

@Injectable()
export class SupergraphlHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly supergraph: SupergraphService,
  ) {}

  public isHealthy() {
    const indicator = this.healthIndicatorService.check('supergraph');
    if (!this.supergraph.isThereAnySupergraph()) {
      return indicator.down();
    }

    return indicator.up();
  }
}

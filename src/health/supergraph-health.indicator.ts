import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { SupergraphService } from 'src/supergraph/supergraph.service';

@Injectable()
export class SupergraphHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly supergraph: SupergraphService,
  ) {}

  public isHealthy() {
    const indicator = this.healthIndicatorService.check('supergraph');
    if (!this.supergraph.isThereAnySupergraph()) {
      return indicator.down('No supergraph available');
    }

    return indicator.up();
  }
}

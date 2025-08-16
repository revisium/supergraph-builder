import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SupergraphHealthIndicator } from 'src/health/supergraph-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly supergraphHealthIndicator: SupergraphHealthIndicator,
  ) {}

  @Get('liveness')
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.supergraphHealthIndicator.isHealthy(),
    ]);
  }
}

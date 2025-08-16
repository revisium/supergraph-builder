import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SupergraphlHealthIndicator } from 'src/health/supergraphl-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly supergraphlHealthIndicator: SupergraphlHealthIndicator,
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
      () => this.supergraphlHealthIndicator.isHealthy(),
    ]);
  }
}

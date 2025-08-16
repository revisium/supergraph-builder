import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from 'src/health/health.controller';
import { SupergraphlHealthIndicator } from 'src/health/supergraphl-health.indicator';
import { SupergraphModule } from 'src/supergraph/supergraph.module';

@Module({
  imports: [TerminusModule, SupergraphModule],
  controllers: [HealthController],
  providers: [SupergraphlHealthIndicator],
})
export class HealthModule {}

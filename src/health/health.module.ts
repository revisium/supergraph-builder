import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from 'src/health/health.controller';
import { SupergraphHealthIndicator } from 'src/health/supergraph-health.indicator';
import { SupergraphModule } from 'src/supergraph/supergraph.module';

@Module({
  imports: [TerminusModule, SupergraphModule],
  controllers: [HealthController],
  providers: [SupergraphHealthIndicator],
})
export class HealthModule {}

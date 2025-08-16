import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from 'src/health/health.module';
import { SupergraphModule } from 'src/supergraph/supergraph.module';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot(), HealthModule, SupergraphModule],
  providers: [AppService],
})
export class AppModule {}

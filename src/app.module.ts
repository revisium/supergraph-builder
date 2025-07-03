import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupergraphModule } from 'src/supergraph/supergraph.module';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot(), SupergraphModule],
  providers: [AppService],
})
export class AppModule {}

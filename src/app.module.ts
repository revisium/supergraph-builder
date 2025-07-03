import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupergraphModule } from 'src/supergraph/supergraph.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot(), SupergraphModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

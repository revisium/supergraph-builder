import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupergraphModule } from 'src/supergraph/supergraph.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    ConfigModule.forRoot(),
    SupergraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

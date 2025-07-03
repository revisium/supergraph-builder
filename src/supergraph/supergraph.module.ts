import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FetchService } from 'src/supergraph/fetch.service';
import { SupergraphService } from 'src/supergraph/supergraph.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [SupergraphService, FetchService],
  exports: [SupergraphService],
})
export class SupergraphModule {}

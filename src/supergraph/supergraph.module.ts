import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FetchService } from 'src/supergraph/fetch.service';
import { SupergraphService } from 'src/supergraph/supergraph.service';

@Module({
  imports: [HttpModule],
  providers: [SupergraphService, FetchService],
  exports: [SupergraphService],
})
export class SupergraphModule {}

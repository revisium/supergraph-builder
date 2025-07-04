import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FetchService } from 'src/supergraph/fetch.service';
import { SchemaStorageService } from 'src/supergraph/schema-storage.service';
import { SupergraphController } from 'src/supergraph/supergraph.controller';
import { SupergraphService } from 'src/supergraph/supergraph.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [SupergraphController],
  providers: [SupergraphService, FetchService, SchemaStorageService],
  exports: [SupergraphService],
})
export class SupergraphModule {}

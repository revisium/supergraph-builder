import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { AppService } from './app.service';
import { SupergraphService } from './supergraph/supergraph.service';

@Controller('supergraph')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supergraphService: SupergraphService,
  ) {}

  @Get(':projectId')
  @Header('Content-Type', 'text/plain')
  public getSupergraph(@Param('projectId') projectId: string) {
    const superGraph = this.supergraphService.getSuperGraph(projectId);

    if (superGraph) {
      return superGraph;
    } else {
      throw new NotFoundException('Supergraph is not available');
    }
  }
}

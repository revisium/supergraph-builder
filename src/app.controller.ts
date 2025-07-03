import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { SupergraphService } from './supergraph/supergraph.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supergraphService: SupergraphService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('supergraph')
  @Header('Content-Type', 'text/plain')
  public getSupergraph() {
    if (this.supergraphService.supergraph) {
      return this.supergraphService.supergraph;
    } else {
      throw new NotFoundException('Supergraph is not available');
    }
  }
}

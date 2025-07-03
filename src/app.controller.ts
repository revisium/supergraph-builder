import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { SupergraphService } from './supergraph/supergraph.service';

/**
 * Controller to expose composed supergraph SDLs per project.
 */
@Controller('supergraph')
export class SupergraphController {
  constructor(private readonly supergraphService: SupergraphService) {}

  /**
   * Retrieves the supergraph SDL for a given project ID or throws 404.
   */
  @Get(':projectId')
  @Header('Content-Type', 'text/plain')
  getSupergraph(@Param('projectId') projectId: string): string {
    const sdl = this.supergraphService.getSuperGraph(projectId);

    if (!sdl) {
      throw new NotFoundException(
        `Supergraph for project "${projectId}" not found`,
      );
    }

    return sdl;
  }
}

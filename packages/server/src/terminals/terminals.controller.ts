import { Controller, Post } from '@nestjs/common';
import { TerminalsService } from './terminals.service';

@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post('spawn')
  spawnTerminal() {
    return this.terminalsService.spawnClaudeTerminal();
  }
}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TerminalsModule } from './terminals/terminals.module';

@Module({
  imports: [TerminalsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

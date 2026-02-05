import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

@Injectable()
export class TerminalsService {
  spawnClaudeTerminal(): { success: boolean; message: string } {
    try {
      // Spawn a new CMD window running claude
      // Using 'start' command to open a new window, /k keeps the window open
      const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', 'claude'], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      });

      // Unref allows the parent process to exit independently
      child.unref();

      return {
        success: true,
        message: 'Claude terminal spawned successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to spawn terminal: ${error.message}`,
      };
    }
  }
}

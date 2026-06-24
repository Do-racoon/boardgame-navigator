import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminService } from './admin.service'

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // ── 신청 ──────────────────────────────────────────────────────────
  @Get('submissions')
  getSubmissions() { return this.service.getSubmissions() }

  @Patch('submissions/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; adminNote?: string }) {
    return this.service.updateSubmissionStatus(id, body.status, body.adminNote)
  }

  @Post('submissions/:id/ingest-test')
  ingestTest(@Param('id') id: string) { return this.service.ingestTest(id) }

  @Post('submissions/:id/publish')
  publish(@Param('id') id: string) { return this.service.publish(id) }

  // ── 게임 ──────────────────────────────────────────────────────────
  @Get('games')
  getGames() { return this.service.getGames() }

  @Patch('games/:id')
  updateGame(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateGame(id, body)
  }

  @Post('games/:id/reingest')
  reingest(@Param('id') id: string, @Body() body: { fileUrl: string }) {
    return this.service.reingestGame(id, body.fileUrl)
  }
}

import { Body, Controller, Delete, Get, InternalServerErrorException, Param, Patch, Post } from '@nestjs/common'
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

  @Delete('submissions/:id')
  deleteSubmission(@Param('id') id: string) { return this.service.deleteSubmission(id) }

  @Post('submissions/:id/ingest-test')
  async ingestTest(@Param('id') id: string) {
    try { return await this.service.ingestTest(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Post('submissions/:id/publish')
  async publish(@Param('id') id: string) {
    try { return await this.service.publish(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  // ── 게임 ──────────────────────────────────────────────────────────
  @Get('games')
  getGames() { return this.service.getGames() }

  @Patch('games/:id')
  async updateGame(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    try { return await this.service.updateGame(id, body) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Delete('games/:id')
  async deleteGame(@Param('id') id: string) {
    try { return await this.service.deleteGame(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Post('games/:id/reingest')
  async reingest(@Param('id') id: string, @Body() body: { fileUrl: string }) {
    try { return await this.service.reingestGame(id, body.fileUrl) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }
}

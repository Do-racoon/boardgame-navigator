import {
  Body, Controller, Delete, Get, InternalServerErrorException,
  Param, Patch, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
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
  async deleteSubmission(@Param('id') id: string) {
    try { return await this.service.deleteSubmission(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

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
  getGames(@Query('deleted') deleted?: string) {
    return this.service.getGames(deleted === 'true')
  }

  @Patch('games/:id')
  async updateGame(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    try { return await this.service.updateGame(id, body) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Patch('games/:id/trash')
  async trashGame(@Param('id') id: string) {
    try { return await this.service.trashGame(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Delete('games/:id/trash')
  async restoreGame(@Param('id') id: string) {
    try { return await this.service.restoreGame(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Delete('games/:id')
  async deleteGame(@Param('id') id: string) {
    try { return await this.service.deleteGame(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Post('games/:id/generate-setup')
  async generateSetup(@Param('id') id: string) {
    try { return await this.service.generateSetupGuide(id) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Post('games/:id/reingest')
  async reingest(@Param('id') id: string, @Body() body: { fileUrl: string }) {
    try { return await this.service.reingestGame(id, body.fileUrl) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Post('games/:id/upload-rules')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadRules(
    @Param('id') id: string,
    @Body() body: { mode: 'replace' | 'append' },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try { return await this.service.uploadExtraRules(id, body.mode ?? 'replace', file) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }
}

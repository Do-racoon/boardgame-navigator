import {
  Controller, Post, Get, Patch, Body, Param,
  UploadedFile, UseInterceptors, BadRequestException, InternalServerErrorException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiConsumes } from '@nestjs/swagger'
import { SubmissionsService } from './submissions.service'

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async create(
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const rulebookType = body['rulebookType'] as 'PDF' | 'IMAGE' | 'TEXT'
    if (!body['titleKo']) throw new BadRequestException('게임 이름은 필수입니다')
    if (rulebookType === 'TEXT' && !body['rulebookText']) throw new BadRequestException('텍스트를 입력해주세요')
    if ((rulebookType === 'PDF' || rulebookType === 'IMAGE') && !file) throw new BadRequestException('파일을 첨부해주세요')

    const genres = body['genres'] ? JSON.parse(body['genres']) : []

    try { return await this.service.create({
      titleKo: body['titleKo'],
      titleEn: body['titleEn'],
      minPlayers: body['minPlayers'] ? Number(body['minPlayers']) : undefined,
      maxPlayers: body['maxPlayers'] ? Number(body['maxPlayers']) : undefined,
      minPlayTime: body['minPlayTime'] ? Number(body['minPlayTime']) : undefined,
      maxPlayTime: body['maxPlayTime'] ? Number(body['maxPlayTime']) : undefined,
      difficulty: body['difficulty'] ? Number(body['difficulty']) : undefined,
      genres,
      rulebookType,
      rulebookText: body['rulebookText'],
      submitterEmail: body['submitterEmail'],
    }, file) } catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; adminNote?: string },
  ) {
    return this.service.updateStatus(id, body.status, body.adminNote)
  }
}

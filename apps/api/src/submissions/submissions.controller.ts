import {
  Controller, Post, Get, Patch, Body, Param,
  UploadedFiles, UseInterceptors, BadRequestException, InternalServerErrorException,
} from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiConsumes } from '@nestjs/swagger'
import { SubmissionsService } from './submissions.service'

const storage = memoryStorage()
const MAX = 50 * 1024 * 1024

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'setupImage', maxCount: 1 },
  ], { storage, limits: { fileSize: MAX } }))
  async create(
    @Body() body: Record<string, string>,
    @UploadedFiles() files?: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[]; setupImage?: Express.Multer.File[] },
  ) {
    const rulebookType = body['rulebookType'] as 'PDF' | 'IMAGE' | 'TEXT'
    if (!body['titleKo']) throw new BadRequestException('게임 이름은 필수입니다')
    if (rulebookType === 'TEXT' && !body['rulebookText']) throw new BadRequestException('텍스트를 입력해주세요')
    const rulebookFile = files?.file?.[0]
    if ((rulebookType === 'PDF' || rulebookType === 'IMAGE') && !rulebookFile) throw new BadRequestException('파일을 첨부해주세요')

    const genres = body['genres'] ? JSON.parse(body['genres']) as string[] : []

    try {
      return await this.service.create({
        titleKo: body['titleKo']!,
        titleEn: body['titleEn'],
        minPlayers: body['minPlayers'] ? Number(body['minPlayers']) : undefined,
        maxPlayers: body['maxPlayers'] ? Number(body['maxPlayers']) : undefined,
        minPlayTime: body['minPlayTime'] ? Number(body['minPlayTime']) : undefined,
        maxPlayTime: body['maxPlayTime'] ? Number(body['maxPlayTime']) : undefined,
        difficulty: body['difficulty'] ? Number(body['difficulty']) : undefined,
        description: body['description'],
        genres,
        rulebookType,
        rulebookText: body['rulebookText'],
        submitterEmail: body['submitterEmail'],
        youtubeUrl: body['youtubeUrl'],
      }, rulebookFile, files?.thumbnail?.[0], files?.setupImage?.[0])
    } catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Post('correction')
  async createCorrection(@Body() body: { gameId: string; content: string; submitterEmail?: string }) {
    if (!body.gameId || !body.content?.trim()) throw new BadRequestException('gameId와 content는 필수입니다')
    try { return await this.service.createCorrection({ gameId: body.gameId, content: body.content, submitterEmail: body.submitterEmail }) }
    catch (e) { throw new InternalServerErrorException((e as Error).message) }
  }

  @Get()
  findAll() { return this.service.findAll() }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string; adminNote?: string }) {
    return this.service.updateStatus(id, body.status, body.adminNote)
  }
}

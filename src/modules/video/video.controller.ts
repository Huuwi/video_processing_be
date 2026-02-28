
import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, UseGuards, Request, UseInterceptors, UploadedFile, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideoService } from './video.service';
import { VideoStatus } from './video.schema';
import { JwtAuthGuard } from '../user/jwt-auth.guard';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) { }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submitVideos(@Body('urls') urls: string[], @Request() req) {
    try {
      return await this.videoService.createVideos(urls, req.user._id, req.user.mail);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getVideos(
    @Query() query: { page?: number, limit?: number, search?: string, status?: VideoStatus, stage?: string, fields?: string },
    @Request() req
  ) {
    try {
      // Convert comma-separated fields to MongoDB projection object
      const projection = query.fields ? query.fields.split(',').reduce((acc, field) => ({ ...acc, [field.trim()]: 1 }), {}) : undefined;
      
      const serviceQuery = {
        page: query.page,
        limit: query.limit,
        search: query.search,
        status: query.status,
        stage: query.stage as any
      };

      return await this.videoService.findAll(req.user._id, serviceQuery, projection);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('voices')
  async getVoices(@Query('language') language: string) {
    try {
      const languageMap: Record<string, string> = {
        vietnamese: 'vi-VN',
        english: 'en-US',
        japanese: 'ja-JP',
        korean: 'ko-KR',
        chinese: 'cmn-CN',
        thai: 'th-TH',
      };
      const langCode = languageMap[language] || 'vi-VN';
      const appId = process.env.VBEE_APP_ID || '';
      const token = process.env.VBEE_TOKEN || '';

      const response = await fetch(
        `https://vbee.vn/api/public/v1/voices?voice_ownership=VBEE&language_code=${langCode}&limit=50`,
        {
          headers: {
            'app-id': appId,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      return data?.result?.voices || [];
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getVideo(@Param('id') id: string) {
    try {
      return await this.videoService.findOne(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateVideo(@Param('id') id: string, @Body() body: { title?: string }) {
    try {
      return await this.videoService.updateVideo(id, body);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/sample-presigned-url')
  async getSamplePresignedUrl(@Param('id') id: string) {
    try {
      return await this.videoService.generateSamplePresignedUrl(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download-presigned-url')
  async getDownloadPresignedUrl(@Param('id') id: string) {
    try {
      return await this.videoService.generateDownloadPresignedUrl(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download-srt')
  async downloadSrt(@Param('id') id: string, @Res() res: Response) {
    try {
      const srtContent = await this.videoService.getSrtContent(id);
      res.setHeader('Content-Disposition', `attachment; filename="subtitles.srt"`);
      res.setHeader('Content-Type', 'text/plain');
      res.send(srtContent);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/upload-logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }
      return await this.videoService.uploadLogo(id, file.buffer, file.originalname);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/save-edit')
  async saveEdit(@Param('id') id: string, @Body() editConfig: any) {
    try {
      return await this.videoService.saveEditConfig(id, editConfig);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('auto-edit')
  async autoEdit(@Body('videoIds') videoIds: string[], @Request() req) {
    try {
      const result = await this.videoService.autoEditVideos(videoIds);
      return result;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('batch-edit')
  async batchEdit(@Body() body: { videoIds: string[], editConfig: any }, @Request() req) {
    try {
      const result = await this.videoService.batchEditVideos(body.videoIds, body.editConfig);
      return result;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('apply-preset')
  async applyPreset(@Body() body: { videoIds: string[], presetId: string }, @Request() req) {
    try {
      return await this.videoService.applyPresetToVideos(req.user._id, body.videoIds, body.presetId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel-auto')
  async cancelAutoEdit(@Param('id') id: string, @Request() req) {
    try {
      return await this.videoService.cancelAutoEdit(id, req.user._id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly videoService: VideoService) { }

  @Post('n8n-complete')
  async n8nComplete(@Body() body: { videoId: string; audioKey: string }) {
    try {
      return await this.videoService.handleN8nComplete(body.videoId, body.audioKey);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

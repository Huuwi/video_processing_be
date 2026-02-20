import { Controller, Post, Get, Body, Param, UseInterceptors, UploadedFile, Res, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from '../minio/minio.service';
import type { Response } from 'express';
import { JwtAuthGuard } from '../user/jwt-auth.guard';

@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    try {
      const ext = file.originalname.split('.').pop();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileKey = `uploads/${timestamp}-${randomString}.${ext}`;
      
      const contentType = file.mimetype || 'application/octet-stream';
      
      await this.minioService.uploadFile(fileKey, file.buffer, contentType);
      
      return { key: fileKey };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate a presigned PUT URL for direct audio upload to MinIO.
   * Max file size is enforced on the frontend (10MB).
   * Only .mp3 files are accepted.
   */
  @UseGuards(JwtAuthGuard)
  @Post('audio-presign-url')
  async getAudioPresignUrl(@Body() body: { filename: string }) {
    const { filename } = body;

    if (!filename) {
      throw new HttpException('filename is required', HttpStatus.BAD_REQUEST);
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext !== 'mp3') {
      throw new HttpException('Only MP3 files are accepted', HttpStatus.BAD_REQUEST);
    }

    try {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileKey = `uploads/audio/${timestamp}-${randomString}.mp3`;

      // Presigned PUT URL valid for 15 minutes
      const uploadUrl = await this.minioService.getPresignedPutUrl(fileKey, 900);

      return { uploadUrl, fileKey };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate a presigned PUT URL for direct logo image upload to MinIO.
   * Accepted: png, jpg, jpeg, gif, webp
   */
  @UseGuards(JwtAuthGuard)
  @Post('logo-presign-url')
  async getLogoPresignUrl(@Body() body: { filename: string }) {
    const { filename } = body;

    if (!filename) {
      throw new HttpException('filename is required', HttpStatus.BAD_REQUEST);
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    if (!ext || !allowed.includes(ext)) {
      throw new HttpException('Only image files are accepted (png, jpg, jpeg, gif, webp)', HttpStatus.BAD_REQUEST);
    }

    try {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileKey = `uploads/logos/${timestamp}-${randomString}.${ext}`;

      // Presigned PUT URL valid for 15 minutes
      const uploadUrl = await this.minioService.getPresignedPutUrl(fileKey, 900);

      return { uploadUrl, fileKey };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('*key')
  async getFile(@Param('key') key: string, @Res() res: Response) {
    try {
      const fileKey = Array.isArray(key) ? key.join('/') : key;
      const fileStream = await this.minioService.getFileStream(fileKey);
      
      res.setHeader('Content-Type', 'application/octet-stream'); // Fallback
      
      fileStream.pipe(res);
    } catch (error) {
      console.error('Get file error:', error);
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
  }
}

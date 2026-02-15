import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, Res, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
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

  @Get('*key')
  async getFile(@Param('key') key: string, @Res() res: Response) {
    try {
      const fileKey = Array.isArray(key) ? key.join('/') : key;
      const fileStream = await this.minioService.getFileStream(fileKey);
      
      // Determine content type based on extension (simple approach) or use Minio metadata
      // For now, MinIO client might return metadata? 
      // getObject returns a ReadableStream. statObject returns metadata.
      
      res.setHeader('Content-Type', 'application/octet-stream'); // Fallback
      // You might want to lookup mime type or get from minio stat.
      
      fileStream.pipe(res);
    } catch (error) {
      console.error('Get file error:', error);
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
  }
}

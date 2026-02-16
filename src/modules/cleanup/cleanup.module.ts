import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from '../video/video.schema';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    MinioModule,
  ],
  providers: [CleanupService],
})
export class CleanupModule {}

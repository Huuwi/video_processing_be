import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [MinioModule],
  controllers: [FilesController],
})
export class FilesModule {}

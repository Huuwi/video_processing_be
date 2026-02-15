import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoController, WebhookController } from './video.controller';
import { VideoService } from './video.service';
import { Video, VideoSchema } from './video.schema';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { MinioModule } from '../minio/minio.module';
import { EditPresetModule } from '../edit-preset/edit-preset.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    RabbitMQModule,
    MinioModule,
    EditPresetModule,
  ],
  controllers: [VideoController, WebhookController],
  providers: [VideoService],
})
export class VideoModule {}

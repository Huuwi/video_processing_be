import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { VideoModule } from './modules/video/video.module';
import { UserModule } from './modules/user/user.module';
import { RabbitMQModule } from './modules/rabbitmq/rabbitmq.module';
import { EditPresetModule } from './modules/edit-preset/edit-preset.module';
import { FilesModule } from './modules/files/files.module';


@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.CONNECTION_STRING || 'mongodb://localhost:27017/video-processing'),
    VideoModule,
    UserModule,
    RabbitMQModule,
    EditPresetModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

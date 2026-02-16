import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VideoModule } from './modules/video/video.module';
import { UserModule } from './modules/user/user.module';
import { RabbitMQModule } from './modules/rabbitmq/rabbitmq.module';
import { EditPresetModule } from './modules/edit-preset/edit-preset.module';
import { FilesModule } from './modules/files/files.module';
import { PaymentModule } from './modules/payment/payment.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('CONNECTION_STRING') || 'mongodb://mongo:27017/video_processing',
      }),
      inject: [ConfigService],
    }),
    VideoModule,
    UserModule,
    RabbitMQModule,
    EditPresetModule,
    RabbitMQModule,
    EditPresetModule,
    FilesModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

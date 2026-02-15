import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EditPresetController } from './edit-preset.controller';
import { EditPresetService } from './edit-preset.service';
import { EditPreset, EditPresetSchema } from './edit-preset.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EditPreset.name, schema: EditPresetSchema },
    ]),
  ],
  controllers: [EditPresetController],
  providers: [EditPresetService],
  exports: [EditPresetService], // Export for use in video module
})
export class EditPresetModule {}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EditPresetDocument = EditPreset & Document;

@Schema({ timestamps: true })
export class EditPreset {
  @Prop({ required: true })
  name: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: Object,
    required: true
  })
  config: {
    logo?: {
      file_key: string;
      position_x: number;
      position_y: number;
      scale: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    subtitle: {
      color: string;
      bg_color: string;
      position: 'top' | 'middle' | 'bottom';
      position_x: number;
      position_y: number;
      font_size: number;
      width_percent: number;
    };
    language: string;
    voice_code: string;
    resize_mode: '9:16' | '16:9';
  };

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;
}

export const EditPresetSchema = SchemaFactory.createForClass(EditPreset);

// Index for querying user's presets
EditPresetSchema.index({ userId: 1, name: 1 });
EditPresetSchema.index({ userId: 1, isDefault: 1 });

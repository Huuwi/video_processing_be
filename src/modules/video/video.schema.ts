
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum VideoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'inprogress',
  FAILED = 'failed',
  COMPLETED = 'completed',
}

export enum VideoStage {
  DOWNLOAD = 'download',
  USER_EDITING = 'user_editing',
  AI_PROCESS = 'ai_process',
  EDIT_PROCESS = 'edit_process',
}

@Schema()
export class UserEditingMeta {
  @Prop({ type: Object })
  logo: {
    file_key: string;
    position_x: number;
    position_y: number;
    scale: number;
  };

  @Prop({ type: Object })
  subtitle: {
    color: string;
    bg_color: string;
    font_size: number;
    position: string; // 'top', 'middle', 'bottom'
    position_x: number;
    position_y: number;
    width_percent: number;
  };

  @Prop({ type: Object })
  bg_music: {
    file_key: string;
  };

  @Prop({ default: '9:16' })
  resize_mode: string;
}

@Schema({ timestamps: true })
export class Video extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userId: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  douyin_link: string;

  @Prop()
  download_link: string;

  @Prop()
  s3_key: string;

  @Prop()
  description: string;

  @Prop()
  title: string;

  @Prop()
  errorMsg: string;

  @Prop([Object])
  comments: any[];

  @Prop()
  audio_processed: string;

  @Prop({ type: String, enum: VideoStatus, default: VideoStatus.PENDING })
  status: VideoStatus;

  @Prop({ type: String, enum: VideoStage, default: VideoStage.DOWNLOAD })
  stage: VideoStage;

  @Prop({ type: Object })
  sub: {
    sample: string;
    full: string;
    audios: Array<{
      audio_key: string;
      file_index: number;
      srt_output: string;
    }>;
    srt_concatenated?: string;
  };

  @Prop({ type: UserEditingMeta })
  user_editing_meta: UserEditingMeta;

  @Prop({ default: false })
  auto_edit: boolean;

  @Prop({ default: false })
  batch_edit: boolean;

  @Prop({ default: 'vietnamese' })
  language: string;

  @Prop()
  voice_code: string;

  @Prop({ default: false })
  raw_cleaned: boolean;
}

export type VideoDocument = Video & Document;

export const VideoSchema = SchemaFactory.createForClass(Video);

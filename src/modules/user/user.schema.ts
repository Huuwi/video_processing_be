
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  nickname: string;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ default: 180000 }) // 3 minutes
  remaining_time_ms: number;

  @Prop()
  phone: string;

  @Prop({ required: true, unique: true })
  mail: string;

  @Prop({ default: false })
  vip: boolean;

  @Prop()
  avatar: string;

  @Prop()
  googleAccessToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

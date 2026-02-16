import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, unique: true })
  orderCode: number;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop()
  checkoutUrl: string;

  @Prop({ type: Object })
  webhookData: any;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

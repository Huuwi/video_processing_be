
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './payment.schema';
import { User, UserDocument } from '../user/user.schema';
import { ConfigService } from '@nestjs/config';
const { PayOS } = require('@payos/node');


@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private payOS: any;
  private readonly vndPerMinute: number;

  // Define packages as the source of truth
  private readonly PACKAGES = [
    { amount: 30000, minutes: 10, bonusMinutes: 0 },
    { amount: 50000, minutes: 16.6, bonusMinutes: 2 },
    { amount: 100000, minutes: 33.3, bonusMinutes: 5 },
    { amount: 500000, minutes: 166.6, bonusMinutes: 30 },
  ];

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.payOS = new PayOS({
      clientId: this.configService.get<string>('PAYOS_CLIENT_ID'),
      apiKey: this.configService.get<string>('PAYOS_API_KEY'),
      checksumKey: this.configService.get<string>('PAYOS_CHECKSUM_KEY'),
    });
    this.vndPerMinute = Number.parseInt(this.configService.get<string>('VND_PER_MINUTES', '3000'));
  }

  async createPaymentLink(user: any, amount: number, redirectUrl: string) {
    const orderCode = Number(String(Date.now()).slice(-6));
    
    // Validate amount against defined packages
    const selectedPackage = this.PACKAGES.find(pkg => pkg.amount === amount);
    if (!selectedPackage) {
        throw new BadRequestException('Invalid amount. Please select a valid package.');
    }

    const paymentLinkData = {
      orderCode: orderCode,
      amount: amount,
      description: `Nap tien ${orderCode}`,
      items: [
        {
          name: "Xu ly video",
          quantity: 1,
          price: amount,
        },
      ],
      returnUrl: `${redirectUrl}?status=success&orderCode=${orderCode}`,
      cancelUrl: `${redirectUrl}?status=cancelled&orderCode=${orderCode}`,
    };

    try {
      const paymentLink = await this.payOS.paymentRequests.create(paymentLinkData);
      
      await this.paymentModel.create({
        orderCode,
        amount,
        userId: user._id,
        status: PaymentStatus.PENDING,
        checkoutUrl: paymentLink.checkoutUrl,
      });

      return {
        checkoutUrl: paymentLink.checkoutUrl,
        orderCode: orderCode
      };
    } catch (error) {
      this.logger.error(`Error creating payment link: ${error.message}`);
      throw new BadRequestException('Could not create payment link');
    }
  }

  async handleWebhook(webhookData: any) {
    this.logger.log(`Webhook received raw: ${JSON.stringify(webhookData)}`);
    try {
      await this.payOS.webhooks.verify(webhookData);
      this.logger.log('Webhook verified successfully');
      
      const { orderCode, amount, code } = webhookData.data;
      this.logger.log(`Processing webhook for orderCode: ${orderCode}, amount: ${amount}, code: ${code}`);

      if (code === '00') { // Success
        const payment = await this.paymentModel.findOne({ orderCode });
        if (!payment) {
          this.logger.warn(`Payment with orderCode ${orderCode} not found`);
          return;
        }

        this.logger.log(`Found payment: ${JSON.stringify(payment)}`);

        if (payment.status === PaymentStatus.PAID) {
          this.logger.log('Payment already processed');
          return; // Already processed
        }

        await this._processSuccessfulPayment(payment, amount, webhookData);
      } else {
        this.logger.warn(`Webhook received with non-success code: ${code}`);
      }
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      return { success: false, message: error.message }; 
    }
  }

  async verifyPayment(user: any, orderCode: number) {
    try {
      const payment = await this.paymentModel.findOne({ orderCode, userId: user._id });
        
      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (payment.status === PaymentStatus.PAID) {
        return { success: true, status: 'PAID' };
      }

      // Call PayOS to get status
      const paymentInfo = await this.payOS.paymentRequests.get(orderCode);
        
      if (!paymentInfo || paymentInfo.status !== 'PAID') {
         return { success: false, status: paymentInfo?.status || 'PENDING' };
      }

      // If PAID on PayOS but PENDING in DB, process it
      await this._processSuccessfulPayment(payment, paymentInfo.amount, paymentInfo);
        
      return { success: true, status: 'PAID' };

    } catch (error) {
        this.logger.error(`Verify payment error: ${error.message}`);
        throw new BadRequestException('Could not verify payment');
    }
  }

  private async _processSuccessfulPayment(payment: PaymentDocument, amount: number, transactionData: any) {
        // Find package to calculate total minutes
        const selectedPackage = this.PACKAGES.find(pkg => pkg.amount === amount);
        
        if (!selectedPackage) {
            this.logger.error(`Processed payment with invalid amount: ${amount}`);
            return; 
        }

        this.logger.log(`Selected package: ${JSON.stringify(selectedPackage)}`);

        const baseMinutes = Math.floor(amount / this.vndPerMinute);
        const totalMinutes = baseMinutes + selectedPackage.bonusMinutes;
        
        const addedTimeMs = totalMinutes * 60 * 1000;
        
        this.logger.log(`Adding ${addedTimeMs}ms to user ${payment.userId}`);

        // Update User
        const updatedUser = await this.userModel.findByIdAndUpdate(payment.userId, {
            $inc: { 
                remaining_time_ms: addedTimeMs,
                total_deposited_vnd: amount 
            }
        }, { new: true });
        
        this.logger.log(`User updated: ${updatedUser ? updatedUser.remaining_time_ms : 'failed'}`);

        // Update Payment
        payment.status = PaymentStatus.PAID;
        payment.webhookData = transactionData;
        await payment.save();

        this.logger.log(`Processed payment ${payment.orderCode}: +${totalMinutes} minutes for user ${payment.userId}`);
  }
}

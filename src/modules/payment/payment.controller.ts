
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../user/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-link')
  async createLink(@Req() req, @Body() body: { amount: number; redirectUrl: string }) {
    return this.paymentService.createPaymentLink(req.user, body.amount, body.redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verifyPayment(@Req() req, @Body() body: { orderCode: number }) {
    return this.paymentService.verifyPayment(req.user, body.orderCode);
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    console.log('Webhook received:', JSON.stringify(body));
    return this.paymentService.handleWebhook(body);
  }
}

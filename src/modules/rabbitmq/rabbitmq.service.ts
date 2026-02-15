import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async connectWithRetry(retries = 5, delay = 3000) {
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempting to connect to RabbitMQ (${i + 1}/${retries})...`);
            this.connection = await connect(amqpUrl) as any;
            this.channel = await this.connection.createChannel();
            
            // Assert queues
            await this.channel.assertQueue('topic_download', { durable: true });
            await this.channel.assertQueue('topic_user_edting', { durable: true });
            await this.channel.assertQueue('topic_ai_process', { durable: true });
            await this.channel.assertQueue('topic_edit_process', { durable: true });
            await this.channel.assertQueue('topic_text_to_speech', { durable: true });
            await this.channel.assertQueue('topic_speech_to_audio', { durable: true });
            
            console.log('RabbitMQ Service connected successfully');
            return;
        } catch (error) {
            console.error(`Failed to connect to RabbitMQ (Attempt ${i + 1}): ${error.message}`);
            if (i === retries - 1) {
                console.error('All connection attempts failed');
                // Don't throw to prevent app crash, just log. 
                // Or maybe throw if it's critical? Let's just log for now to allow app to start.
            }
            await new Promise(res => setTimeout(res, delay));
        }
    }
  }

  async onModuleDestroy() {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
  }

  async sendToQueue(queue: string, message: any) {
      if (!this.channel) {
          console.error('RabbitMQ channel not available');
          return;
      }
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }
}

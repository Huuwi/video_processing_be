import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async connectWithRetry(retries = 10, delay = 5000) {
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempting to connect to RabbitMQ (${i + 1}/${retries})...`);
            this.connection = await connect(amqpUrl) as any;
            
            this.connection.on('error', (err) => {
              console.error('RabbitMQ connection error:', err);
              this.channel = null;
              this.connectWithRetry();
            });

            this.connection.on('close', () => {
              console.warn('RabbitMQ connection closed. Reconnecting...');
              this.channel = null;
              this.connectWithRetry();
            });

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
                console.error('All RabbitMQ connection attempts failed');
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
          console.error('RabbitMQ channel not available, attempting to send later...');
          await this.connectWithRetry(1, 0); // Try immediate reconnect
          if (!this.channel) return;
      }
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
  }
}

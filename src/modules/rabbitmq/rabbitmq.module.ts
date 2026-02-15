
import { Module, Global } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

@Global() // Make it global so we don't have to import it everywhere if we use it a lot, or just standard. 
// Let's stick to standard module import for clarity, deleting Global if needed. But Global is handy for Utils.
// Let's keep it standard first.
@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}

import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { SmsModule } from '../sms/sms.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [SmsModule, WebsocketModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;
  private twilioClient: any;

  constructor(private configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.phoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    // Initialize Twilio client if credentials are provided
    if (this.accountSid && this.authToken) {
      try {
        // Dynamic import to avoid requiring twilio if not configured
        const twilio = require('twilio');
        this.twilioClient = twilio(this.accountSid, this.authToken);
      } catch (error) {
        console.warn('Twilio not installed. SMS functionality will be disabled.');
      }
    }
  }

  async sendQueueConfirmation(
    phoneNumber: string,
    ticketNo: string,
    peopleAhead: number,
  ): Promise<void> {
    const message = `Hello! Your ticket is ${ticketNo}. There are ${peopleAhead} people ahead of you.`;

    if (!this.twilioClient) {
      console.log(`[SMS Mock] To: ${phoneNumber}, Message: ${message}`);
      return;
    }

    try {
      await this.twilioClient.messages.create({
        body: message,
        from: this.phoneNumber,
        to: phoneNumber,
      });
    } catch (error) {
      console.error('Failed to send SMS:', error);
      // Don't throw - SMS failure shouldn't break queue joining
    }
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private username: string;
  private apiKey: string;
  private senderId: string;
  private smsClient: any;

  constructor(private configService: ConfigService) {
    this.username = this.configService.get<string>('AFRICASTALKING_USERNAME');
    this.apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY');
    this.senderId = this.configService.get<string>('AFRICASTALKING_SENDER_ID');

    // Initialize Africa's Talking client if credentials are provided.
    if (this.username && this.apiKey) {
      try {
        const AfricasTalking = require('africastalking');
        const client = AfricasTalking({
          apiKey: this.apiKey,
          username: this.username,
        });
        this.smsClient = client.SMS;
      } catch (error) {
        console.warn("Africa's Talking SDK not installed. SMS functionality will be disabled.");
      }
    }
  }

  async sendQueueConfirmation(
    phoneNumber: string,
    ticketNo: string,
    peopleAhead: number,
  ): Promise<void> {
    const message = `Hello! Your ticket is ${ticketNo}. There are ${peopleAhead} people ahead of you.`;

    await this.sendSms(phoneNumber, message);
  }

  async sendCustomerCalled(phoneNumber: string, ticketNo: string, serviceName: string): Promise<void> {
    const message = `Hello! Ticket ${ticketNo}, it's your turn now for ${serviceName}. Please proceed to the service desk.`;
    await this.sendSms(phoneNumber, message);
  }

  private async sendSms(phoneNumber: string, message: string): Promise<void> {
    const normalizedPhoneNumber = this.normalizePhoneNumber(phoneNumber);
    if (!normalizedPhoneNumber) {
      console.warn(`[SMS] Skipping send. Invalid phone number format: ${phoneNumber}`);
      return;
    }

    if (!this.smsClient) {
      console.log(`[SMS Mock] To: ${normalizedPhoneNumber}, Message: ${message}`);
      return;
    }

    const payload: { to: string[]; message: string; from?: string } = {
      to: [normalizedPhoneNumber],
      message,
    };

    if (this.senderId) {
      payload.from = this.senderId;
    }

    try {
      await this.smsClient.send(payload);
    } catch (error) {
      console.error('Failed to send SMS:', error);
      // Don't throw - SMS failure shouldn't break queue operations.
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string | null {
    const digits = phoneNumber.replace(/[^\d+]/g, '');

    if (digits.startsWith('+') && /^\+\d{10,15}$/.test(digits)) {
      return digits;
    }

    if (digits.startsWith('00')) {
      const international = `+${digits.slice(2)}`;
      if (/^\+\d{10,15}$/.test(international)) {
        return international;
      }
    }

    // Accept Kenya local formats and normalize to E.164.
    if (/^254\d{9}$/.test(digits)) {
      return `+${digits}`;
    }
    if (/^0\d{9}$/.test(digits)) {
      return `+254${digits.slice(1)}`;
    }
    if (/^7\d{8}$/.test(digits)) {
      return `+254${digits}`;
    }

    return null;
  }
}

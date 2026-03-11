import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  broadcastQueueUpdate(branchId: string, serviceId?: string | null) {
    const suffix = serviceId ? `:${serviceId}` : '';
    this.server.emit(`queue-update:${branchId}${suffix}`, {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTicketUpdate(branchId: string, ticket: any, serviceId?: string | null) {
    const suffix = serviceId ? `:${serviceId}` : '';
    this.server.emit(`ticket-update:${branchId}${suffix}`, ticket);
  }
}

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

  broadcastQueueUpdate(branchId: string) {
    this.server.emit(`queue-update:${branchId}`, {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTicketUpdate(branchId: string, ticket: any) {
    this.server.emit(`ticket-update:${branchId}`, ticket);
  }
}

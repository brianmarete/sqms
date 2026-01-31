# SQMS Backend API

Smart Queue Management System - NestJS Backend

## Tech Stack

- **NestJS** - Node.js framework
- **PostgreSQL** - Database
- **Prisma** - ORM
- **Redis** - Queue management
- **Socket.io** - WebSocket for real-time updates
- **Twilio** - SMS notifications

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up PostgreSQL database:
```bash
# Create database
createdb sqms

# Push Prisma schema to database (use this if you don't have permission for migrations)
npm run prisma:db-push

# OR use migrations (requires shadow database permissions)
npm run prisma:migrate
```

4. Seed the database with a default branch:
```bash
npm run prisma:seed
```

5. Start Redis server:
```bash
redis-server
```

6. (Optional) Install Twilio for SMS functionality:
```bash
npm install twilio
```

7. Start the development server:
```bash
npm run start:dev
```

**Note:** SMS functionality will work in mock mode (logs to console) if Twilio is not installed or configured.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number
- `PORT` - Server port (default: 3000)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3001)

## API Endpoints

### Queue Management

- `POST /queue/join` - Join the queue
- `GET /queue/active?branchId=<id>` - Get active queue
- `PATCH /queue/call-next?branchId=<id>` - Call next customer
- `PATCH /queue/complete/:ticketId` - Complete a ticket
- `PATCH /queue/cancel/:ticketId?reason=<reason>` - Cancel a ticket

### Analytics

- `GET /analytics/daily?branchId=<id>&date=<YYYY-MM-DD>` - Get daily statistics

## Database Schema

See `prisma/schema.prisma` for the complete schema.

## Prisma Commands

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:db-push` - Push schema to database (no migrations)
- `npm run prisma:migrate` - Run migrations (requires shadow database)
- `npm run prisma:seed` - Seed database with default branch
- `npm run prisma:studio` - Open Prisma Studio

# Smart Queue Management System (SQMS)

A virtual queuing solution designed for small businesses. Replace physical lines with digital tickets, providing real-time updates to customers via SMS and a live management dashboard for staff.

## 🏗️ Project Structure

```
sqms/
├── backend/          # NestJS API server
├── frontend/         # Next.js web application
└── requirements.md   # Project requirements and specifications
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database and Redis credentials
```

4. Set up the database:
```bash
# Create PostgreSQL database
createdb sqms

# Run Prisma migrations
npm run prisma:generate
npm run prisma:migrate
```

5. Start Redis server:
```bash
redis-server
```

6. Start the backend server:
```bash
npm run start:dev
```

The backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local if your backend URL is different
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3001`

## 📋 Features

### Customer Kiosk
- Join queue with name, phone, and service type
- Receive digital ticket with queue position
- Get SMS confirmation with estimated wait time
- Real-time queue updates

### Staff Dashboard
- Live queue view with real-time updates via WebSocket
- Call next customer functionality
- Complete or mark tickets as no-show
- Queue position tracking
- Service analytics

## 🛠️ Tech Stack

### Backend
- **NestJS** - Node.js framework
- **PostgreSQL** - Database
- **Prisma** - ORM
- **Redis** - Queue management
- **Socket.io** - WebSocket for real-time updates
- **Twilio** - SMS notifications (optional)

### Frontend
- **Next.js 14+** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Socket.io Client** - Real-time WebSocket connections

## 📡 API Endpoints

### Queue Management
- `POST /queue/join` - Join the queue
- `GET /queue/active?branchId=<id>` - Get active queue
- `PATCH /queue/call-next?branchId=<id>` - Call next customer
- `PATCH /queue/complete/:ticketId` - Complete a ticket
- `PATCH /queue/cancel/:ticketId?reason=<reason>` - Cancel a ticket

### Analytics
- `GET /analytics/daily?branchId=<id>&date=<YYYY-MM-DD>` - Get daily statistics

## 🗄️ Database Schema

The system uses two main models:

- **Branch** - Business locations
- **Ticket** - Customer queue tickets with status tracking

See `backend/prisma/schema.prisma` for the complete schema.

## 🔧 Configuration

### Backend Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `TWILIO_ACCOUNT_SID` - Twilio account SID (optional)
- `TWILIO_AUTH_TOKEN` - Twilio auth token (optional)
- `TWILIO_PHONE_NUMBER` - Twilio phone number (optional)
- `PORT` - Server port (default: 3000)

### Frontend Environment Variables
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3000)
- `NEXT_PUBLIC_SOCKET_URL` - WebSocket server URL (default: http://localhost:3000)

## 📝 Notes

- The default branch ID is hardcoded as `'default-branch'` in both frontend pages. In production, this should come from authentication or configuration.
- SMS functionality works in mock mode (logs to console) if Twilio is not configured.
- Make sure to create at least one Branch record in the database before using the system.

## 📚 Documentation

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [Requirements](./requirements.md)

## 🎯 Next Steps

1. Set up a default branch in the database
2. Configure Twilio for SMS notifications (optional)
3. Add authentication/authorization ✅ (basic staff login + role/branch guards)
4. Deploy to production

## 🔐 Staff Authentication (Dashboard)

- **Login UI**: `http://localhost:3001/login` (dashboard at `http://localhost:3001/dashboard` is protected)
- **Backend endpoints**:
  - `POST /auth/login` (sets HttpOnly cookie `sqms_staff`)
  - `POST /auth/logout`
  - `GET /auth/me`
- **Protected APIs**:
  - `PATCH /queue/call-next`
  - `PATCH /queue/complete/:ticketId`
  - `PATCH /queue/cancel/:ticketId`
  - `GET /analytics/daily`

### Default staff user (dev)

After running Prisma migrate + seed, you can log in with:

- **Email**: `admin@sqms.local`
- **Password**: `admin123`

You can override these via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`.

## 📄 License

ISC


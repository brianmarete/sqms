# SQMS Frontend

Smart Queue Management System - Next.js Frontend

## Tech Stack

- **Next.js 14+** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Socket.io Client** - Real-time WebSocket connections
- **Axios** - HTTP client

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your backend URL
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3000)
- `NEXT_PUBLIC_SOCKET_URL` - WebSocket server URL (default: http://localhost:3000)

## Pages

### Home (`/`)
Landing page with links to Kiosk and Dashboard

### Customer Kiosk (`/kiosk`)
- Join queue form
- Customer name, phone, and service type input
- Ticket confirmation with queue position and estimated wait time
- SMS confirmation (sent automatically by backend)

### Staff Dashboard (`/dashboard`)
- Real-time queue view (updates via WebSocket)
- Currently serving customer display
- Call next customer button
- Complete/No-show actions
- Queue position tracking

## Features

- **Real-time Updates**: Uses Socket.io to receive live queue updates
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **Type Safety**: Full TypeScript support

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Project Structure

```
frontend/
├── app/
│   ├── dashboard/          # Staff dashboard page
│   ├── kiosk/              # Customer kiosk page
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/
│   └── ui/                 # shadcn/ui components
├── hooks/
│   └── use-socket.ts       # WebSocket hook
├── lib/
│   ├── api.ts              # API client
│   └── utils.ts            # Utility functions
└── public/                 # Static assets
```

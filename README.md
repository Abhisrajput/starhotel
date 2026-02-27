# Star Hotel V — Modernized Room Booking System

A full-stack web application modernizing the legacy VB6 Star Hotel Room Booking System. Built with **React.js 18** (frontend), **Node.js 20 + Express.js** (backend), and **PostgreSQL 16** (database).

## Quick Start

### Prerequisites
- **Docker** + **Docker Compose** (recommended)
- OR: Node.js 20+, PostgreSQL 16

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost
- Backend API: http://localhost:3001
- Default login: **ADMIN / admin**

### Option 2: Local Development

**1. Start PostgreSQL** (ensure running on localhost:5432)

```bash
# Create database
createdb -U postgres starhotel
```

**2. Backend**

```bash
cd backend
cp .env .env.local     # Edit if needed
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Backend runs at http://localhost:3001

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Default Credentials

| User ID | Password | Role          |
|---------|----------|---------------|
| ADMIN   | admin    | Administrator |
| CLERK   | clerk    | Clerk         |

## Technology Stack

| Layer        | Technology                  |
|--------------|-----------------------------|
| Frontend     | React 18, TypeScript, MUI 5 |
| State Mgmt   | TanStack React Query, Context API |
| Backend      | Node.js 20, Express.js, TypeScript |
| ORM          | Prisma                      |
| Database     | PostgreSQL 16               |
| Auth         | JWT + bcrypt                |
| Real-time    | Socket.IO                   |
| Containerization | Docker + Docker Compose |

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── app.ts                  # Express entry point
│   │   ├── modules/
│   │   │   ├── auth/               # Login, JWT, RBAC (C1)
│   │   │   ├── rooms/              # Room CRUD, status SM (C2)
│   │   │   ├── bookings/           # Booking lifecycle (C3+C4)
│   │   │   ├── admin/              # Company, users (C6)
│   │   │   ├── reports/            # Reports (C5)
│   │   │   └── dashboard/          # Socket.IO gateway (C7)
│   │   └── shared/                 # Database, logger, errors
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema
│   │   └── seed.ts                 # Demo data
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx                # React entry
│   │   ├── App.tsx                 # Router + auth guards
│   │   ├── contexts/AuthContext.tsx # Auth state (replaces VB6 globals)
│   │   ├── pages/                  # LoginPage, DashboardPage, BookingPage, etc.
│   │   ├── hooks/                  # useSocket, useIdleTimeout
│   │   └── utils/api.ts            # Axios API client
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Endpoint                      | Description                 |
|--------|-------------------------------|-----------------------------|
| POST   | /api/auth/login               | User login (BR-7)           |
| PUT    | /api/auth/change-password     | Change password (BR-8, BR-17) |
| GET    | /api/rooms                    | List all rooms              |
| PUT    | /api/rooms/:id/status         | Update room status (BR-1)   |
| POST   | /api/bookings                 | Create booking (BR-3, BR-6) |
| POST   | /api/bookings/:id/check-in    | Check-in (BR-2)             |
| POST   | /api/bookings/:id/check-out   | Check-out (BR-2, BR-4)      |
| POST   | /api/bookings/:id/payment     | Process payment             |
| GET    | /api/bookings/:id/receipt     | Get receipt data (BR-14)    |
| GET    | /api/reports/daily            | Daily booking report        |
| GET    | /api/admin/users              | List users (admin only)     |
| GET    | /api/dashboard/status         | Dashboard room grid         |
| WS     | /socket.io                    | Real-time room updates (BR-15) |
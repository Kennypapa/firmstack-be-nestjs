# Firmstack Backend

NestJS API for [Firmstack](https://github.com) — a multi-tenant SaaS platform for business operations and finances.

## Stack

- NestJS 11
- PostgreSQL + Prisma
- JWT authentication (Phase 1)
- Swagger at `/docs`

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init
npm run start:dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio |

## API

- Base URL: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- Health check: `GET /api/v1/health`

## Project structure

```
src/
├── config/           # Environment configuration
├── modules/          # Feature modules (auth, invoices, etc.)
├── prisma/           # Database service
└── main.ts
prisma/
└── schema.prisma     # Database schema
```

## License

UNLICENSED — private project

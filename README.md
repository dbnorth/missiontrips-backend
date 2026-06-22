# Mission Trips Backend

Node.js REST API for the Mission Trip System (organizations, trips, participants, donors, donations).

## Stack

- Node.js, Express, Sequelize, MySQL
- JWT + session table (4-hour sessions)
- Multi-tenant org isolation enforced in API

## Setup

1. Create MySQL database: `missiontrips`
2. Copy `.env.example` to `.env` and set DB credentials
3. Install and seed:

```bash
npm install
npm run seed
npm start
```

API base: `http://localhost:3200/missiontrips/`

Default admin (dev seed): `admin@missiontrips.local` / `admin12345`

## Scripts

- `npm start` — run server
- `npm run seed` — seed roles and admin user
- `npm run bundle` — prepare deploy folder

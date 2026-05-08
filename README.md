#  BladeOps
## Offshore Helicopter Operations Management System

---

## Stack
- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React (Create React App)
- **Auth**: JWT (bcrypt)
- **PDF**: Puppeteer
- **DB**: PostgreSQL (Supabase compatible)

---

## Quick Start

### 1. Install dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your DB credentials and JWT_SECRET
```

### 3. Setup database
```bash
npm run db:setup
```

### 4. Run development
```bash
# Terminal 1 — Backend
npm run dev

# Terminal 2 — Frontend
cd frontend && npm start
```

App available at: http://localhost:3001  
API at: http://localhost:3000/api

---

## Default Credentials
| Role    | Email                    | Password     |
|---------|--------------------------|--------------|
| Admin   | admin@bladeops.ao         | Admin@2024!  |
| Pilot   | c.mendes@bladeops.ao      | Admin@2024!  |
| Copilot | j.ferreira@bladeops.ao    | Admin@2024!  |

---

## Project Structure
```
bladeops-aviation/
├── backend/
│   ├── config/database.js
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── pilots.routes.js
│   │   ├── aircraft.routes.js
│   │   ├── destinations.routes.js
│   │   ├── dayOperations.routes.js
│   │   ├── flights.routes.js
│   │   ├── export.routes.js
│   │   ├── alerts.routes.js
│   │   └── editLogs.routes.js
│   ├── utils/
│   │   ├── calculations.js
│   │   └── pdf.js
│   └── server.js
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── setup.js
├── frontend/
│   ├── public/index.html
│   └── src/
│       ├── api/
│       ├── context/
│       ├── hooks/
│       ├── components/
│       └── pages/
├── .env.example
└── package.json
```

---

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/pilots | List pilots |
| POST | /api/pilots | Create pilot (admin) |
| GET | /api/aircraft | List aircraft |
| GET | /api/destinations | List + distances |
| GET | /api/day-operations | List operations |
| POST | /api/day-operations | Open day |
| GET | /api/day-operations/:id | Full detail |
| PATCH | /api/day-operations/:id/close | Close day |
| POST | /api/flights | Add flight |
| PUT | /api/flights/:id | Edit + propagate fuel |
| GET | /api/alerts | All alerts |
| GET | /api/export/pdf/:id | Export TECHLOG PDF |

# DUMMR Services Frontend

Frontend application for DUMMR Services, an independent services marketplace connecting service providers and clients.

## Features

- **Home & Explore**: Category filters, service cards, search, and detail views with tiered pricing (Basic, Standard, Premium).
- **Authentication**: Sign in, sign up, role selection (`provider` or `client`), password-strength validation, password reset modal, and persistent JWT session management.
- **Provider (Seller) Dashboard**: Service listings, active orders, messaging inbox, earnings, and analytics.
- **Client (Buyer) Dashboard**: Order tracking, threaded messaging, saved services, and reviews.
- **API Integration**: Connects dynamically to the DUMMR FastAPI backend via `src/api.js`.

## Setup & Running

### 1. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
Ensure `REACT_APP_API_URL` points to your backend instance (default `http://localhost:8000`).

### 2. Install Dependencies & Start
```bash
npm install
npm start
```
The application will launch on `http://localhost:3000`.

### 3. Build for Production
```bash
npm run build
```
Creates an optimized static bundle in the `build/` directory ready for deployment on static hosting platforms (Vercel, Netlify, Cloudflare Pages, S3).

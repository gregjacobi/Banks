# Bank Explorer

A financial statement analysis application for banks and credit unions. Built with React, Node.js/Express, and MongoDB.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- Git

## Project Structure

```
BankExplorer/
├── client/                # React frontend
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── server/                # Express backend
│   └── index.js
├── .env                   # Environment variables
├── .env.example           # Example environment variables
├── .gitignore
├── package.json
└── README.md
```

## Setup Instructions

### 1. Install Dependencies

Install all dependencies for both frontend and backend:

```bash
npm run install-all
```

Or install separately:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` (already created) and update if needed:

```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bankexplorer
```

For MongoDB Atlas, replace with your connection string:
```
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/bankexplorer
```

### 3. Start MongoDB

If using local MongoDB:
```bash
mongod
```

If using MongoDB Atlas, ensure your connection string is configured in `.env`.

### 4. Run the Application

#### Development Mode (runs both frontend and backend):
```bash
npm run dev
```

#### Or run separately:

Backend only:
```bash
npm run server
```

Frontend only:
```bash
npm run client
```

### 5. Access the Application

- Frontend: http://localhost:5000
- Backend API: http://localhost:5001
- Health Check: http://localhost:5001/api/health

## GitHub Setup

### Initialize and Push to GitHub

1. Create a new repository on GitHub (don't initialize with README)

2. Add remote and push:
```bash
git add .
git commit -m "Initial commit: Basic app structure with React, Express, and MongoDB"
git branch -M main
git remote add origin https://github.com/yourusername/BankExplorer.git
git push -u origin main
```

## Available Scripts

- `npm run dev` - Run both frontend and backend concurrently
- `npm run server` - Run backend only (with nodemon)
- `npm run client` - Run frontend only
- `npm start` - Run backend in production mode
- `npm run build` - Build frontend for production
- `npm run install-all` - Install all dependencies

## API Endpoints

- `GET /api/hello` - Test endpoint that returns a hello message and database status
- `GET /api/health` - Health check endpoint

## Next Steps

The basic structure is now in place. You can now:
- Add database models for bank financial statements
- Create API routes for CRUD operations
- Build React components for viewing and analyzing financial data
- Implement authentication if needed
- Add data visualization libraries

## Technologies Used

- **Frontend**: React 18, Axios
- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose
- **Dev Tools**: Nodemon, Concurrently

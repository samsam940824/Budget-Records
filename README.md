# Budget Records React Project

This is a Vite-powered React application with Tailwind CSS for creating budget records.

## Features
- Fast development with Vite
- Tailwind CSS for styling
- Configured with ESLint and TypeScript
- GitHub Actions workflow for automated deployment to GitHub Pages
- Backend powered by Supabase

## Prerequisites
- Node.js (v20+ recommended)

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Copy the example env file and set your keys:
   ```bash
   cp .env.example .env.local
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

## Building & Deployment

To build the project locally for production:
```bash
npm run build
```

This project is configured with a GitHub Action to automatically deploy the `main` branch to GitHub Pages upon push.

## Git Configuration
The `.gitignore` file has been pre-configured to ignore all Node.js and typical React development files (e.g., `node_modules`, `dist`, `.env` files).

# AyurSmart 🌿

A full-stack clinic management system for Ayurvedic practitioners — built for real-world use by Dr. Praveen's clinic.

---

## Overview

AyurSmart is a web-based clinic management platform that streamlines patient records, appointments, treatments, and doctor workflows for Ayurvedic healthcare providers.

**Tech Stack:**
- **Backend:** Python, Flask, SQLAlchemy
- **Database:** MySQL 8.0
- **Frontend:** HTML, CSS, JavaScript
- **DevOps:** Docker, Docker Compose, GitHub Actions CI

---

## Features

- 🔐 Role-based authentication (Admin, Doctor, Patient)
- 👤 Patient registration and profile management
- 📅 Appointment booking and management
- 💊 Treatment and remedy tracking
- 📊 Analytics dashboard
- 🧘 Prakriti (body type) quiz and records
- 🔒 Password reset with security questions
- 💳 UPI payment integration

---

## Project Structure

\`\`\`
ayursmart/
├── backend1/               # Flask API backend
│   ├── app.py              # Main application & all API routes
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Backend container
│   └── .dockerignore
├── frontend1/              # Static HTML/CSS/JS frontend
│   ├── index.html          # Landing page
│   ├── dashboard.html      # Doctor dashboard
│   ├── patientdash.html    # Patient dashboard
│   ├── appointment.html    # Appointment management
│   └── ...
├── docker-compose.yml      # Multi-container orchestration
├── .env.example            # Environment variable template
└── .github/
    └── workflows/
        └── ci.yml          # GitHub Actions CI pipeline
\`\`\`

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with WSL2 integration enabled
- Git

### Setup

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/pranav-170605/ayursmart.git
   cd ayursmart
   \`\`\`

2. **Configure environment variables**
   \`\`\`bash
   cp .env.example backend1/.env
   # Edit backend1/.env with your database credentials
   \`\`\`

3. **Build and run with Docker Compose**
   \`\`\`bash
   docker compose up --build
   \`\`\`

4. **Access the API**
   \`\`\`
   http://localhost:5000/api/me
   \`\`\`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | \`/api/register\` | Patient registration |
| POST | \`/api/login\` | User login |
| POST | \`/api/admin-login\` | Admin login |
| POST | \`/api/logout\` | Logout |
| GET | \`/api/me\` | Get current user |
| GET | \`/api/patients\` | List all patients |
| POST | \`/api/appointments\` | Book appointment |
| GET | \`/api/appointments\` | List appointments |
| POST | \`/api/save-prakriti\` | Save Prakriti quiz result |
| GET | \`/api/my-record\` | Get patient record |

---

## CI/CD Pipeline

Every push to \`master\` triggers the GitHub Actions pipeline:

1. **Lint** — \`flake8\` checks code quality
2. **Docker Build** — confirms the image builds successfully

[![CI](https://github.com/pranav-170605/ayursmart/actions/workflows/ci.yml/badge.svg)](https://github.com/pranav-170605/ayursmart/actions/workflows/ci.yml)

---

## Docker Setup

| Container | Image | Port |
|-----------|-------|------|
| \`ayursmart_backend\` | Python 3.11 + Flask + Gunicorn | \`5000\` |
| \`ayursmart_db\` | MySQL 8.0 | \`3306\` |

---

## Environment Variables

Copy \`.env.example\` to \`backend1/.env\` and configure:

\`\`\`env
DB_USER=root
DB_PASSWORD=your_password_here
DB_HOST=db
DB_PORT=3306
DB_NAME=ayursmart
\`\`\`

---

## Development

Stop containers:
\`\`\`bash
docker compose down
\`\`\`

Reset database and start fresh:
\`\`\`bash
docker compose down -v && docker compose up --build
\`\`\`

---

## License

This project is proprietary software developed for Dr. Praveen's Ayurvedic clinic.

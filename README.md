# QuizMaster – Quiz Platform with Scoring

> **IBM Workshop Project** | Full-Stack Web Application

A modern, interactive quiz platform built with **HTML/CSS/JavaScript** (frontend), **Python Flask** (backend), and **SQLite** (database).

---

## Features

- 🎓 Student registration (name + email)
- 🗂️ Quiz selection page
- ❓ 12 multiple-choice questions (HTML, CSS, JavaScript, Python, Computer Science)
- ⏱️ 30-second countdown timer per question with animated ring
- 📊 Live progress bar and question counter
- 🏆 Automatic server-side score calculation
- 📋 Detailed per-question breakdown in results
- 📅 Full quiz history per student
- 📱 Fully responsive (mobile + desktop)
- 🎨 Dark-mode UI with smooth animations

---

## Project Structure

```
quiz/
├── index.html       ← Single-page frontend
├── style.css        ← All styles (dark theme, responsive)
├── script.js        ← Frontend logic (quiz engine, API calls)
├── app.py           ← Flask REST API
├── database.py      ← SQLite helpers + seed data
├── requirements.txt ← Python dependencies
├── README.md        ← This file
└── quizmaster.db    ← Auto-created on first run
```

---

## Quick Start

### 1. Prerequisites

- Python 3.8 or newer
- pip

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the application

```bash
python app.py
```

You should see:
```
* Running on http://127.0.0.1:5000
* Debug mode: on
```

### 5. Open in browser

Visit → **http://127.0.0.1:5000**

---

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/quizzes` | List all available quizzes |
| `GET`  | `/api/quizzes/<id>/questions` | Get questions for a quiz |
| `POST` | `/api/register` | Register / retrieve a student |
| `POST` | `/api/quizzes/<id>/submit` | Submit answers, get score |
| `GET`  | `/api/students/<id>/results` | Fetch student result history |
| `GET`  | `/api/health` | Health check |

### Example: Register a student
```bash
curl -X POST http://127.0.0.1:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

### Example: Submit answers
```bash
curl -X POST http://127.0.0.1:5000/api/quizzes/1/submit \
  -H "Content-Type: application/json" \
  -d '{"student_id": 1, "answers": {"1": "A", "2": "B"}}'
```

---

## Database Schema

```
students     (id, name, email, created_at)
quizzes      (id, title, description, created_at)
questions    (id, quiz_id, question_text, option_a…d, correct_option, position)
quiz_results (id, student_id, quiz_id, score, total, percentage, taken_at)
```

The database (`quizmaster.db`) is **created and seeded automatically** on the first run.

---

## Uploading to GitHub

```bash
git init
git add .
git commit -m "Initial commit: QuizMaster IBM Workshop project"
git branch -M main
git remote add origin https://github.com/<your-username>/quizmaster.git
git push -u origin main
```

Add a `.gitignore`:
```
venv/
__pycache__/
*.pyc
quizmaster.db
```

---

## Technologies Used

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend  | Python 3, Flask, flask-cors |
| Database | SQLite (via Python `sqlite3`) |
| Dev tools | VS Code, Git |

---

*Built for the IBM Workshop – Full-Stack Web Development track.*

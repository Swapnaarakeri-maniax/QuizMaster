# QuizMaster – Quiz Platform with Scoring

> **IBM Workshop Project 2024** | Full-Stack Web Application

An interactive quiz platform built with **HTML5 / CSS3 / JavaScript** (frontend),
**Python Flask** (backend REST API), and **SQLite** (database).

---

## Features

| Feature | Detail |
|---------|--------|
| Student registration | Name + email, persisted in SQLite |
| Quiz selection | Card-based catalogue loaded from API |
| 12 MCQ questions | HTML, CSS, JS, Python, Computer Science |
| 30-second timer | Animated SVG ring, auto-advances on expiry |
| Live score counter | Updates instantly as you answer |
| One attempt per question | Cannot change answer after selecting |
| Server-side scoring | Correct answers never sent to browser |
| Detailed results | Per-question breakdown with pass/fail |
| Quiz history | All attempts saved and viewable |
| Responsive design | Mobile-first, works on any screen size |
| Blue / purple / white theme | Professional, clean UI |

---

## Project Structure

```
QuizMaster/
├── app.py                ← Flask application & REST API
├── database.py           ← SQLite helpers + seed data
├── requirements.txt      ← Python dependencies
├── README.md             ← This file
├── quizmaster.db         ← Created automatically on first run
├── templates/
│   └── index.html        ← Single-page HTML frontend
└── static/
    ├── style.css         ← Blue/purple/white professional theme
    └── script.js         ← Quiz engine (timer, scoring, API calls)
```

---

## Quick Start

### Prerequisites
- Python 3.7 or newer  
- pip

### 1 — Create a virtual environment (recommended)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 2 — Install dependencies

```bash
pip install -r requirements.txt
```

### 3 — Run the application

```bash
python app.py
```

Expected output:
```
* Serving Flask app 'app'
* Running on http://127.0.0.1:5000
```

### 4 — Open in browser

**http://127.0.0.1:5000**

---

## REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/health` | Service health check |
| `GET`  | `/api/quizzes` | List all quizzes |
| `GET`  | `/api/quizzes/<id>/questions` | Questions for a quiz (no correct answers) |
| `POST` | `/api/register` | Register or retrieve a student |
| `POST` | `/api/quizzes/<id>/submit` | Submit answers, receive score |
| `GET`  | `/api/students/<id>/results` | Student's result history |

### Example requests

**Register a student**
```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Alice\",\"email\":\"alice@ibm.com\"}"
```

**Submit answers**
```bash
curl -X POST http://localhost:5000/api/quizzes/1/submit \
  -H "Content-Type: application/json" \
  -d "{\"student_id\":1, \"answers\":{\"1\":\"A\",\"2\":\"B\"}}"
```

---

## Database Schema

```
students     (id, name, email, created_at)
quizzes      (id, title, description, created_at)
questions    (id, quiz_id, question_text, option_a, option_b, option_c,
              option_d, correct_option, position)
quiz_results (id, student_id, quiz_id, score, total, percentage, taken_at)
```

`correct_option` is stored only in the database and is **never** exposed to
the frontend before submission.

---

## Upload to GitHub

```bash
# From inside the QuizMaster/ folder
git init
git add .
git commit -m "Initial commit: QuizMaster IBM Workshop project"
git branch -M main
git remote add origin https://github.com/<your-username>/quizmaster.git
git push -u origin main
```

Recommended `.gitignore`:
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
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend  | Python 3, Flask 2+, flask-cors |
| Database | SQLite 3 (via Python `sqlite3` stdlib) |
| Dev tools | VS Code, Git |

---

*Built for the IBM Workshop – Full-Stack Web Development track.*

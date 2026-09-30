import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "quizmaster.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT    NOT NULL,
            email   TEXT    NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            description TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS questions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id         INTEGER NOT NULL REFERENCES quizzes(id),
            question_text   TEXT NOT NULL,
            option_a        TEXT NOT NULL,
            option_b        TEXT NOT NULL,
            option_c        TEXT NOT NULL,
            option_d        TEXT NOT NULL,
            correct_option  TEXT NOT NULL CHECK(correct_option IN ('A','B','C','D')),
            position        INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS quiz_results (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id  INTEGER NOT NULL REFERENCES students(id),
            quiz_id     INTEGER NOT NULL REFERENCES quizzes(id),
            score       INTEGER NOT NULL DEFAULT 0,
            total       INTEGER NOT NULL DEFAULT 0,
            percentage  REAL NOT NULL DEFAULT 0.0,
            taken_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed data only if quizzes table is empty
    row = cur.execute("SELECT COUNT(*) FROM quizzes").fetchone()
    if row[0] == 0:
        _seed(cur)

    conn.commit()
    conn.close()


def _seed(cur):
    cur.execute(
        "INSERT INTO quizzes (title, description) VALUES (?, ?)",
        ("Web & Python Fundamentals",
         "Test your knowledge of HTML, CSS, JavaScript, Python, and core computer concepts.")
    )
    quiz_id = cur.lastrowid

    questions = [
        # HTML
        ("What does HTML stand for?",
         "HyperText Markup Language", "HighText Machine Language",
         "HyperText and links Markup Language", "None of the above",
         "A"),
        ("Which HTML tag is used to create a hyperlink?",
         "<link>", "<a>", "<href>", "<url>",
         "B"),
        # CSS
        ("Which CSS property controls the text size?",
         "font-style", "text-size", "font-size", "text-style",
         "C"),
        ("Which symbol is used to select an element by its ID in CSS?",
         ".", "#", "*", "@",
         "B"),
        # JavaScript
        ("Which keyword declares a block-scoped variable in JavaScript?",
         "var", "int", "let", "define",
         "C"),
        ("What will `typeof null` return in JavaScript?",
         '"null"', '"undefined"', '"object"', '"boolean"',
         "C"),
        # Python
        ("Which of the following is the correct way to define a function in Python?",
         "function myFunc():", "def myFunc():", "func myFunc():", "define myFunc():",
         "B"),
        ("What data type is the result of: `type(3.14)` in Python?",
         "int", "str", "float", "double",
         "C"),
        # Computer basics
        ("What does CPU stand for?",
         "Central Process Unit", "Central Processing Unit",
         "Computer Personal Unit", "Central Processor Utility",
         "B"),
        ("Which of the following is NOT a programming language?",
         "Python", "Java", "HTML", "C++",
         "C"),
        # Bonus
        ("What HTTP status code means 'Not Found'?",
         "200", "301", "404", "500",
         "C"),
        ("Which Python library is used to build web applications in this project?",
         "Django", "FastAPI", "Flask", "Tornado",
         "C"),
    ]

    cur.executemany(
        """INSERT INTO questions
           (quiz_id, question_text, option_a, option_b, option_c, option_d,
            correct_option, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [(quiz_id, q[0], q[1], q[2], q[3], q[4], q[5], i)
         for i, q in enumerate(questions)]
    )


# ── helper queries used by app.py ──────────────────────────────────────────

def get_all_quizzes():
    conn = get_connection()
    rows = conn.execute("SELECT id, title, description FROM quizzes ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_questions(quiz_id):
    conn = get_connection()
    rows = conn.execute(
        """SELECT id, question_text, option_a, option_b, option_c, option_d, position
           FROM questions WHERE quiz_id = ? ORDER BY position""",
        (quiz_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_correct_answers(quiz_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, correct_option FROM questions WHERE quiz_id = ?",
        (quiz_id,)
    ).fetchall()
    conn.close()
    return {str(r["id"]): r["correct_option"] for r in rows}


def upsert_student(name, email):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO students (name, email) VALUES (?, ?)", (name, email))
    conn.commit()
    row = cur.execute("SELECT id, name, email FROM students WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(row)


def save_result(student_id, quiz_id, score, total):
    pct = round(score / total * 100, 1) if total else 0.0
    conn = get_connection()
    conn.execute(
        """INSERT INTO quiz_results (student_id, quiz_id, score, total, percentage)
           VALUES (?, ?, ?, ?, ?)""",
        (student_id, quiz_id, score, total, pct)
    )
    conn.commit()
    conn.close()
    return pct


def get_results_for_student(student_id):
    conn = get_connection()
    rows = conn.execute(
        """SELECT qr.id, q.title, qr.score, qr.total, qr.percentage, qr.taken_at
           FROM quiz_results qr
           JOIN quizzes q ON q.id = qr.quiz_id
           WHERE qr.student_id = ?
           ORDER BY qr.taken_at DESC""",
        (student_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

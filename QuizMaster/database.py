import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "quizmaster.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            email      TEXT    NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            description TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS questions (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id        INTEGER NOT NULL REFERENCES quizzes(id),
            question_text  TEXT NOT NULL,
            option_a       TEXT NOT NULL,
            option_b       TEXT NOT NULL,
            option_c       TEXT NOT NULL,
            option_d       TEXT NOT NULL,
            correct_option TEXT NOT NULL CHECK(correct_option IN ('A','B','C','D')),
            position       INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS quiz_results (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id),
            quiz_id    INTEGER NOT NULL REFERENCES quizzes(id),
            score      INTEGER NOT NULL DEFAULT 0,
            total      INTEGER NOT NULL DEFAULT 0,
            percentage REAL    NOT NULL DEFAULT 0.0,
            taken_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)

    if cur.execute("SELECT COUNT(*) FROM quizzes").fetchone()[0] == 0:
        _seed(cur)

    conn.commit()
    conn.close()


def _seed(cur):
    cur.execute(
        "INSERT INTO quizzes (title, description) VALUES (?, ?)",
        (
            "Web & Python Fundamentals",
            "Test your knowledge of HTML, CSS, JavaScript, Python, "
            "and core computer science concepts.",
        ),
    )
    qid = cur.lastrowid

    questions = [
        # HTML (2)
        (
            "What does HTML stand for?",
            "HyperText Markup Language",
            "HighText Machine Language",
            "HyperText and Links Markup Language",
            "None of the above",
            "A",
        ),
        (
            "Which HTML tag is used to define a hyperlink?",
            "<link>",
            "<a>",
            "<href>",
            "<url>",
            "B",
        ),
        # CSS (2)
        (
            "Which CSS property is used to change the font size?",
            "font-style",
            "text-size",
            "font-size",
            "text-style",
            "C",
        ),
        (
            "Which CSS selector targets an element by its ID?",
            ".classname",
            "#idname",
            "*",
            "@idname",
            "B",
        ),
        # JavaScript (3)
        (
            "Which keyword declares a block-scoped variable in JavaScript?",
            "var",
            "int",
            "let",
            "define",
            "C",
        ),
        (
            "What does `typeof null` return in JavaScript?",
            '"null"',
            '"undefined"',
            '"object"',
            '"boolean"',
            "C",
        ),
        (
            "Which method converts a JSON string to a JavaScript object?",
            "JSON.stringify()",
            "JSON.parse()",
            "JSON.convert()",
            "JSON.toObject()",
            "B",
        ),
        # Python (3)
        (
            "How do you define a function in Python?",
            "function myFunc():",
            "def myFunc():",
            "func myFunc():",
            "define myFunc():",
            "B",
        ),
        (
            "What is the result of `type(3.14)` in Python?",
            "int",
            "str",
            "float",
            "double",
            "C",
        ),
        (
            "Which Python keyword is used to handle exceptions?",
            "catch",
            "rescue",
            "except",
            "handle",
            "C",
        ),
        # Computer basics (2)
        (
            "What does CPU stand for?",
            "Central Process Unit",
            "Central Processing Unit",
            "Computer Personal Unit",
            "Central Processor Utility",
            "B",
        ),
        (
            "What HTTP status code means 'Not Found'?",
            "200",
            "301",
            "404",
            "500",
            "C",
        ),
    ]

    cur.executemany(
        """INSERT INTO questions
           (quiz_id, question_text,
            option_a, option_b, option_c, option_d,
            correct_option, position)
           VALUES (?,?,?,?,?,?,?,?)""",
        [
            (qid, q[0], q[1], q[2], q[3], q[4], q[5], i)
            for i, q in enumerate(questions)
        ],
    )


# ── Query helpers ──────────────────────────────────────────────────────────

def get_all_quizzes():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title, description FROM quizzes ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_questions(quiz_id):
    """Return questions WITHOUT correct_option (never expose to frontend)."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT id, question_text,
                  option_a, option_b, option_c, option_d, position
           FROM questions WHERE quiz_id = ? ORDER BY position""",
        (quiz_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_correct_map(quiz_id):
    """Return {str(question_id): correct_option} for server-side grading."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, correct_option FROM questions WHERE quiz_id = ?",
        (quiz_id,),
    ).fetchall()
    conn.close()
    return {str(r["id"]): r["correct_option"] for r in rows}


def upsert_student(name, email):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "INSERT OR IGNORE INTO students (name, email) VALUES (?,?)",
        (name, email),
    )
    conn.commit()
    row = cur.execute(
        "SELECT id, name, email FROM students WHERE email = ?", (email,)
    ).fetchone()
    conn.close()
    return dict(row)


def save_result(student_id, quiz_id, score, total):
    pct = round(score / total * 100, 1) if total else 0.0
    conn = get_conn()
    conn.execute(
        """INSERT INTO quiz_results
           (student_id, quiz_id, score, total, percentage)
           VALUES (?,?,?,?,?)""",
        (student_id, quiz_id, score, total, pct),
    )
    conn.commit()
    conn.close()
    return pct


def get_student_results(student_id):
    conn = get_conn()
    rows = conn.execute(
        """SELECT qr.id, q.title, qr.score, qr.total, qr.percentage, qr.taken_at
           FROM quiz_results qr
           JOIN quizzes q ON q.id = qr.quiz_id
           WHERE qr.student_id = ?
           ORDER BY qr.taken_at DESC""",
        (student_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

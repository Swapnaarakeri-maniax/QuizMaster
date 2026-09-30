from flask import Flask, request, jsonify
from flask_cors import CORS
import database as db

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ── initialise database on startup ────────────────────────────────────────
db.init_db()


# ── serve frontend ─────────────────────────────────────────────────────────
@app.route("/")
def index():
    return app.send_static_file("index.html")


# ── quizzes ────────────────────────────────────────────────────────────────
@app.route("/api/quizzes", methods=["GET"])
def list_quizzes():
    return jsonify(db.get_all_quizzes())


@app.route("/api/quizzes/<int:quiz_id>/questions", methods=["GET"])
def quiz_questions(quiz_id):
    questions = db.get_questions(quiz_id)
    if not questions:
        return jsonify({"error": "Quiz not found"}), 404
    return jsonify(questions)


# ── student registration ────────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()

    if not name or not email:
        return jsonify({"error": "Name and email are required"}), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Invalid email address"}), 400

    student = db.upsert_student(name, email)
    return jsonify(student), 200


# ── submit answers & get score ──────────────────────────────────────────────
@app.route("/api/quizzes/<int:quiz_id>/submit", methods=["POST"])
def submit_quiz(quiz_id):
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    answers = data.get("answers")   # {"question_id": "A", ...}

    if not student_id or not isinstance(answers, dict):
        return jsonify({"error": "student_id and answers dict are required"}), 400

    correct_map = db.get_correct_answers(quiz_id)
    if not correct_map:
        return jsonify({"error": "Quiz not found"}), 404

    total = len(correct_map)
    score = 0
    breakdown = []

    for qid, correct in correct_map.items():
        given = (answers.get(qid) or answers.get(int(qid)) or "").upper()
        is_correct = given == correct
        if is_correct:
            score += 1
        breakdown.append({
            "question_id": int(qid),
            "given": given,
            "correct": correct,
            "is_correct": is_correct
        })

    percentage = db.save_result(student_id, quiz_id, score, total)

    return jsonify({
        "score": score,
        "total": total,
        "percentage": percentage,
        "breakdown": breakdown
    })


# ── student results history ─────────────────────────────────────────────────
@app.route("/api/students/<int:student_id>/results", methods=["GET"])
def student_results(student_id):
    results = db.get_results_for_student(student_id)
    return jsonify(results)


# ── health check ────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ── error handlers ──────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)

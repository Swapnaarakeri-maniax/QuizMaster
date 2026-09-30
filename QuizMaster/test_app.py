"""
QuizMaster integration test.
Starts the Flask app in a background thread, exercises every API endpoint,
then prints a pass/fail summary.

Run from inside the QuizMaster/ folder:
    python test_app.py
"""
import threading
import time
import urllib.request
import json
import sys
import os

# ── Ensure a clean database ────────────────────────────────────────────────
DB = os.path.join(os.path.dirname(__file__), "quizmaster.db")
if os.path.exists(DB):
    os.remove(DB)

from app import app

PORT = 5099
srv = threading.Thread(
    target=lambda: app.run(port=PORT, use_reloader=False, debug=False),
    daemon=True,
)
srv.start()
time.sleep(2)

BASE   = "http://127.0.0.1:" + str(PORT)
passed = []
failed = []


def call(label, url, method="GET", body=None):
    try:
        if body:
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"},
                method=method,
            )
        else:
            req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
            passed.append(label)
            return data, r.status
    except urllib.error.HTTPError as e:
        data = json.loads(e.read()) if e.fp else {}
        return data, e.code
    except Exception as exc:
        failed.append(label + " (" + str(exc) + ")")
        return None, None


print("--- QuizMaster Integration Tests ---")
print("Server: " + BASE)
print()

# 1. Health
d, s = call("GET /api/health", BASE + "/api/health")
assert s == 200 and d["status"] == "ok", "Health check failed"
print("  PASS  GET /api/health")

# 2. List quizzes
d, s = call("GET /api/quizzes", BASE + "/api/quizzes")
assert s == 200 and len(d) >= 1
qid = d[0]["id"]
print("  PASS  GET /api/quizzes  (" + str(len(d)) + " quizzes)")

# 3. Questions
d, s = call("GET /api/quizzes/questions", BASE + "/api/quizzes/" + str(qid) + "/questions")
assert s == 200 and len(d) == 12
print("  PASS  GET /api/quizzes/" + str(qid) + "/questions  (" + str(len(d)) + " questions)")

# Verify correct_option NOT in response
assert "correct_option" not in d[0], "correct_option must NOT be sent to frontend"
print("  PASS  correct_option hidden from frontend")

# 4. Register
d, s = call("POST /api/register", BASE + "/api/register", "POST",
            {"name": "IBM Student", "email": "student@ibm.com"})
assert s == 200 and d["id"]
student_id = d["id"]
print("  PASS  POST /api/register  (id=" + str(student_id) + ")")

# 5. Register duplicate (idempotent)
d2, s2 = call("POST /api/register duplicate", BASE + "/api/register", "POST",
              {"name": "IBM Student", "email": "student@ibm.com"})
assert s2 == 200 and d2["id"] == student_id
print("  PASS  POST /api/register duplicate is idempotent")

# 6. Validation: empty fields
d, s = call("POST /api/register empty", BASE + "/api/register", "POST",
            {"name": "", "email": ""})
assert s == 400
print("  PASS  POST /api/register empty fields -> 400")

# 7. Submit all-A answers
questions = call("questions-for-submit",
                 BASE + "/api/quizzes/" + str(qid) + "/questions")[0]
answers = {str(q["id"]): "A" for q in questions}
d, s = call("POST /api/quizzes/submit", BASE + "/api/quizzes/" + str(qid) + "/submit",
            "POST", {"student_id": student_id, "answers": answers})
assert s == 200
assert d["total"] == 12
assert "score" in d and "percentage" in d
assert len(d["breakdown"]) == 12
print("  PASS  POST /api/quizzes/" + str(qid) + "/submit"
      + "  score=" + str(d["score"]) + "/" + str(d["total"])
      + "  (" + str(d["percentage"]) + "%)")

# 8. Submit bad quiz id
d, s = call("submit bad id", BASE + "/api/quizzes/9999/submit", "POST",
            {"student_id": student_id, "answers": {}})
assert s == 400 or s == 404
print("  PASS  submit bad quiz id -> " + str(s))

# 9. History
d, s = call("GET /api/students/results",
            BASE + "/api/students/" + str(student_id) + "/results")
assert s == 200 and len(d) >= 1
print("  PASS  GET /api/students/" + str(student_id) + "/results"
      + "  (" + str(len(d)) + " record(s))")

# 10. 404 for unknown route
d, s = call("404 unknown", BASE + "/api/does-not-exist")
assert s == 404
print("  PASS  Unknown route -> 404")

print()
if failed:
    print("FAILED: " + str(failed))
    sys.exit(1)
else:
    print("ALL " + str(len(passed)) + " TESTS PASSED")

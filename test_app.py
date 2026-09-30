"""
Integration test for QuizMaster Flask API.
Run: python test_app.py
"""
import threading, time, urllib.request, json, sys, os

# Fresh DB
if os.path.exists("quizmaster.db"):
    os.remove("quizmaster.db")

from app import app

srv = threading.Thread(
    target=lambda: app.run(port=5001, use_reloader=False, debug=False)
)
srv.daemon = True
srv.start()
time.sleep(2)

base = "http://127.0.0.1:5001"
errors = []


def api(label, url, method="GET", body=None):
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
            print(f"  PASS  {label}")
            return data
    except Exception as e:
        print(f"  FAIL  {label}: {e}")
        errors.append(label)
        return None


print("--- QuizMaster API Integration Tests ---")

health = api("GET /api/health", base + "/api/health")
assert health and health.get("status") == "ok"

quizzes = api("GET /api/quizzes", base + "/api/quizzes")
assert quizzes and len(quizzes) >= 1

qid = quizzes[0]["id"]
qs = api(f"GET /api/quizzes/{qid}/questions", base + f"/api/quizzes/{qid}/questions")
assert qs and len(qs) == 12

student = api(
    "POST /api/register",
    base + "/api/register",
    "POST",
    {"name": "Test Student", "email": "test@ibm.com"},
)
assert student and student.get("id")

# All-A answers
ans = {str(q["id"]): "A" for q in qs}
result = api(
    "POST /api/quizzes/submit",
    base + f"/api/quizzes/{qid}/submit",
    "POST",
    {"student_id": student["id"], "answers": ans},
)
assert result and result["total"] == 12
assert "score" in result and "percentage" in result
assert len(result["breakdown"]) == 12
print(f"         Score: {result['score']}/{result['total']}  ({result['percentage']}%)")

hist = api(
    "GET /api/students/results",
    base + f"/api/students/{student['id']}/results",
)
assert hist and len(hist) >= 1

# Test invalid register
try:
    req = urllib.request.Request(
        base + "/api/register",
        data=json.dumps({"name": "", "email": ""}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req)
    print("  FAIL  validation should reject empty fields")
    errors.append("empty-register-validation")
except urllib.error.HTTPError as e:
    if e.code == 400:
        print("  PASS  validation rejects empty fields (400)")
    else:
        print(f"  FAIL  wrong status code: {e.code}")
        errors.append("empty-register-validation")

print()
if errors:
    print("FAILED tests:", errors)
    sys.exit(1)
else:
    print("ALL TESTS PASSED")

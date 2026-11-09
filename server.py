import json
import sqlite3
from contextlib import closing
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
DATABASE = PROJECT_DIR / "applications.db"


class ApplicationHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/applications":
            self.send_error(404)
            return

        if self.headers.get_content_type() != "application/json":
            self.send_error(415, "Send application/json")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= 4096:
                raise ValueError

            data = json.loads(self.rfile.read(length))
            company = data["company"].strip()
            job_title = data["jobTitle"].strip()
            date_applied = data["dateApplied"]
            status = data["status"]

            if not 1 <= len(company) <= 100 or not 1 <= len(job_title) <= 100:
                raise ValueError
            if date.fromisoformat(date_applied).isoformat() != date_applied:
                raise ValueError
            if status not in ("Applied", "Interview", "Offer", "Rejected"):
                raise ValueError
        except (ValueError, KeyError, TypeError, AttributeError):
            self.send_error(400, "Invalid application details")
            return

        with closing(sqlite3.connect(DATABASE)) as connection:
            connection.execute(
                """INSERT INTO applications (company, jobTitle, dateApplied, status)
                   VALUES (?, ?, ?, ?)""",
                (company, job_title, date_applied, status),
            )
            connection.commit()

        self.send_response(201)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/applications":
            with closing(sqlite3.connect(DATABASE)) as connection:
                connection.row_factory = sqlite3.Row
                rows = connection.execute(
                    "SELECT id, company, jobTitle, dateApplied, status "
                    "FROM applications ORDER BY id DESC"
                ).fetchall()

            body = json.dumps([dict(row) for row in rows]).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path in ("/", "/index.html", "/script.js", "/style.css"):
            super().do_GET()
        else:
            self.send_error(404)


if __name__ == "__main__":
    with closing(sqlite3.connect(DATABASE)) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY,
                company TEXT NOT NULL,
                jobTitle TEXT NOT NULL,
                dateApplied TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """)
        connection.commit()

    print("Job Application Tracker running on port 8000", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8000), ApplicationHandler).serve_forever()
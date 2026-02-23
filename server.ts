import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("typing_test.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    difficulty TEXT NOT NULL,
    mode TEXT NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_challenges (
    date DATE PRIMARY KEY,
    paragraph TEXT NOT NULL
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leaderboard", (req, res) => {
    const difficulty = req.query.difficulty;
    let query = "SELECT * FROM scores";
    let params: any[] = [];

    if (difficulty && difficulty !== 'all') {
      query += " WHERE difficulty = ?";
      params.push(difficulty);
    }

    query += " ORDER BY wpm DESC LIMIT 10";
    
    const scores = db.prepare(query).all(...params);
    res.json(scores);
  });

  app.post("/api/scores", (req, res) => {
    const { name, wpm, accuracy, difficulty, mode } = req.body;
    if (!name || wpm === undefined || accuracy === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const stmt = db.prepare(
      "INSERT INTO scores (name, wpm, accuracy, difficulty, mode) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(name, wpm, accuracy, difficulty, mode);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/user-progress", (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: "Name required" });

    const scores = db.prepare(
      "SELECT wpm, accuracy, date FROM scores WHERE name = ? ORDER BY date ASC"
    ).all(name);
    res.json(scores);
  });

  app.get("/api/daily-challenge", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    let challenge = db.prepare("SELECT paragraph FROM daily_challenges WHERE date = ?").get(today) as { paragraph: string } | undefined;

    if (!challenge) {
      const paragraphs = [
        "The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the English alphabet at least once.",
        "Success is not final, failure is not fatal: it is the courage to continue that counts. Winston Churchill once said these words to inspire a nation.",
        "Programming is the art of telling another human what one wants the computer to do. It requires patience, logic, and a bit of creativity.",
        "In the middle of every difficulty lies opportunity. Albert Einstein believed that challenges are just stepping stones to greatness.",
        "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle."
      ];
      const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
      db.prepare("INSERT INTO daily_challenges (date, paragraph) VALUES (?, ?)").run(today, randomParagraph);
      challenge = { paragraph: randomParagraph };
    }

    res.json(challenge);
  });

  // Admin Routes
  app.get("/api/admin/scores", (req, res) => {
    const scores = db.prepare("SELECT * FROM scores ORDER BY date DESC").all();
    res.json(scores);
  });

  app.delete("/api/admin/scores/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM scores WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/admin/reset", (req, res) => {
    db.prepare("DELETE FROM scores").run();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

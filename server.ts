import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { data, error } = await supabase
        .from('users')
        .insert([{ email, password: hashedPassword }])
        .select()
        .single();

      if (error) {
        console.error("Supabase signup error:", error);
        if (error.code === '23505' || error.message?.includes('unique constraint')) {
          return res.status(400).json({ error: "Email already exists" });
        }
        return res.status(400).json({ error: error.message || "Failed to create user" });
      }
      res.json({ id: data.id, email: data.email });
    } catch (error: any) {
      console.error("Signup catch error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({ id: user.id, email: user.email });
  });

  // API Routes
  app.get("/api/leaderboard", async (req, res) => {
    const difficulty = req.query.difficulty;
    let query = supabase.from('scores').select('*');

    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }

    const { data: scores, error } = await query
      .order('wpm', { ascending: false })
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });
    res.json(scores);
  });

  app.post("/api/scores", async (req, res) => {
    const { name, wpm, accuracy, difficulty, mode } = req.body;
    if (!name || wpm === undefined || accuracy === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from('scores')
      .insert([{ name, wpm, accuracy, difficulty, mode }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Calculate rank
    const { count, error: rankError } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('difficulty', difficulty)
      .gt('wpm', wpm);

    if (rankError) return res.status(500).json({ error: rankError.message });

    res.json({ id: data.id, rank: (count || 0) + 1 });
  });

  app.get("/api/user-progress", async (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: "Name required" });

    const { data: scores, error } = await supabase
      .from('scores')
      .select('wpm, accuracy, date')
      .eq('name', name)
      .order('date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(scores);
  });

  app.get("/api/daily-challenge", async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    let { data: challenge, error } = await supabase
      .from('daily_challenges')
      .select('paragraph')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return res.status(500).json({ error: error.message });
    }

    if (!challenge) {
      const paragraphs = [
        "The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the English alphabet at least once.",
        "Success is not final, failure is not fatal: it is the courage to continue that counts. Winston Churchill once said these words to inspire a nation.",
        "Programming is the art of telling another human what one wants the computer to do. It requires patience, logic, and a bit of creativity.",
        "In the middle of every difficulty lies opportunity. Albert Einstein believed that challenges are just stepping stones to greatness.",
        "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle."
      ];
      const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
      
      const { data: newChallenge, error: insertError } = await supabase
        .from('daily_challenges')
        .insert([{ date: today, paragraph: randomParagraph }])
        .select()
        .single();

      if (insertError) return res.status(500).json({ error: insertError.message });
      challenge = newChallenge;
    }

    res.json(challenge);
  });

  // Admin Routes
  app.get("/api/admin/scores", async (req, res) => {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('*')
      .order('date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(scores);
  });

  app.delete("/api/admin/scores/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.post("/api/admin/reset", async (req, res) => {
    const { error } = await supabase
      .from('scores')
      .delete()
      .neq('id', -1); // Delete all rows

    if (error) return res.status(500).json({ error: error.message });
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

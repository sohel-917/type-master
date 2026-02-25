import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
app.use(express.json());

// Lazy initialization of Supabase
let supabaseClient: any = null;
function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is missing in environment variables.");
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    vercel: !!process.env.VERCEL,
    env_check: {
      url: !!process.env.SUPABASE_URL,
      key: !!process.env.SUPABASE_ANON_KEY
    }
  });
});

// Debug route
app.get("/api/debug-env", (req, res) => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || "";
  
  res.json({
    message: "Environment Variable Debugger",
    SUPABASE_URL: url ? `Set (Starts with: ${url.substring(0, 10)}...)` : "NOT SET",
    SUPABASE_ANON_KEY: key ? `Set (Starts with: ${key.substring(0, 5)}... Length: ${key.length})` : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL || "false",
  });
});

// Auth Routes
app.post("/api/auth/signup", async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const supabase = getSupabase();
    const origin = req.headers.origin || process.env.APP_URL || `http://localhost:3000`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      }
    });

    if (error) throw error;
    
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    res.json({ id: data.user?.id, email: data.user?.email, needsConfirmation: !data.session });
  } catch (error: any) {
    next(error);
  }
});

app.post("/api/auth/signin", async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    res.json({ id: data.user?.id, email: data.user?.email });
  } catch (error: any) {
    next(error);
  }
});

// Auth Callback
app.get("/auth/callback", (req, res) => {
  res.redirect("/");
});

// API Routes
app.get("/api/leaderboard", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const difficulty = req.query.difficulty;
    let query = supabase.from('scores').select('*');

    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }

    const { data: scores, error } = await query
      .order('wpm', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json(scores);
  } catch (error) {
    next(error);
  }
});

app.post("/api/scores", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { name, wpm, accuracy, difficulty, mode } = req.body;
    if (!name || wpm === undefined || accuracy === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from('scores')
      .insert([{ name, wpm, accuracy, difficulty, mode }])
      .select()
      .single();

    if (error) throw error;

    const { count, error: rankError } = await supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('difficulty', difficulty)
      .gt('wpm', wpm);

    if (rankError) throw rankError;

    res.json({ id: data.id, rank: (count || 0) + 1 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/user-progress", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: "Name required" });

    const { data: scores, error } = await supabase
      .from('scores')
      .select('wpm, accuracy, date')
      .eq('name', name)
      .order('date', { ascending: true });

    if (error) throw error;
    res.json(scores);
  } catch (error) {
    next(error);
  }
});

app.get("/api/daily-challenge", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];
    let { data: challenge, error } = await supabase
      .from('daily_challenges')
      .select('paragraph')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!challenge) {
      const paragraphs = [
        "The quick brown fox jumps over the lazy dog.",
        "Success is not final, failure is not fatal.",
        "Programming is the art of telling another human what one wants the computer to do.",
        "In the middle of every difficulty lies opportunity.",
        "The only way to do great work is to love what you do."
      ];
      const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
      
      const { data: newChallenge, error: insertError } = await supabase
        .from('daily_challenges')
        .insert([{ date: today, paragraph: randomParagraph }])
        .select()
        .single();

      if (insertError) throw insertError;
      challenge = newChallenge;
    }

    res.json(challenge);
  } catch (error) {
    next(error);
  }
});

// Admin Routes
app.get("/api/admin/scores", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: scores, error } = await supabase
      .from('scores')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    res.json(scores);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/scores/:id", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/reset", async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('scores')
      .delete()
      .neq('id', -1);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("SERVER ERROR:", err);
  const errorMessage = err.message || "Internal server error";
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: errorMessage });
});

export default app;

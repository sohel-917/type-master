import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Diagnostic logging for environment variables (Safe - doesn't log the actual keys)
console.log("--- Environment Variable Check ---");
console.log("SUPABASE_URL present:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY present:", !!process.env.SUPABASE_ANON_KEY);
if (process.env.SUPABASE_URL) console.log("SUPABASE_URL starts with:", process.env.SUPABASE_URL.substring(0, 10) + "...");
console.log("----------------------------------");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

    // Warning check for the key format (don't throw, just log)
    if (!supabaseKey.startsWith('eyJ')) {
      console.warn("WARNING: SUPABASE_ANON_KEY does not start with 'eyJ'. This is unusual for Supabase and might cause auth failures.");
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

// Auth Routes
app.post("/api/auth/signup", async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const supabase = getSupabase();
    // Use Supabase built-in auth
    // We use the origin from the request to ensure the redirect goes back to the correct preview URL
    const origin = req.headers.origin || process.env.APP_URL || `http://localhost:3000`;
    console.log("Signup attempt for email:", email, "with origin:", origin);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      }
    });

    if (error) throw error;
    
    // If email confirmation is required by Supabase settings, user might be null or identities empty
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

// Auth Callback for email confirmation redirects
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

    // Calculate rank
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
      .neq('id', -1); // Delete all rows

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Global Error Handler - Ensures errors are returned as JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("SERVER ERROR:", err);
  
  // Handle Supabase specific errors
  const errorMessage = err.message || err.error_description || "Internal server error";
  const status = err.status || err.statusCode || 500;
  
  res.status(status).json({ 
    error: errorMessage,
    code: err.code,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Vite middleware for development
async function setupVite() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else if (!process.env.VERCEL) {
      const distPath = path.join(__dirname, "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  } catch (err) {
    console.error("Vite setup error:", err);
  }
}

setupVite();

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;

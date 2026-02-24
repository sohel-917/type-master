import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trophy, 
  Timer, 
  Zap, 
  Target, 
  Settings, 
  BarChart3, 
  Moon, 
  Sun, 
  ChevronLeft, 
  RotateCcw, 
  Trash2, 
  ShieldCheck,
  Calendar,
  User,
  Medal,
  Lock,
  LogOut,
  ArrowRight,
  Mail,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Difficulty, Mode, Score, UserProgress } from './types';
import { PARAGRAPHS } from './constants';

export default function App() {
  // App State
  const [screen, setScreen] = useState<'home' | 'test' | 'leaderboard' | 'progress' | 'admin' | 'auth' | 'summary'>('home');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [user, setUser] = useState<{ id: number, email: string } | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [mode, setMode] = useState<Mode>('normal');
  
  // Test State
  const [paragraph, setParagraph] = useState('');
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const [timer, setTimer] = useState(0);
  const [lastResult, setLastResult] = useState<{ wpm: number, accuracy: number, rank: number, time: number } | null>(null);
  
  // Data State
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [adminScores, setAdminScores] = useState<Score[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Theme effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Auth effect
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Timer effect
  useEffect(() => {
    if (startTime && !endTime) {
      timerRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, endTime]);

  // Real-time stats calculation
  useEffect(() => {
    if (userInput.length > 0 && startTime && !endTime) {
      const timeInMinutes = (Date.now() - startTime) / 60000;
      const calculatedWpm = Math.round((userInput.length / 5) / timeInMinutes);
      setWpm(calculatedWpm);

      let correctChars = 0;
      for (let i = 0; i < userInput.length; i++) {
        if (userInput[i] === paragraph[i]) correctChars++;
      }
      const calculatedAccuracy = Math.round((correctChars / userInput.length) * 100);
      setAccuracy(calculatedAccuracy);

      if (userInput.length === paragraph.length) {
        finishTest();
      }
    }
  }, [userInput, paragraph, startTime, endTime]);

  const startTest = async () => {
    if (!user) {
      setScreen('auth');
      return;
    }
    
    let targetParagraph = '';
    if (mode === 'daily') {
      const res = await fetch('/api/daily-challenge');
      const data = await res.json();
      targetParagraph = data.paragraph;
    } else {
      const options = PARAGRAPHS[difficulty];
      targetParagraph = options[Math.floor(Math.random() * options.length)];
    }
    
    setParagraph(targetParagraph);
    setUserInput('');
    setStartTime(null);
    setEndTime(null);
    setWpm(0);
    setAccuracy(100);
    setTimer(0);
    setIsFinished(false);
    setScreen('test');
    
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const finishTest = async () => {
    const now = Date.now();
    setEndTime(now);
    setIsFinished(true);
    
    // Final calculation
    const timeInSeconds = Math.floor((now - (startTime || now)) / 1000);
    const timeInMinutes = timeInSeconds / 60;
    const finalWpm = Math.round((userInput.length / 5) / timeInMinutes);
    
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user?.email,
        wpm: finalWpm,
        accuracy,
        difficulty,
        mode
      })
    });
    
    const data = await res.json();
    setLastResult({
      wpm: finalWpm,
      accuracy,
      rank: data.rank,
      time: timeInSeconds
    });
    
    setTimeout(() => setScreen('summary'), 1000);
  };

  const fetchLeaderboard = async () => {
    const res = await fetch(`/api/leaderboard?difficulty=${difficulty}`);
    const data = await res.json();
    setLeaderboard(data);
    setScreen('leaderboard');
  };

  const fetchUserProgress = async () => {
    if (!user) {
      setScreen('auth');
      return;
    }
    const res = await fetch(`/api/user-progress?name=${user.email}`);
    const data = await res.json();
    setUserProgress(data);
    setScreen('progress');
  };

  const fetchAdminScores = async () => {
    const res = await fetch('/api/admin/scores');
    const data = await res.json();
    setAdminScores(data);
    setScreen('admin');
  };

  const deleteScore = async (id: number) => {
    await fetch(`/api/admin/scores/${id}`, { method: 'DELETE' });
    fetchAdminScores();
  };

  const resetLeaderboard = async () => {
    if (confirm("Are you sure you want to reset the entire leaderboard?")) {
      await fetch('/api/admin/reset', { method: 'POST' });
      fetchAdminScores();
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (authMode === 'signup' && authForm.password !== authForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    const endpoint = authMode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.needsConfirmation) {
          setAuthSuccess('Account created! Please check your email to confirm your account before signing in.');
          setAuthMode('signin');
          setAuthForm({ email: '', password: '', confirmPassword: '' });
        } else {
          setUser(data);
          setScreen('home');
          setAuthForm({ email: '', password: '', confirmPassword: '' });
        }
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setScreen('home');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!startTime) setStartTime(Date.now());
    setUserInput(e.target.value);
  };

  const renderChar = (char: string, index: number) => {
    let colorClass = 'text-gray-400 dark:text-gray-500';
    if (index < userInput.length) {
      colorClass = userInput[index] === char 
        ? 'text-green-500 font-medium' 
        : 'text-red-500 font-medium bg-red-100 dark:bg-red-900/30';
    }
    const isCurrent = index === userInput.length;
    
    return (
      <span key={index} className={`${colorClass} ${isCurrent ? 'typing-cursor' : ''}`}>
        {char}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-12">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setScreen('home')}
        >
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-500/30 group-hover:rotate-12 transition-transform duration-300">
            <Zap className="text-white w-7 h-7 fill-white/20" />
          </div>
          <div className="flex flex-col -space-y-1">
            <h1 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white">
              TYPEMASTER<span className="text-indigo-600">PRO</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Speed & Accuracy</span>
          </div>
        </motion.div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>
          <button 
            onClick={() => screen === 'admin' ? setScreen('home') : fetchAdminScores()}
            className="p-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ShieldCheck className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {screen === 'auth' && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md space-y-6"
            >
              <div className="text-center space-y-2 mb-8">
                <div className="inline-flex p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl mb-4">
                  <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                  {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {authMode === 'signin' ? 'Sign in to track your typing progress' : 'Join TypeMaster Pro today'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-2xl shadow-indigo-500/10 border border-gray-100 dark:border-gray-700 space-y-6">
                {authSuccess && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{authSuccess}</p>
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="email" 
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        placeholder="you@example.com"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        value={authForm.password}
                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                      />
                    </div>
                  </div>

                  {authMode === 'signup' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Confirm Password</label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                          type="password" 
                          required
                          minLength={6}
                          value={authForm.confirmPassword}
                          onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                          placeholder="••••••••"
                          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium"
                        />
                      </div>
                    </motion.div>
                  )}

                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-500 text-sm font-medium text-center"
                    >
                      {authError}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98]"
                  >
                    {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                </form>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-700 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                    {authMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                    <button 
                      onClick={() => {
                        setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                        setAuthError('');
                        setAuthSuccess('');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      {authMode === 'signin' ? "Sign Up" : "Sign In"}
                    </button>
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setScreen('home')}
                className="w-full py-4 bg-transparent text-gray-500 dark:text-gray-400 font-bold hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back to Home
              </button>
            </motion.div>
          )}

          {screen === 'summary' && lastResult && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex p-4 bg-indigo-100 dark:bg-indigo-900/40 rounded-full mb-2">
                  <Trophy className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-4xl font-black text-gray-900 dark:text-white">Great Job!</h2>
                <p className="text-gray-500 dark:text-gray-400 text-lg">You've completed the {difficulty} test.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">WPM</div>
                  <div className="text-4xl font-black text-indigo-600">{lastResult.wpm}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Accuracy</div>
                  <div className="text-4xl font-black text-green-500">{lastResult.accuracy}%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Rank</div>
                  <div className="text-4xl font-black text-amber-500">#{lastResult.rank}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Time</div>
                  <div className="text-4xl font-black text-indigo-600">{lastResult.time}s</div>
                </div>
              </div>

              <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white text-center space-y-4 shadow-xl shadow-indigo-500/30">
                <h3 className="text-xl font-bold">You are currently ranked #{lastResult.rank}</h3>
                <p className="opacity-80">Keep practicing to climb higher on the leaderboard!</p>
                <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={startTest}
                    className="px-8 py-3.5 bg-white text-indigo-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Try Again
                  </button>
                  <button 
                    onClick={fetchLeaderboard}
                    className="px-8 py-3.5 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-400 transition-all border border-indigo-400 flex items-center justify-center gap-2"
                  >
                    <Trophy className="w-5 h-5" />
                    View Leaderboard
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setScreen('home')}
                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back to Home
              </button>
            </motion.div>
          )}

          {screen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">
                  {user ? `Welcome, ${user.email}!` : 'Ready to test your speed?'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400">Improve your typing skills with real-time feedback.</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 space-y-6">
                {!user && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center">
                    <p className="text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-2">Sign in to save your scores and track progress!</p>
                    <button 
                      onClick={() => setScreen('auth')}
                      className="text-indigo-700 dark:text-indigo-300 font-bold text-sm hover:underline"
                    >
                      Sign In / Sign Up
                    </button>
                  </div>
                )}

                {user && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-xl">
                        <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{user.email}</span>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Difficulty Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => { setDifficulty(d); setMode('normal'); }}
                        className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                          difficulty === d && mode === 'normal'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                            : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => { setMode('daily'); startTest(); }}
                    className={`w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      mode === 'daily'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Daily Challenge Mode
                  </button>
                </div>

                <button
                  onClick={startTest}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 group transition-all"
                >
                  Start Typing Test
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={fetchLeaderboard}
                  className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Leaderboard
                </button>
                <button 
                  onClick={fetchUserProgress}
                  className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  My Progress
                </button>
              </div>
            </motion.div>
          )}

          {screen === 'test' && (
            <motion.div 
              key="test"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full space-y-8"
            >
              <div className="grid grid-cols-3 gap-4 md:gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Timer className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Time</span>
                  </div>
                  <div className="text-3xl font-black text-indigo-600">{timer}s</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">WPM</span>
                  </div>
                  <div className="text-3xl font-black text-indigo-600">{wpm}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Target className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Accuracy</span>
                  </div>
                  <div className="text-3xl font-black text-indigo-600">{accuracy}%</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-10 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1.5 bg-indigo-600 transition-all duration-300" style={{ width: `${(userInput.length / paragraph.length) * 100}%` }} />
                
                <div className="text-2xl md:text-3xl font-mono leading-relaxed mb-8 select-none">
                  {paragraph.split('').map((char, i) => renderChar(char, i))}
                </div>

                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={handleInputChange}
                    disabled={isFinished}
                    className="absolute inset-0 opacity-0 cursor-default"
                    autoFocus
                  />
                  <div className="w-full h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 font-medium">
                    {isFinished ? "Test Completed!" : "Start typing to begin..."}
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button 
                  onClick={startTest}
                  className="flex items-center gap-2 px-8 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  Restart
                </button>
                <button 
                  onClick={() => setScreen('home')}
                  className="flex items-center gap-2 px-8 py-3.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl font-bold hover:opacity-90 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back to Home
                </button>
              </div>
            </motion.div>
          )}

          {screen === 'leaderboard' && (
            <motion.div 
              key="leaderboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black flex items-center gap-3">
                  <Trophy className="text-amber-500 w-8 h-8" />
                  Leaderboard
                </h2>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                  {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => { setDifficulty(d === 'all' ? 'easy' : d); fetchLeaderboard(); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        difficulty === d || (d === 'all' && difficulty === 'easy')
                          ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {leaderboard.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {leaderboard.map((score, index) => (
                      <div key={score.id} className="flex items-center p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="w-12 flex justify-center">
                          {index === 0 ? <Medal className="w-6 h-6 text-amber-400" /> :
                           index === 1 ? <Medal className="w-6 h-6 text-gray-400" /> :
                           index === 2 ? <Medal className="w-6 h-6 text-amber-700" /> :
                           <span className="text-lg font-bold text-gray-300 dark:text-gray-600">#{index + 1}</span>}
                        </div>
                        <div className="flex-1 px-4">
                          <div className="font-bold text-gray-900 dark:text-white">{score.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{score.difficulty} • {new Date(score.date!).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-indigo-600">{score.wpm} <span className="text-xs font-bold text-gray-400 uppercase">WPM</span></div>
                          <div className="text-xs font-bold text-green-500">{score.accuracy}% Acc</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Trophy className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No scores yet. Be the first to rank!</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setScreen('home')}
                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back to Home
              </button>
            </motion.div>
          )}

          {screen === 'progress' && (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black flex items-center justify-center gap-3">
                  <BarChart3 className="text-indigo-500 w-8 h-8" />
                  Your Progress
                </h2>
                <p className="text-gray-500 dark:text-gray-400">Tracking performance for <span className="font-bold text-indigo-600">{user?.email}</span></p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="h-[300px] w-full">
                  {userProgress.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userProgress}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f3f4f6'} />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          stroke={isDark ? '#9ca3af' : '#6b7280'}
                          fontSize={12}
                        />
                        <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1f2937' : '#ffffff',
                            borderColor: isDark ? '#374151' : '#e5e7eb',
                            borderRadius: '12px',
                            color: isDark ? '#f9fafb' : '#111827'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="wpm" 
                          stroke="#4f46e5" 
                          strokeWidth={4} 
                          dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">Complete at least 2 tests to see your trend graph.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Average WPM</div>
                  <div className="text-3xl font-black text-indigo-600">
                    {userProgress.length > 0 
                      ? Math.round(userProgress.reduce((acc, curr) => acc + curr.wpm, 0) / userProgress.length)
                      : 0}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 text-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Best Accuracy</div>
                  <div className="text-3xl font-black text-green-500">
                    {userProgress.length > 0 
                      ? Math.max(...userProgress.map(p => p.accuracy))
                      : 0}%
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setScreen('home')}
                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back to Home
              </button>
            </motion.div>
          )}

          {screen === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black flex items-center gap-3">
                  <ShieldCheck className="text-indigo-600 w-8 h-8" />
                  Admin Panel
                </h2>
                <button 
                  onClick={resetLeaderboard}
                  className="px-6 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl font-bold text-sm hover:bg-red-100 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset Leaderboard
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WPM</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Accuracy</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Difficulty</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {adminScores.map((score) => (
                        <tr key={score.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{score.name}</td>
                          <td className="px-6 py-4 font-black text-indigo-600">{score.wpm}</td>
                          <td className="px-6 py-4 font-bold text-green-500">{score.accuracy}%</td>
                          <td className="px-6 py-4 capitalize text-gray-500 dark:text-gray-400">{score.difficulty}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(score.date!).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => deleteScore(score.id!)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {adminScores.length === 0 && (
                  <div className="p-12 text-center text-gray-500 font-medium">No records found.</div>
                )}
              </div>

              <button 
                onClick={() => setScreen('home')}
                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 text-center">
        <p className="text-gray-400 text-sm font-medium">© 2026 TypeMaster Pro • Built for Speed & Accuracy</p>
      </footer>
    </div>
  );
}

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
  ArrowRight
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
  const [screen, setScreen] = useState<'home' | 'test' | 'leaderboard' | 'progress' | 'admin'>('home');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
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
    if (!userName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    localStorage.setItem('userName', userName);
    
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
    const timeInMinutes = (now - (startTime || now)) / 60000;
    const finalWpm = Math.round((userInput.length / 5) / timeInMinutes);
    
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: userName,
        wpm: finalWpm,
        accuracy,
        difficulty,
        mode
      })
    });
  };

  const fetchLeaderboard = async () => {
    const res = await fetch(`/api/leaderboard?difficulty=${difficulty}`);
    const data = await res.json();
    setLeaderboard(data);
    setScreen('leaderboard');
  };

  const fetchUserProgress = async () => {
    if (!userName) {
      alert("Please enter your name to view progress!");
      return;
    }
    const res = await fetch(`/api/user-progress?name=${userName}`);
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
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setScreen('home')}>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Zap className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TypeMaster <span className="text-indigo-600">Pro</span></h1>
        </div>
        
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
          {screen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">Ready to test your speed?</h2>
                <p className="text-gray-500 dark:text-gray-400">Improve your typing skills with real-time feedback.</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="text" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter your name..."
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

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
                <p className="text-gray-500 dark:text-gray-400">Tracking performance for <span className="font-bold text-indigo-600">{userName}</span></p>
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

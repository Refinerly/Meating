import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Flame, User, Cpu, Activity, CheckSquare } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { calculateLevel } from '../utils/leveling';

function CircularProgress({ value, max = 5, color, label }: { value: number, max?: number, color: string, label: string }) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / max) * circumference;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle cx="48" cy="48" r={radius} stroke="#222" strokeWidth="8" fill="transparent" />
          <circle cx="48" cy="48" r={radius} stroke={color} strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <span className="absolute text-2xl font-bold text-white">{value}</span>
      </div>
      <span className="text-sm font-medium text-zinc-400">{label}</span>
    </div>
  );
}

interface Habit {
  id: string;
  title?: string;
  name?: string;
  completedDates?: string[];
  streak?: number;
}

export function Dashboard() {
  const { user, profile } = useAuth();
  const [quests, setQuests] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [latestStats, setLatestStats] = useState<any>(null);
  const [nextCheckIn, setNextCheckIn] = useState<string | null>(null);
  const [todayCheckinsCount, setTodayCheckinsCount] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitsCount, setTodayHabitsCount] = useState(0);
  const [totalHabitsCount, setTotalHabitsCount] = useState(0);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [weightGoal, setWeightGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);



  useEffect(() => {
    console.log("Dashboard: User state changed", user?.uid);
    if (!user) return;
    const fetchData = async () => {
      setLoadError(null);
      console.log("Dashboard: Fetching data...");
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const [questRows, missionRows, projectRows, accountRows] = await Promise.all([api.list('quests', {date:todayStr}), api.list('missions'), api.list('projects'), api.list('accounts')]);
        setQuests(questRows); setMissions(missionRows); setProjects(projectRows); setAccounts(accountRows);

        const [checkinsData, todayCheckins] = await Promise.all([
          api.list<any>('checkins', { limit: '1' }),
          api.list<any>('checkins', { from: format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"), to: new Date().toISOString() }),
        ]);
        if (checkinsData.length) setLatestStats(checkinsData[0].stats);
        setTodayCheckinsCount(todayCheckins.length);

        const habitsData = await api.list<import('../lib/api').ApiRecord & Habit>('habits');
        setHabits(habitsData); setTotalHabitsCount(habitsData.length);
        setTodayHabitsCount(habitsData.filter(h=>h.completedDates?.includes(todayStr)).length);

        const sevenDaysAgo = format(subDays(new Date(),6),'yyyy-MM-dd');
        setHealthLogs(await api.list<any>('health-logs',{from:sevenDaysAgo}));

        const {settings} = await api.settings();
        if (profile?.currentStreak !== undefined && profile.lastCheckInDate && profile.lastCheckInDate < format(subDays(new Date(),1),'yyyy-MM-dd') && profile.currentStreak !== 0) void api.profile({currentStreak:0});
        const schedule = settings.schedule as any[] | undefined;
        if (schedule) { const now=format(new Date(),'HH:mm'); const upcoming=schedule.find(item=>item.active&&item.time>now); const first=schedule.find(item=>item.active); setNextCheckIn(upcoming?.time || (first ? 'Tomorrow '+first.time : null)); }
        if (settings.weightGoal) setWeightGoal(settings.weightGoal);
      } catch (error) {
        console.error("Error fetching data", error);
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  
  const completedQuestsCount = quests.filter(q => q.completed).length;
  const totalQuestsCount = quests.length;
  
  // Weight Goal Summary
  const getWeightTarget = () => {
    if (!weightGoal || !weightGoal.startWeight || !weightGoal.target || !weightGoal.startDate || !weightGoal.date) return null;
    const start = new Date(weightGoal.startDate);
    const end = new Date(weightGoal.date);
    const now = new Date();
    const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const daysPassed = Math.max(0, Math.min(totalDays, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
    const targetPath = weightGoal.startWeight + (weightGoal.target - weightGoal.startWeight) * (daysPassed / totalDays);
    const currentWeight = healthLogs.find(l => l.date === format(new Date(), 'yyyy-MM-dd'))?.weight || 
                         healthLogs.slice().reverse().find(l => l.weight)?.weight || weightGoal.startWeight;
    
    return {
      target: Math.round(targetPath * 10) / 10,
      current: Number(currentWeight),
      goal: weightGoal.target,
      diff: Math.round((Number(currentWeight) - targetPath) * 10) / 10,
      totalProgress: Math.round(((weightGoal.startWeight - Number(currentWeight)) / (weightGoal.startWeight - weightGoal.target)) * 100)
    };
  };

  const weightStatus = getWeightTarget();

  // Calculate overall daily progress percentage
  const totalItems = 5 + totalQuestsCount + totalHabitsCount; // 5 check-ins per day target
  const completedItems = Math.min(todayCheckinsCount, 5) + completedQuestsCount + todayHabitsCount;
  const progressPercentage = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    return {
      dateStr: format(d, 'yyyy-MM-dd'),
      display: format(d, 'EEE'),
      shortDate: format(d, 'MMM d')
    };
  });

  const healthChartData = last7Days.map(day => {
    const log = healthLogs.find(l => l.date === day.dateStr);
    
    let sleepHours = 0;
    if (log?.sleepTime && log?.wakeTime) {
      const [sH, sM] = log.sleepTime.split(':').map(Number);
      const [wH, wM] = log.wakeTime.split(':').map(Number);
      let sleepMins = (wH * 60 + wM) - (sH * 60 + sM);
      if (sleepMins < 0) sleepMins += 24 * 60; // crossed midnight
      sleepHours = Math.round((sleepMins / 60) * 10) / 10;
    }
    
    return {
      date: day.shortDate,
      weight: log?.weight ? Number(log.weight) : null,
      sleep: sleepHours || null,
      calories: log?.meals?.reduce((sum: number, m: any) => sum + Number(m.calories || 0), 0) || 0,
      exercises: log?.exercises?.length || 0,
      supplements: log?.supplements?.filter((s: any) => typeof s === 'string' ? true : s.taken).length || 0,
      teas: log?.teas?.filter((t: any) => typeof t === 'string' ? true : t.taken).length || 0,
    };
  });

  const allSupplements = new Set<string>();
  const allTeas = new Set<string>();

  healthLogs.forEach(log => {
    log.supplements?.forEach((s: any) => {
      const name = typeof s === 'string' ? s : s.name;
      if (name) allSupplements.add(name);
    });
    log.teas?.forEach((t: any) => {
      const name = typeof t === 'string' ? t : t.name;
      if (name) allTeas.add(name);
    });
  });

  const uniqueSupplements = Array.from(allSupplements).sort();
  const uniqueTeas = Array.from(allTeas).sort();

  const wasTaken = (logDate: string, type: 'supplements'|'teas', name: string) => {
    const log = healthLogs.find(l => l.date === logDate);
    if (!log || !log[type]) return false;
    const item = log[type].find((i: any) => (typeof i === 'string' ? i : i.name) === name);
    if (!item) return false;
    return typeof item === 'string' ? true : item.taken;
  };

  const pilotStats = calculateLevel(profile?.pilotWins || 0);
  const avatarStats = calculateLevel(profile?.avatarWins || 0);
  
  const pilotPercent = Math.round((pilotStats.currentXp / pilotStats.xpForNextLevel) * 100);
  const avatarPercent = Math.round((avatarStats.currentXp / avatarStats.xpForNextLevel) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {loadError && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{loadError} <button onClick={() => window.location.reload()} className="underline">Retry</button></div>}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Pilot Dashboard</h1>
          <p className="text-zinc-400 mt-1">Today's Meat Suit status</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Link to="/money" className="px-3 py-1.5 rounded-full bg-neon-green/20 border border-neon-green/50 text-neon-green text-xs font-bold flex items-center gap-1.5 hover:bg-neon-green/30 transition-colors">
            <span className="text-white">Balance:</span> ┬ú{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Link>
          <div className="px-3 py-1.5 rounded-full bg-[#002222] border border-[#004444] text-neon-cyan text-xs font-bold flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Pilot Lv {pilotStats.level} <span className="text-[#004444] ml-1">{pilotPercent}%</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[#002200] border border-[#004400] text-neon-green text-xs font-bold flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Avatar Lv {avatarStats.level} <span className="text-[#004400] ml-1">{avatarPercent}%</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[#331100] border border-[#552200] text-neon-orange text-xs font-bold flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> {profile?.streak || 0}-day streak
          </div>

        </div>
      </header>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold text-zinc-500 tracking-wider">CURRENT STATS</h2>
            <Link to="/analytics#performance" className="text-xs font-bold text-white hover:text-neon-green transition-colors flex items-center gap-1">
              <Activity className="w-3 h-3" /> View Performance Graph
            </Link>
          </div>
          {nextCheckIn && <span className="text-xs text-neon-cyan font-mono">Next Check-in: {nextCheckIn}</span>}
        </div>
        <div className="flex flex-wrap justify-center md:justify-between gap-6">
          <CircularProgress value={latestStats?.adherence || 0} color="var(--color-neon-green)" label="Adherence" />
          <CircularProgress value={latestStats?.energy || 0} color="var(--color-neon-cyan)" label="Energy" />
          <CircularProgress value={latestStats?.mood || 0} color="var(--color-neon-pink)" label="Mood" />
          <CircularProgress value={latestStats?.stress || 0} color="var(--color-neon-orange)" label="Stress" />
          <CircularProgress value={latestStats?.focus || 0} color="var(--color-neon-purple)" label="Focus" />
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-bold text-zinc-500 tracking-wider">DAILY PROGRESS</h2>
          <span className="text-neon-green font-bold text-sm">{progressPercentage}%</span>
        </div>
        <div className="h-2 bg-[#222] rounded-full overflow-hidden mb-4">
          <div className="h-full bg-neon-green transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{todayCheckinsCount}/5 check-ins</span>
          <span>{completedQuestsCount}/{totalQuestsCount} quests</span>
          <span>{todayHabitsCount}/{totalHabitsCount} habits</span>
        </div>
      </div>

      {weightStatus && (
        <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-neon-green" />
                Weight Goal Tracker
              </h2>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">Baseline Path Analysis</p>
            </div>
            <div className="text-right">
              <span className={`text-xl font-bold ${weightStatus.diff <= 0 ? 'text-neon-green' : 'text-neon-orange'}`}>
                {weightStatus.diff > 0 ? '+' : ''}{weightStatus.diff} kg
              </span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-widest">From Baseline</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-bg-dark border border-border-dark p-4 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Current Weight</span>
              <div className="text-2xl font-bold text-white">{weightStatus.current} <span className="text-sm font-normal text-zinc-500">kg</span></div>
            </div>
            <div className="bg-bg-dark border border-border-dark p-4 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Daily Target (Baseline)</span>
              <div className="text-2xl font-bold text-neon-green">{weightStatus.target} <span className="text-sm font-normal text-zinc-500">kg</span></div>
            </div>
            <div className="bg-bg-dark border border-border-dark p-4 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Final Goal</span>
              <div className="text-2xl font-bold text-neon-cyan">{weightStatus.goal} <span className="text-sm font-normal text-zinc-500">kg</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-tighter">Total Quest Progress</span>
              <span className="text-sm text-neon-green font-bold">{weightStatus.totalProgress}%</span>
            </div>
            <div className="h-2 bg-[#111] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-green to-neon-cyan transition-all duration-1000" 
                style={{ width: `${Math.max(0, Math.min(100, weightStatus.totalProgress))}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}


    </motion.div>
  );
}

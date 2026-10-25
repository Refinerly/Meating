import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { calculateLevel } from '../utils/leveling';
import { motion } from 'motion/react';
import { Check, ClipboardList, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function StatSlider({ value, onChange, color, label, leftLabel, rightLabel }: any) {
  const percent = ((value - 1) / 4) * 100;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-sm font-bold text-white">{label}</label>
        <span className="font-bold text-lg" style={{ color }}>{value}</span>
      </div>
      <div className="relative h-3 bg-[#222] rounded-full flex items-center">
        <div className="absolute h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, backgroundColor: color }}></div>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="absolute w-2 h-2 rounded-full bg-zinc-600 z-10" style={{ left: `calc(${((i - 1) / 4) * 100}% - 4px)` }}></div>
        ))}
        <div className="absolute w-5 h-5 rounded-full bg-white border-4 z-20 transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ left: `calc(${percent}% - 10px)`, borderColor: color }}></div>
        <input type="range" min="1" max="5" step="1" value={value} onChange={e => onChange(parseInt(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer z-30" />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export function CheckIn() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isBusy = false;
  
  const [stats, setStats] = useState({
    adherence: 3,
    energy: 3,
    mood: 3,
    stress: 3,
    focus: 3,
    social: 3,
    health: 3,
    creative: 3,
    money: 3,
    twitter: 3
  });

  const [socialBehavior, setSocialBehavior] = useState('neither');
  const [note, setNote] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.create('checkins', {
        timestamp: new Date().toISOString(),
        stats,
        socialBehavior,
        note,
        nudgesApplied: []
      });
      const today = new Date().toLocaleDateString('en-CA');
      const { profile } = await api.me();
      const last = typeof profile.lastCheckInDate === 'string' ? profile.lastCheckInDate : '';
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
      const currentStreak = Number(profile.currentStreak || 0);
      const pilotWins = Number(profile.pilotWins || 0) + 20;
      const update: Record<string, unknown> = { pilotWins, pilotLevel: calculateLevel(pilotWins).level };
      if (last !== today) {
        const nextStreak = last === yesterday ? currentStreak + 1 : 1;
        update.currentStreak = nextStreak;
        update.longestStreak = Math.max(Number(profile.longestStreak || 0), nextStreak);
        update.lastCheckInDate = today;
      }
      await api.profile(update);
      navigate('/');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save check-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Check-in</h1>
        <p className="text-zinc-400 mt-1">Log the Meat Suit's current state</p>
      </header>

      {isBusy && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-500 font-medium">Optional Check-in</h3>
            <p className="text-sm text-amber-500/80 mt-1">
              Your calendar indicates you are busy. This check-in is optional and won't break your streak if missed.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-bg-card border border-border-dark rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-6 text-white">Primary Directive</h2>
          <StatSlider 
            value={stats.adherence} 
            onChange={(v: number) => setStats({...stats, adherence: v})} 
            color="var(--color-neon-green)" 
            label="Is the meat suit doing what I know is good for it?" 
            leftLabel="Completely off track" 
            rightLabel="Following the plan" 
          />
        </div>

        <div className="bg-bg-card border border-border-dark rounded-2xl p-6 md:p-8 space-y-10">
          <h2 className="text-xl font-bold mb-2 text-white">Vitals</h2>
          <StatSlider value={stats.energy} onChange={(v: number) => setStats({...stats, energy: v})} color="var(--color-neon-green)" label="Energy" leftLabel="Exhausted" rightLabel="Wired" />
          <StatSlider value={stats.mood} onChange={(v: number) => setStats({...stats, mood: v})} color="var(--color-neon-pink)" label="Mood" leftLabel="Depressed" rightLabel="Euphoric" />
          <StatSlider value={stats.stress} onChange={(v: number) => setStats({...stats, stress: v})} color="var(--color-neon-orange)" label="Stress" leftLabel="Zen" rightLabel="Panicking" />
          <StatSlider value={stats.focus} onChange={(v: number) => setStats({...stats, focus: v})} color="var(--color-neon-cyan)" label="Focus" leftLabel="Scattered" rightLabel="Laser" />
          <StatSlider value={stats.social} onChange={(v: number) => setStats({...stats, social: v})} color="var(--color-neon-purple)" label="Social Battery" leftLabel="Drained" rightLabel="Charged" />
          <StatSlider value={stats.health} onChange={(v: number) => setStats({...stats, health: v})} color="var(--color-neon-green)" label="Health/Pain" leftLabel="Poor" rightLabel="Excellent" />
          <StatSlider value={stats.creative} onChange={(v: number) => setStats({...stats, creative: v})} color="var(--color-neon-purple)" label="Creative Output" leftLabel="Blocked" rightLabel="Flowing" />
          <StatSlider value={stats.money} onChange={(v: number) => setStats({...stats, money: v})} color="var(--color-neon-yellow)" label="Money Flow" leftLabel="Tight" rightLabel="Abundant" />
          <StatSlider value={stats.twitter} onChange={(v: number) => setStats({...stats, twitter: v})} color="var(--color-neon-cyan)" label="Twitter/Social Usage" leftLabel="Very low" rightLabel="Very high" />
        </div>

        <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
          <h3 className="text-xs font-bold text-zinc-500 tracking-wider mb-4 uppercase">Social Behavior Since Last Check-in</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Watching/Scrolling', value: 'watching' },
              { label: 'Posting/Creating', value: 'posting' },
              { label: 'Neither', value: 'neither' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSocialBehavior(option.value)}
                className={`px-6 py-3 rounded-full text-sm font-bold transition-colors ${
                  socialBehavior === option.value 
                    ? 'bg-neon-green text-black' 
                    : 'bg-transparent border border-border-dark text-zinc-400 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
          <h3 className="text-xs font-bold text-zinc-500 tracking-wider mb-4 flex items-center gap-2 uppercase">
            <ClipboardList className="w-4 h-4" /> Pilot Observation
          </h3>
          <textarea
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is the Meat Suit doing right now? (e.g., 'Pulled Meat Suit off Twitter and back to work')"
            className="w-full bg-bg-dark border border-border-dark rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-green min-h-[120px] resize-y"
          />
        </div>

        {submitError && <p role="alert" className="text-sm text-red-400">{submitError}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-neon-green text-black font-bold py-4 px-6 rounded-full flex items-center justify-center gap-2 hover:bg-[#2eeb5c] transition-colors disabled:opacity-50 shadow-[0_0_20px_rgba(57,255,20,0.3)]"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <><Check className="w-5 h-5" /> Log Check-in</>
          )}
        </button>
      </form>
    </motion.div>
  );
}

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

export function Habits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    fetchHabits();
  }, [user]);

  const fetchHabits = async () => {
    try {
      setError('');
      setHabits(await api.list('habits'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load habits.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newHabitName.trim()) return;
    
    setIsSubmitting(true);
    try {
      await api.create('habits', {
        title: newHabitName.trim(),
        missionId: '',
        schedule: 'daily',
        createdAt: new Date().toISOString(),
        streak: 0,
        completedDates: []
      });
      setNewHabitName('');
      setShowForm(false);
      fetchHabits();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add habit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleHabit = async (habit: any) => {
    if (!user) return;
    
    const isCompletedToday = habit.completedDates?.includes(todayStr);
    let newCompletedDates = habit.completedDates || [];
    let newStreak = habit.streak || 0;

    if (isCompletedToday) {
      newCompletedDates = newCompletedDates.filter((d: string) => d !== todayStr);
      newStreak = Math.max(0, newStreak - 1);
    } else {
      newCompletedDates = [...newCompletedDates, todayStr];
      newStreak += 1;
    }

    try {
      await api.update('habits', habit.id, {
        completedDates: newCompletedDates,
        streak: newStreak
      });
      fetchHabits();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update habit.');
    }
  };

  const deleteHabit = async (habitId: string) => {
    if (!user) return;
    try {
      await api.remove('habits', habitId);
      fetchHabits();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete habit.');
    }
  };

  const doneToday = habits.filter(h => h.completedDates?.includes(todayStr)).length;
  const bestStreak = Math.max(0, ...habits.map(h => h.streak || 0));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Habits</h1>
        <p className="text-zinc-400 mt-1">Build consistent behaviors, one day at a time</p>
      </header>
      {error && <p role="alert" className="text-red-400">{error}</p>}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-neon-green">{habits.length}</span>
          <span className="text-xs text-zinc-500 mt-1">Total Habits</span>
        </div>
        <div className="bg-bg-card border border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-neon-orange">{doneToday}</span>
          <span className="text-xs text-zinc-500 mt-1">Done Today</span>
        </div>
        <div className="bg-bg-card border border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-neon-yellow">{bestStreak}</span>
          <span className="text-xs text-zinc-500 mt-1">Best Streak</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-neon-green text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#2eeb5c] transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} 
          {showForm ? 'Cancel' : 'New Habit'}
        </button>
      </div>

      {showForm && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleAddHabit}
          className="bg-bg-card border border-border-dark p-6 rounded-2xl flex gap-4"
        >
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="E.g., Drink 2L of water"
            className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
            autoFocus
          />
          <button 
            type="submit"
            disabled={isSubmitting || !newHabitName.trim()}
            className="bg-neon-green text-black px-6 py-2 rounded-xl font-bold disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add'}
          </button>
        </motion.form>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Your Habits</h2>
        
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading habits...</div>
        ) : habits.length === 0 ? (
          <div className="bg-bg-card border border-border-dark border-dashed p-10 rounded-2xl text-center">
            <h3 className="text-zinc-300 font-medium mb-1">No habits yet</h3>
            <p className="text-zinc-500 text-sm">Create habits to track your daily routines</p>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map(habit => {
              const isDone = habit.completedDates?.includes(todayStr);
              return (
                <div key={habit.id} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleHabit(habit)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isDone 
                          ? 'bg-neon-green border-neon-green text-black' 
                          : 'border-zinc-600 text-transparent hover:border-neon-green'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className={`font-medium ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                        {habit.title || habit.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {habit.streak || 0} day streak
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteHabit(habit.id)}
                    className="text-zinc-600 hover:text-neon-orange opacity-0 group-hover:opacity-100 transition-opacity p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </motion.div>
  );
}

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, TrendingUp, Activity, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';


import { useAuth } from '../contexts/AuthContext';
import { format, isSameDay } from 'date-fns';

export function Analytics() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [checkins, setCheckins] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [evaluationText, setEvaluationText] = useState('');
  const [helpedText, setHelpedText] = useState('');
  const [hurtText, setHurtText] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const checkinsForDate = selectedDate ? checkins.filter(c => isSameDay(new Date(c.date), selectedDate)) : [];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        setError('');
        const allData = await api.list<any>('checkins', { limit: '500' });

        allData.sort((a: any, b: any) => {
          const tA = new Date(a.timestamp || 0).getTime();
          const tB = new Date(b.timestamp || 0).getTime();
          return tB - tA;
        });

        const recentData = allData.slice(0, 30);

        const data = recentData.map(val => {
          const date = new Date(val.timestamp || 0);
          return {
            ...val,
            date,
            name: format(date, 'MMM d'),
            time: format(date, 'HH:mm'),
            adherence: val.stats?.adherence || 0,
            energy: val.stats?.energy || 0,
            mood: val.stats?.mood || 0,
            stress: val.stats?.stress || 0,
            focus: val.stats?.focus || 0,
            note: val.note || '',
          };
        }).reverse();
        setCheckins(data);

        setEvaluations(await api.list('evaluations', { limit: '10' }));

        const hData = (await api.list('health-logs', { limit: '30' })).map(data => {
          const date = new Date(String(data.date || '')); 
          // Adjust for timezone offset to prevent shifting
          const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
          return {
            date: localDate,
            name: format(localDate, 'MMM d'),
            calories: (data.meals as any[] | undefined)?.reduce((sum: number, m: any) => sum + Number(m.calories || 0), 0) || 0
          };
        }).reverse();
        setHealthData(hData);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!loading && location.hash === '#performance') {
      const el = document.getElementById('performance');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [loading, location.hash]);

  const handleSaveEvaluation = async () => {
    if (!user || !evaluationText.trim()) return;
    setSavingEval(true);
    try {
      const newEval = {
        timestamp: new Date().toISOString(),
        evaluation: evaluationText,
        helped: helpedText,
        hurt: hurtText,
        rule: ruleText
      };
      const docRef = await api.create('evaluations', newEval);
      setEvaluations([{ id: docRef.id, ...newEval }, ...evaluations]);
      setEvaluationText('');
      setHelpedText('');
      setHurtText('');
      setRuleText('');
    } catch (error) {
      console.error("Error saving evaluation", error);
    } finally {
      setSavingEval(false);
    }
  };

  const checkinsWithNotes = checkins.filter(c => c.note && c.note.trim().length > 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Meat Suit Insights</h1>
        <p className="text-zinc-400 mt-1">Track your progress and identify patterns</p>
      </header>
      {error && <p role="alert" className="text-red-400">{error}</p>}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-neon-orange font-bold text-xl">
            <Flame className="w-5 h-5" /> {profile?.currentStreak || 0}
          </div>
          <span className="text-xs text-zinc-500 mt-1">Day Streak</span>
        </div>
        <div className="bg-bg-card border border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-neon-cyan font-bold text-xl">
            <TrendingUp className="w-5 h-5" /> {profile?.longestStreak || 0}
          </div>
          <span className="text-xs text-zinc-500 mt-1">Longest Streak</span>
        </div>
        <div className="bg-bg-card border border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-neon-pink font-bold text-xl">
            <Activity className="w-5 h-5" /> {checkins.length}
          </div>
          <span className="text-xs text-zinc-500 mt-1">Total Check-ins</span>
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6" id="performance">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-2 uppercase">Overall Performance Trends</h2>
        <p className="text-sm text-zinc-400 mb-6">"How are all my stats tracking over time?"</p>
        <div className="h-80 min-w-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">Loading data...</div>
          ) : checkins.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">No check-ins yet.</div>
          ) : (
            <ResponsiveContainer width="99%" height="100%">
              <LineChart data={checkins} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#222', color: '#fff' }} 
                  labelFormatter={(label, payload) => payload && payload.length ? `${label} ${payload[0].payload.time}` : label}
                />
                <Line type="monotone" dataKey="adherence" name="Adherence" stroke="var(--color-neon-green)" strokeWidth={2} dot={false} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="energy" name="Energy" stroke="var(--color-neon-cyan)" strokeWidth={2} dot={false} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="mood" name="Mood" stroke="var(--color-neon-pink)" strokeWidth={2} dot={false} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="stress" name="Stress" stroke="var(--color-neon-orange)" strokeWidth={2} dot={false} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="focus" name="Focus" stroke="var(--color-neon-purple)" strokeWidth={2} dot={false} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-2 uppercase">Adherence to Plan</h2>
        <p className="text-sm text-zinc-400 mb-6">"Is the meat suit doing what I know is good for it?"</p>
        <div className="h-64 min-w-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">Loading data...</div>
          ) : checkins.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">No check-ins yet.</div>
          ) : (
            <ResponsiveContainer width="99%" height="100%">
              <LineChart data={checkins} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#222', color: '#fff' }} 
                  itemStyle={{ color: 'var(--color-neon-green)' }}
                  labelFormatter={(label, payload) => payload && payload.length ? `${label} ${payload[0].payload.time}` : label}
                />
                <Line type="monotone" dataKey="adherence" name="Adherence" stroke="var(--color-neon-green)" strokeWidth={3} dot={{fill: 'var(--color-neon-green)', r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-2 uppercase">Daily Calorie Intake</h2>
        <p className="text-sm text-zinc-400 mb-6">"How are my calories tracking over time?"</p>
        <div className="h-64 min-w-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">Loading data...</div>
          ) : healthData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">No health data yet.</div>
          ) : (
            <ResponsiveContainer width="99%" height="100%">
              <LineChart data={healthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#222', color: '#fff' }} 
                />
                <Line type="monotone" dataKey="calories" name="Calories" stroke="var(--color-neon-yellow)" strokeWidth={2} dot={{fill: 'var(--color-neon-yellow)', r: 3}} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-6 uppercase">Mood & Energy Trend</h2>
        <div className="h-64 min-w-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">Loading data...</div>
          ) : checkins.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">No check-ins yet.</div>
          ) : (
            <ResponsiveContainer width="99%" height="100%">
              <LineChart data={checkins} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#222', color: '#fff' }} 
                  labelFormatter={(label, payload) => payload && payload.length ? `${label} ${payload[0].payload.time}` : label}
                />
                <Line type="monotone" dataKey="energy" name="Energy" stroke="var(--color-neon-cyan)" strokeWidth={2} dot={{fill: 'var(--color-neon-cyan)', r: 3}} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="mood" name="Mood" stroke="var(--color-neon-pink)" strokeWidth={2} dot={{fill: 'var(--color-neon-pink)', r: 3}} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-6 uppercase">Focus Heatmap (Time of Day)</h2>
        <div className="flex">
          <div className="flex flex-col justify-around text-xs text-zinc-500 pr-4">
            <span>Morning</span>
            <span>Evening</span>
          </div>
          <div className="flex-1 grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-zinc-500 mb-2">{day}</div>
            ))}
            {Array.from({length: 14}).map((_, i) => {
              const day = i % 7;
              const isEvening = i >= 7;
              const dayCheckins = checkins.filter(c => new Date(c.date).getDay() === day && (isEvening ? new Date(c.date).getHours() >= 18 : new Date(c.date).getHours() < 12));
              const avgFocus = dayCheckins.length > 0 ? dayCheckins.reduce((sum, c) => sum + (c.focus || 0), 0) / dayCheckins.length : 0;
              const color = avgFocus === 0 ? 'bg-[#1a1a1a]' : avgFocus < 3 ? 'bg-neon-orange' : 'bg-neon-green';
              return <div key={i} className={`aspect-square rounded-xl ${color} border border-[#222]`}></div>;
            })}
          </div>
        </div>
        <div className="flex justify-center items-center gap-4 mt-6 text-xs text-zinc-500">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-[#1a1a1a] border border-[#222]"></div> No data</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-neon-orange"></div> Low</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-neon-green"></div> High</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
          <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-2 flex items-center gap-2 uppercase">
            <div className="w-2 h-2 rounded-full bg-neon-green"></div> Helpful Behaviors
          </h2>
          <p className="text-sm text-zinc-400">Keep tracking to discover what helps you perform better.</p>
        </div>
        <div className="bg-bg-card border border-border-dark rounded-2xl p-6">
          <h2 className="text-xs font-bold text-zinc-500 tracking-wider mb-2 flex items-center gap-2 uppercase">
            <div className="w-2 h-2 rounded-full bg-neon-orange"></div> Patterns to Watch
          </h2>
          <p className="text-sm text-zinc-400">No concerning patterns detected yet.</p>
        </div>
      </div>

      <div className="bg-bg-card border border-border-dark rounded-2xl p-6 space-y-6">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase">Pilot's Weekly Evaluation</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Overall evaluation of the Meat Suit this week</label>
            <textarea 
              value={evaluationText}
              onChange={(e) => setEvaluationText(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-green min-h-[100px] resize-y" 
              placeholder="How did the week go?"
            ></textarea>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-2">What helped?</label>
              <textarea 
                value={helpedText}
                onChange={(e) => setHelpedText(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-green min-h-[100px] resize-y" 
                placeholder="What worked well?"
              ></textarea>
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-2">What hurt?</label>
              <textarea 
                value={hurtText}
                onChange={(e) => setHurtText(e.target.value)}
                className="w-full bg-bg-dark border border-border-dark rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-green min-h-[100px] resize-y" 
                placeholder="What held you back?"
              ></textarea>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-2">One rule to experiment with next week</label>
            <textarea 
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              className="w-full bg-bg-dark border border-border-dark rounded-xl p-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-neon-green min-h-[100px] resize-y" 
              placeholder="What will you try differently?"
            ></textarea>
          </div>
        </div>

        <button 
          onClick={handleSaveEvaluation}
          disabled={savingEval || !evaluationText.trim()}
          className="bg-neon-green text-black font-bold py-3 px-6 rounded-full hover:bg-[#2eeb5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingEval ? 'Saving...' : 'Save Reflection'}
        </button>
      </div>

      {evaluations.length > 0 && (
        <div className="bg-bg-card border border-border-dark rounded-2xl p-6 space-y-6">
          <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase">Past Evaluations</h2>
          <div className="space-y-6">
            {evaluations.map(ev => (
              <div key={ev.id} className="border-b border-border-dark pb-6 last:border-0 last:pb-0">
                <div className="text-xs text-zinc-500 mb-3">{format(new Date(ev.timestamp), 'MMM d, yyyy')}</div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase mb-1">Overall Evaluation</h4>
                    <p className="text-sm text-white whitespace-pre-wrap">{ev.evaluation}</p>
                  </div>
                  {(ev.helped || ev.hurt) && (
                    <div className="grid grid-cols-2 gap-4">
                      {ev.helped && (
                        <div>
                          <h4 className="text-xs font-bold text-neon-green uppercase mb-1">Helped</h4>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{ev.helped}</p>
                        </div>
                      )}
                      {ev.hurt && (
                        <div>
                          <h4 className="text-xs font-bold text-neon-orange uppercase mb-1">Hurt</h4>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{ev.hurt}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {ev.rule && (
                    <div>
                      <h4 className="text-xs font-bold text-neon-cyan uppercase mb-1">Rule to Experiment With</h4>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{ev.rule}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkins.length > 0 && (
        <div className="bg-bg-card border border-border-dark rounded-2xl p-6 space-y-6">
          <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase">Daily Observations Log</h2>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, index) => {
              const first = new Date(); first.setDate(1);
              const start = new Date(first); start.setDate(1 - first.getDay());
              const day = new Date(start); day.setDate(start.getDate() + index);
              const hasCheckin = checkins.some(c => isSameDay(new Date(c.date), day));
              return <button key={day.toISOString()} onClick={() => handleDateClick(day)} className={`aspect-square rounded-lg border text-xs ${hasCheckin ? 'border-neon-green bg-neon-green/20 text-white' : 'border-border-dark text-zinc-500'} ${day.getMonth() !== first.getMonth() ? 'opacity-40' : ''}`}>{format(day, 'd')}{hasCheckin && <span className="block text-neon-green">●</span>}</button>;
            })}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-dark rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            {checkinsForDate.length > 0 ? (
              <div className="space-y-4">
                {checkinsForDate.map(c => (
                  <div key={c.id} className="bg-bg-dark border border-border-dark p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-bold text-neon-green">{c.time}</div>
                      <div className="flex gap-2 text-xs text-zinc-500">
                        <span>Mood: {c.mood}</span>
                        <span>Energy: {c.energy}</span>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{c.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 italic text-center py-8">No logs for this day.</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

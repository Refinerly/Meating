import React, { useCallback, useEffect, useState } from 'react';
import { api, type ApiRecord } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

type Quest = { id: string; [key: string]: any;  date: string; title: string; dueTime?: string; completed: boolean; missionId?: string; projectId?: string };
type View = 'day' | 'week' | 'month';

export function Calendar() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>('week');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [missions, setMissions] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    const start = view === 'month' ? startOfMonth(date) : view === 'week' ? startOfWeek(date) : date;
    const end = view === 'month' ? endOfMonth(date) : view === 'week' ? addDays(startOfWeek(date), 6) : date;
    try {
      const [items, missionItems] = await Promise.all([api.list<Quest>('quests', { from: format(start,'yyyy-MM-dd'), to: format(end,'yyyy-MM-dd') }), api.list('missions')]);
      setQuests(items); setMissions(missionItems);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your calendar.'); }
    finally { setLoading(false); }
  }, [user, date, view]);

  useEffect(() => { void load(); }, [load]);
  const days = view === 'day' ? [date] : view === 'week' ? Array.from({length:7},(_,i)=>addDays(startOfWeek(date),i)) : eachDayOfInterval({start:startOfWeek(startOfMonth(date)),end:addDays(startOfWeek(endOfMonth(date)),6)});
  const change = (direction: number) => setDate(current => view === 'day' ? (direction > 0 ? addDays(current,1) : subDays(current,1)) : view === 'week' ? (direction > 0 ? addWeeks(current,1) : subWeeks(current,1)) : new Date(current.getFullYear(),current.getMonth()+direction,1));
  const toggle = async (quest: Quest) => { try { await api.update('quests',quest.id,{completed:!quest.completed}); await load(); } catch(e) { setError(e instanceof Error?e.message:'Could not update quest.'); } };
  const periodLabel = view==='day' ? format(date,'MMMM d, yyyy') : view==='week' ? `${format(days[0],'MMM d')} – ${format(days[6],'MMM d, yyyy')}` : format(date,'MMMM yyyy');

  return <div className="space-y-6">
    <header><h1 className="text-3xl font-bold text-white flex items-center gap-3"><CalendarIcon className="text-neon-cyan"/> Calendar</h1><p className="text-zinc-400 mt-1">Your quests and tasks, stored privately in Meating.</p></header>
    <section className="bg-bg-card border border-border-dark rounded-2xl p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button aria-label="Previous period" onClick={()=>change(-1)} className="p-2 rounded-lg bg-zinc-900 text-white"><ChevronLeft/></button><button aria-label="Next period" onClick={()=>change(1)} className="p-2 rounded-lg bg-zinc-900 text-white"><ChevronRight/></button><h2 className="font-bold text-white">{periodLabel}</h2></div><div className="flex rounded-lg bg-zinc-900 p-1">{(['day','week','month'] as const).map(item=><button key={item} onClick={()=>setView(item)} className={`capitalize px-3 py-1.5 rounded-md text-sm ${view===item?'bg-neon-green text-black':'text-zinc-400'}`}>{item}</button>)}</div></div>
      {error&&<p role="alert" className="text-red-400">{error}</p>}{loading?<div className="py-12 text-center text-zinc-500">Loading quests…</div>:<div className={`grid gap-3 ${view==='day'?'grid-cols-1':view==='month'?'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4':'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
        {days.map(day=>{const dayKey=format(day,'yyyy-MM-dd');const items=quests.filter(q=>q.date===dayKey);return <article key={dayKey} className={`min-h-36 rounded-xl border p-3 ${isToday(day)?'border-neon-green/50 bg-neon-green/5':'border-border-dark bg-bg-dark'} ${view==='month'&&!isSameMonth(day,date)?'opacity-40':''}`}><h3 className="font-bold text-white mb-3">{format(day,view==='month'?'EEE d':'EEEE, MMM d')}{isToday(day)&&<span className="ml-2 text-xs text-neon-green">TODAY</span>}</h3>{items.length?items.map(q=><button key={q.id} onClick={()=>void toggle(q)} className="w-full text-left flex gap-2 items-start p-2 mb-1 rounded-lg hover:bg-zinc-900"><span className={q.completed?'text-neon-green':'text-zinc-500'}>{q.completed?<CheckCircle2 size={17}/>:<Circle size={17}/>}</span><span className={q.completed?'text-zinc-500 line-through':'text-zinc-200'}>{q.dueTime&&<span className="mr-2 text-xs text-neon-cyan">{q.dueTime}</span>}{q.title}<small className="block text-zinc-500">{String(missions.find(m=>m.id===q.missionId)?.title||'')}</small></span></button>):<p className="text-sm text-zinc-600 italic">No quests scheduled</p>}</article>})}
      </div>}
    </section>
  </div>;
}
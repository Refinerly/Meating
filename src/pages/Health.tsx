import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays, subDays } from 'date-fns';
import { Activity, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';

type NamedItem = { name: string; taken: boolean };
type Meal = { name: string; time: string; calories: number; notes?: string };
type HealthLog = { weight?: number | null; sleepTime?: string; wakeTime?: string; exercises?: string[]; supplements?: NamedItem[]; teas?: NamedItem[]; meals?: Meal[] };
const emptyLog = (): HealthLog => ({ weight: null, sleepTime: '', wakeTime: '', exercises: [], supplements: [], teas: [], meals: [] });

export function Health() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date());
  const [log, setLog] = useState<HealthLog>(emptyLog());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exercise, setExercise] = useState('');
  const [supplement, setSupplement] = useState('');
  const [tea, setTea] = useState('');
  const [meal, setMeal] = useState<Meal>({name:'',time:format(new Date(),'HH:mm'),calories:0,notes:''});
  const day = format(date,'yyyy-MM-dd');
  const load = useCallback(async()=>{if(!user)return;setLoading(true);setError('');try{const result=await api.health(day);setLog(result.item?{...emptyLog(),...result.item} as HealthLog:emptyLog());}catch(e){setError(e instanceof Error?e.message:'Unable to load this health log.');}finally{setLoading(false);}},[user,day]);
  useEffect(()=>{void load();},[load]);
  const save = async()=>{setSaving(true);setError('');try{await api.saveHealth(day,log);setError('Saved.');}catch(e){setError(e instanceof Error?e.message:'Unable to save health log.');}finally{setSaving(false);}};
  const updateList=<K extends 'exercises'|'supplements'|'teas'|'meals'>(key:K,items:NonNullable<HealthLog[K]>)=>setLog(current=>({...current,[key]:items}));
  const addName=(key:'exercises'|'supplements'|'teas',value:string,setter:(v:string)=>void)=>{if(!value.trim())return;const old=log[key]||[];const next=key==='exercises'?[...old as string[],value.trim()]:[...old as NamedItem[],{name:value.trim(),taken:true}];setLog(current=>({...current,[key]:next}));setter('');};
  const toggleNamed=(key:'supplements'|'teas',index:number)=>updateList(key,(log[key]||[]).map((item,i)=>i===index?{...item,taken:!item.taken}:item));
  const remove=(key:'exercises'|'supplements'|'teas'|'meals',index:number)=>updateList(key,(log[key]||[]).filter((_,i)=>i!==index) as never);
  const addMeal=()=>{if(!meal.name.trim())return;updateList('meals',[...(log.meals||[]),meal]);setMeal({name:'',time:format(new Date(),'HH:mm'),calories:0,notes:''});};
  const estimate=async()=>{if(!meal.name.trim())return;try{const result=await api.estimateCalories(meal.name);setMeal(current=>({...current,calories:result.calories,notes:[current.notes,result.notes].filter(Boolean).join(' — ')}));}catch(e){setError(e instanceof Error?e.message:'AI estimate unavailable. Enter calories manually.');}};
  const textInput='w-full rounded-lg bg-zinc-900 border border-border-dark px-3 py-2 text-white focus:outline-none focus:border-neon-green';
  return <div className="space-y-6"><header><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Activity className="text-neon-green"/> Health</h1><p className="text-zinc-400 mt-1">A private daily log, saved to your Meating database.</p></header>
    <div className="flex items-center justify-between bg-bg-card border border-border-dark rounded-xl p-4"><button aria-label="Previous day" onClick={()=>setDate(d=>subDays(d,1))} className="p-2 text-white"><ChevronLeft/></button><h2 className="font-bold text-white">{format(date,'EEEE, MMMM d, yyyy')}</h2><button aria-label="Next day" onClick={()=>setDate(d=>addDays(d,1))} className="p-2 text-white"><ChevronRight/></button></div>
    {error&&<p role="status" className={error==='Saved.'?'text-neon-green':'text-red-400'}>{error}</p>}{loading?<div className="p-10 text-center text-zinc-500">Loading health log…</div>:<div className="space-y-5">
      <section className="grid sm:grid-cols-3 gap-4 bg-bg-card border border-border-dark rounded-2xl p-5"><label className="text-sm text-zinc-300">Weight<input className={`${textInput} mt-2`} type="number" min="0" step="0.1" value={log.weight??''} onChange={e=>setLog({...log,weight:e.target.value===''?null:Number(e.target.value)})}/></label><label className="text-sm text-zinc-300">Sleep time<input className={`${textInput} mt-2`} type="time" value={log.sleepTime||''} onChange={e=>setLog({...log,sleepTime:e.target.value})}/></label><label className="text-sm text-zinc-300">Wake time<input className={`${textInput} mt-2`} type="time" value={log.wakeTime||''} onChange={e=>setLog({...log,wakeTime:e.target.value})}/></label></section>
      {(['exercises','supplements','teas'] as const).map(key=>{const value=key==='exercises'?exercise:key==='supplements'?supplement:tea;const setter=key==='exercises'?setExercise:key==='supplements'?setSupplement:setTea;return <section key={key} className="bg-bg-card border border-border-dark rounded-2xl p-5 space-y-3"><h2 className="font-bold text-white capitalize">{key}</h2><div className="flex gap-2"><input className={textInput} value={value} onChange={e=>setter(e.target.value)} placeholder={`Add ${key}`} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addName(key,value,setter);}}}/><button onClick={()=>addName(key,value,setter)} className="rounded-lg bg-zinc-800 px-3 text-white"><Plus/></button></div>{(log[key]||[]).map((item,index)=>{const title=typeof item==='string'?item:item.name;const done=typeof item==='string'?true:item.taken;return <div key={`${title}-${index}`} className="flex items-center justify-between text-zinc-300"><label className="flex gap-2 items-center">{key!=='exercises'&&<input type="checkbox" checked={done} onChange={()=>toggleNamed(key,index)}/>}<span>{title}</span></label><button aria-label={`Remove ${title}`} onClick={()=>remove(key,index)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16}/></button></div>})}</section>})}
      <section className="bg-bg-card border border-border-dark rounded-2xl p-5 space-y-3"><h2 className="font-bold text-white">Meals</h2><div className="grid sm:grid-cols-2 gap-3"><input className={textInput} placeholder="Meal" value={meal.name} onChange={e=>setMeal({...meal,name:e.target.value})}/><input className={textInput} type="time" value={meal.time} onChange={e=>setMeal({...meal,time:e.target.value})}/><input className={textInput} type="number" min="0" placeholder="Calories" value={meal.calories||''} onChange={e=>setMeal({...meal,calories:Number(e.target.value)})}/><input className={textInput} placeholder="Notes" value={meal.notes||''} onChange={e=>setMeal({...meal,notes:e.target.value})}/></div><div className="flex gap-2"><button onClick={()=>void estimate()} className="rounded-lg bg-zinc-800 px-4 py-2 text-zinc-200">Estimate calories with AI</button><button onClick={addMeal} className="rounded-lg bg-neon-green px-4 py-2 font-bold text-black">Add meal</button></div>{(log.meals||[]).map((item,index)=><div key={`${item.name}-${index}`} className="flex justify-between text-zinc-300"><span>{item.time} · {item.name} · {item.calories} kcal {item.notes&&`· ${item.notes}`}</span><button onClick={()=>remove('meals',index)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16}/></button></div>)}</section>
      <div className="flex justify-end"><button onClick={()=>void save()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-neon-green px-6 py-3 font-bold text-black disabled:opacity-50"><Save size={18}/>{saving?'Saving…':'Save health log'}</button></div>
    </div>}</div>;
}
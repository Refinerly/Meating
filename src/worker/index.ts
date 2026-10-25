import { isResponse, requireIdentity } from './identity';
import type { AccessContext, Env, Identity } from './types';

type Row = Record<string, unknown>;
const headers = { 'Cache-Control': 'no-store' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const fail = (message: string, status: number) => json({ error: message }, status);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const camel = (value: string) => value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
const parseRow = (row: Row, jsonFields: readonly string[] = []) => Object.fromEntries(Object.entries(row)
  .filter(([key]) => key !== 'user_id')
  .map(([key, value]) => [camel(key), jsonFields.includes(key) && typeof value === 'string' ? JSON.parse(value) : key === 'completed' ? Boolean(value) : value]));

const collections = {
  checkins: { table: 'checkins', fields: { timestamp: 'timestamp', stats: 'stats', socialBehavior: 'social_behavior', note: 'note', nudgesApplied: 'nudges_applied' }, json: ['stats', 'nudges_applied'], order: 'timestamp DESC' },
  projects: { table: 'projects', fields: { title: 'title', description: 'description', notionLink: 'notion_link', status: 'status' }, order: 'created_at DESC' },
  missions: { table: 'missions', fields: { projectId: 'project_id', title: 'title', description: 'description', category: 'category', status: 'status' }, order: 'created_at DESC' },
  quests: { table: 'quests', fields: { projectId: 'project_id', missionId: 'mission_id', title: 'title', dueTime: 'due_time', completed: 'completed', date: 'date' }, order: 'date ASC, due_time ASC' },
  habits: { table: 'habits', fields: { title: 'title', missionId: 'mission_id', schedule: 'schedule', streak: 'streak', completedDates: 'completed_dates' }, json: ['completed_dates'], order: 'created_at DESC' },
  accounts: { table: 'accounts', fields: { name: 'name', balance: 'balance' }, order: 'created_at ASC' },
  bills: { table: 'bills', fields: { name: 'name', amount: 'amount', dueDate: 'due_date' }, order: 'due_date ASC' },
  expenses: { table: 'expenses', fields: { name: 'name', amount: 'amount', date: 'date' }, order: 'date DESC' },
  wishlist: { table: 'wishlist', fields: { name: 'name', cost: 'cost', imageUrl: 'image_url' }, order: 'created_at DESC' },
  evaluations: { table: 'evaluations', fields: { timestamp: 'timestamp', evaluation: 'evaluation', helped: 'helped', hurt: 'hurt', rule: 'rule' }, order: 'timestamp DESC' },
} as const;
type CollectionName = keyof typeof collections;

async function readBody(request: Request): Promise<Row | Response> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Row : fail('Expected a JSON object', 400);
  } catch { return fail('Invalid JSON body', 400); }
}

async function ensureUser(env: Env, identity: Identity) {
  const userId=identity.email.toLowerCase();
  await env.DB.prepare("INSERT INTO users(id,email,name) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    .bind(userId, identity.email, identity.name).run();
  await env.DB.prepare('INSERT OR IGNORE INTO profiles(user_id) VALUES(?)').bind(userId).run();
  await env.DB.prepare('INSERT OR IGNORE INTO user_settings(user_id) VALUES(?)').bind(userId).run();
}

async function api(request: Request, env: Env, identity: Identity) {
  const url = new URL(request.url);
  let parts: string[];
  try { parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); }
  catch { return fail('Invalid resource path', 400); }
  const [resource, id] = parts;
  const userId = identity.email.toLowerCase();
  if (parts.length > 2) return fail('Not found', 404);
  if (resource === 'health' && !id && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT 1 AS ok').first<{ok:number}>();
    return json({ ok: Boolean(result?.ok) });
  }
  if (resource === 'me' && !id && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(userId).first<Row>();
    const profile = row ? { ...parseRow(row, ['check_in_times', 'badges']), uid: userId } : null;
    return json({ user: { email: identity.email, name: identity.name }, profile });
  }
  if (resource === 'profile' && !id && (request.method === 'PATCH'||request.method==='GET')) {
    if(request.method==='GET'){const profile=await env.DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(userId).first<Row>();return profile?json({profile:{...parseRow(profile,['check_in_times','badges']),uid:userId}}):fail('Profile not found',404);}
    const body = await readBody(request); if (body instanceof Response) return body;
    const fields: Record<string, string> = { pilotLevel: 'pilot_level', avatarLevel: 'avatar_level', pilotWins: 'pilot_wins', avatarWins: 'avatar_wins', currentStreak: 'current_streak', longestStreak: 'longest_streak', checkInTimes: 'check_in_times', badges: 'badges', lastCheckInDate: 'last_check_in_date' };
    const values = Object.entries(fields).filter(([key]) => Object.hasOwn(body, key));
    if (!values.length) return fail('No profile fields provided', 400);
    if(request.method!=='PATCH')return fail('Method not allowed',405);
    if (values.some(([key]) => ['pilotLevel','avatarLevel','pilotWins','avatarWins','currentStreak','longestStreak'].includes(key) && (!Number.isInteger(body[key]) || Number(body[key]) < 0))) return fail('Profile levels and wins must be non-negative integers', 400);
    if (Object.hasOwn(body,'lastCheckInDate') && (typeof body.lastCheckInDate!=='string'||!validDate(body.lastCheckInDate))) return fail('Invalid last check-in date',400);
    if (values.some(([key]) => ['checkInTimes','badges'].includes(key) && !Array.isArray(body[key]))) return fail('Check-in times and badges must be arrays',400);
    if (Object.hasOwn(body,'checkInTimes') && (body.checkInTimes as unknown[]).some(time=>typeof time!=='string'||!/^\d{2}:\d{2}$/.test(time)||Number(time.slice(0,2))>23||Number(time.slice(3,5))>59)) return fail('Check-in times must be valid 24-hour times',400);
    if (Object.hasOwn(body,'badges') && (body.badges as unknown[]).some(badge=>typeof badge!=='string')) return fail('Badges must be strings',400);
    const bindings: [string, unknown][] = values.map(([key, column]) => [column, ['checkInTimes','badges'].includes(key) ? JSON.stringify(body[key]) : body[key]]);
    if (Object.hasOwn(body,'lastCheckInDate')) bindings.push(['last_check_in_date',body.lastCheckInDate]);
    if(Object.hasOwn(body,'pilotWins')){const wins=Number(body.pilotWins);let level=1,needed=100,xp=wins;while(xp>=needed){xp-=needed;level++;needed=level*100;}const index=bindings.findIndex(([column])=>column==='pilot_level');if(index>=0)bindings[index]=['pilot_level',level];else bindings.push(['pilot_level',level]);}
    if(Object.hasOwn(body,'avatarWins')){const wins=Number(body.avatarWins);let level=1,needed=100,xp=wins;while(xp>=needed){xp-=needed;level++;needed=level*100;}const index=bindings.findIndex(([column])=>column==='avatar_level');if(index>=0)bindings[index]=['avatar_level',level];else bindings.push(['avatar_level',level]);}
    await env.DB.prepare(`UPDATE profiles SET ${bindings.map(([column]) => `${column}=?`).join(',')},updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=?`).bind(...bindings.map(([, value]) => value), userId).run();
    const updated=await env.DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(userId).first<Row>();
    return json({ profile: { ...parseRow(updated!, ['check_in_times','badges']), uid: userId } });
  }
  if(resource==='settings'){
    if(id)return fail('Not found',404);
    if(request.method==='GET'){const row=await env.DB.prepare('SELECT preferences FROM user_settings WHERE user_id=?').bind(userId).first<{preferences:string}>();return json({settings:row?JSON.parse(row.preferences):{}});}
    if(request.method!=='PUT'&&request.method!=='PATCH')return fail('Method not allowed',405);
    const body=await readBody(request);if(body instanceof Response)return body;
    const old=await env.DB.prepare('SELECT preferences FROM user_settings WHERE user_id=?').bind(userId).first<{preferences:string}>();
    const settings={...(old?JSON.parse(old.preferences):{}),...body};
    if(Object.hasOwn(body,'schedule')&&(!Array.isArray(body.schedule)||body.schedule.some(item=>!item||typeof item!=='object'||typeof item.time!=='string'||!/^\d{2}:\d{2}$/.test(item.time)||Number(item.time.slice(0,2))>23||Number(item.time.slice(3,5))>59||typeof item.active!=='boolean')))return fail('Schedule must contain valid reminder times',400);
    if(Object.hasOwn(body,'notifications')&&typeof body.notifications!=='boolean')return fail('Notifications must be a boolean',400);
    if(Object.hasOwn(body,'weightGoal')&&body.weightGoal!==null&&(typeof body.weightGoal!=='object'||Array.isArray(body.weightGoal)))return fail('Weight goal must be an object',400);
    await env.DB.prepare("INSERT INTO user_settings(user_id,preferences) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(userId,JSON.stringify(settings)).run();
    return json({settings});
  }

  if (resource === 'health-logs' && id && (request.method === 'GET' || request.method === 'PUT')) {
    if (!validDate(id)) return fail('Invalid date', 400);
    const columns = { weight: 'weight', sleepTime: 'sleep_time', wakeTime: 'wake_time', exercises: 'exercises', supplements: 'supplements', teas: 'teas', meals: 'meals' };
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM health_logs WHERE user_id=? AND date=?').bind(userId,id).first<Row>();
      return json({ item: row ? parseRow(row,['exercises','supplements','teas','meals']) : null });
    }
    const body = await readBody(request); if (body instanceof Response) return body;
    const entries = Object.entries(columns).filter(([key]) => Object.hasOwn(body,key));
    if (entries.some(([key]) => ['exercises','supplements','teas','meals'].includes(key) && (body[key] as unknown[]).some(item=>typeof item!=='string'&&(!item||typeof item!=='object'||Array.isArray(item))))) return fail('Health log list items must be strings or objects',400);
    if (Object.hasOwn(body,'exercises')&&(body.exercises as unknown[]).some(item=>typeof item!=='string')) return fail('Exercise entries must be strings',400);
    if (Object.hasOwn(body,'supplements')&&(body.supplements as unknown[]).some(item=>typeof item==='object'&&item!==null&&('name' in item)&&typeof (item as Row).name!=='string')) return fail('Supplement names must be strings',400);
    if (Object.hasOwn(body,'teas')&&(body.teas as unknown[]).some(item=>typeof item==='object'&&item!==null&&('name' in item)&&typeof (item as Row).name!=='string')) return fail('Tea names must be strings',400);
    if (Object.hasOwn(body,'meals')&&(body.meals as unknown[]).some(item=>typeof item==='object'&&item!==null&&(!('name' in item)||(item as Row).name&&typeof (item as Row).name!=='string'||('calories' in item&&!Number.isFinite(Number((item as Row).calories)))))) return fail('Meal entries are invalid',400);
    if (entries.some(([key]) => ['sleepTime','wakeTime'].includes(key) && typeof body[key] !== 'string')) return fail('Sleep and wake times must be strings',400);
    if (entries.some(([key]) => ['sleepTime','wakeTime'].includes(key) && typeof body[key] === 'string' && body[key] !== '' && (!/^\d{2}:\d{2}$/.test(body[key] as string) || Number((body[key] as string).slice(0,2))>23 || Number((body[key] as string).slice(3,5))>59))) return fail('Sleep and wake times must be valid 24-hour times',400);
    if (entries.some(([key]) => ['exercises','supplements','teas','meals'].includes(key) && !Array.isArray(body[key]))) return fail('Health log lists must be arrays',400);
    if ('weight' in body && body.weight !== null && (typeof body.weight !== 'number' || !Number.isFinite(body.weight))) return fail('Weight must be a number',400);
    const columnsToWrite = ['date',...entries.map(([,column])=>column)];
    const values: unknown[] = [id,...entries.map(([key])=>Array.isArray(body[key])?JSON.stringify(body[key]):body[key])];
    await env.DB.prepare(`INSERT INTO health_logs(id,user_id,${columnsToWrite.join(',')}) VALUES(?,?,${columnsToWrite.map(()=>'?').join(',')}) ON CONFLICT(user_id,date) DO UPDATE SET ${['id=excluded.id',...entries.map(([,column])=>`${column}=excluded.${column}`),"updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')"].join(',')}`)
      .bind(id,userId,...values).run();
    const row = await env.DB.prepare('SELECT * FROM health_logs WHERE user_id=? AND date=?').bind(userId,id).first<Row>();
    return json(parseRow(row!,['exercises','supplements','teas','meals']));
  }
  if (resource === 'health-logs' && !id && request.method === 'GET') {
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    if ((from && !validDate(from)) || (to && !validDate(to))) return fail('Invalid date range',400);
    const clauses = ['user_id=?']; const args: unknown[] = [userId];
    if (from) {clauses.push('date>=?');args.push(from);} if (to) {clauses.push('date<=?');args.push(to);}
    const rows = await env.DB.prepare(`SELECT * FROM health_logs WHERE ${clauses.join(' AND ')} ORDER BY date DESC LIMIT 500`).bind(...args).all<Row>();
    return json({items:rows.results.map(row=>parseRow(row,['exercises','supplements','teas','meals']))});
  }
  if (resource === 'estimate-calories' && !id && request.method === 'POST') {
    const body = await readBody(request); if (body instanceof Response) return body;
    if (typeof body.mealName !== 'string' || !body.mealName.trim() || body.mealName.length>500) return fail('Meal name must be between 1 and 500 characters',400);
    if (!env.AI) return fail('AI estimate is unavailable. Please enter calories manually.',503);
    try {
      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:'Estimate calories for one described meal. Return only JSON: {"calories": integer, "notes": string}. State clearly this is an estimate.'},{role:'user',content:body.mealName.trim()}],max_tokens:180}) as {response?:string};
      const estimate = JSON.parse(result.response?.match(/\{[\s\S]*\}/)?.[0]??'null');
      if (!Number.isFinite(estimate?.calories)||typeof estimate?.notes!=='string') return fail('AI returned an invalid estimate. Please enter calories manually.',502);
      return json({calories:Math.max(0,Math.round(estimate.calories)),notes:estimate.notes});
    } catch {return fail('AI estimate is unavailable. Please enter calories manually.',503);}
  }
  if (resource === 'reset' && !id && request.method === 'POST') {
    await env.DB.batch(['checkins','health_logs','projects','missions','quests','habits','accounts','bills','expenses','wishlist','evaluations'].map(table=>env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(userId)));
    await env.DB.prepare("UPDATE profiles SET pilot_level=1,avatar_level=1,pilot_wins=0,avatar_wins=0,current_streak=0,longest_streak=0,last_check_in_date=NULL,check_in_times='[\"08:00\",\"12:00\",\"18:00\"]',badges='[]' WHERE user_id=?").bind(userId).run();
    await env.DB.prepare("UPDATE user_settings SET preferences='{}' WHERE user_id=?").bind(userId).run(); return json({ok:true});
  }
  const config = collections[resource as CollectionName];
  if (!config) return fail('Not found',404);
  if (request.method==='GET'&&!id) {
    const clauses=['user_id=?'];const args:unknown[]=[userId];
    if ('date' in config.fields) for(const key of ['date','from','to'] as const){const value=url.searchParams.get(key);if(!value)continue;if(!validDate(value))return fail('Invalid date',400);clauses.push(`${key==='date'?'date':`date${key==='from'?'>=':'<='}`}=?`);args.push(value);}
    if(resource==='checkins'){const from=url.searchParams.get('from'),to=url.searchParams.get('to');if(from){if(Number.isNaN(Date.parse(from)))return fail('Invalid timestamp',400);clauses.push('timestamp>=?');args.push(from);}if(to){if(Number.isNaN(Date.parse(to)))return fail('Invalid timestamp',400);clauses.push('timestamp<=?');args.push(to);}}
    const limit=Math.min(500,Math.max(1,Number(url.searchParams.get('limit'))||500));
    const rows=await env.DB.prepare(`SELECT * FROM ${config.table} WHERE ${clauses.join(' AND ')} ORDER BY ${config.order} LIMIT ?`).bind(...args,limit).all<Row>();
    return json({items:rows.results.map(row=>parseRow(row,'json'in config?config.json:[]))});
  }
  if(request.method==='POST'&&!id){
    const body=await readBody(request);if(body instanceof Response)return body;
    const entries=Object.entries(config.fields).filter(([key])=>Object.hasOwn(body,key));if(!entries.length)return fail('No supported fields provided',400);
    if(entries.some(([key])=>['nudgesApplied','completedDates'].includes(key)&&!Array.isArray(body[key])))return fail('List fields must be arrays',400);
    if(Object.hasOwn(body,'stats')&&(!body.stats||typeof body.stats!=='object'||Array.isArray(body.stats)))return fail('Stats must be an object',400);
    if(entries.some(([key])=>['title','name','timestamp','date'].includes(key)&&typeof body[key]!=='string'))return fail('Required text fields must be strings',400);
    if(entries.some(([key])=>['title','name','timestamp','date'].includes(key)&&typeof body[key]==='string'&&!(body[key] as string).trim()))return fail('Required text fields cannot be empty',400);
    if(entries.some(([key])=>['amount','balance','cost','streak','dueDate'].includes(key)&&(!Number.isFinite(Number(body[key]))||(['amount','cost','streak','dueDate'].includes(key)&&Number(body[key])<0)|| (key==='dueDate'&&(Number(body[key])<1||Number(body[key])>31)))))return fail('Numeric field is invalid',400);
    if('completed' in body&&typeof body.completed!=='boolean')return fail('Completed must be a boolean',400);
    if('date' in body&&(!('date' in config.fields)||typeof body.date!=='string'||!validDate(body.date)))return fail('Invalid date',400);
    if('json'in config)for(const [key,column] of entries)if(config.json.includes(column as never)){const value=body[key];if(key==='stats'&&(!value||typeof value!=='object'||Array.isArray(value)))return fail('Stats must be an object',400);if(['nudgesApplied','completedDates'].includes(key)&&!Array.isArray(value))return fail('List fields must be arrays',400);}
    const jsonFields='json'in config?config.json:[];const dbValues=entries.map(([key,column])=>[column,jsonFields.includes(column as never)?JSON.stringify(body[key]):body[key]] as const);
    const recordId=typeof body.id==='string'&&body.id?body.id:crypto.randomUUID();
    try{await env.DB.prepare(`INSERT INTO ${config.table}(id,user_id,${dbValues.map(([column])=>column).join(',')}) VALUES(?,?,${dbValues.map(()=>'?').join(',')})`).bind(recordId,userId,...dbValues.map(([,value])=>value)).run();}
    catch(error){if(String(error).includes('UNIQUE'))return fail('A record with that name already exists',409);throw error;}
    const inserted=await env.DB.prepare(`SELECT * FROM ${config.table} WHERE user_id=? AND id=?`).bind(userId,recordId).first<Row>();
    return json(parseRow(inserted!,'json'in config?config.json:[]),201);
  }
  if(id&&request.method==='PATCH'){
    const body=await readBody(request);if(body instanceof Response)return body;
    const entries=Object.entries(config.fields).filter(([key])=>Object.hasOwn(body,key));if(!entries.length)return fail('No supported fields provided',400);
    if(entries.some(([key])=>['nudgesApplied','completedDates'].includes(key)&&!Array.isArray(body[key])))return fail('List fields must be arrays',400);
    if(Object.hasOwn(body,'stats')&&(!body.stats||typeof body.stats!=='object'||Array.isArray(body.stats)))return fail('Stats must be an object',400);
    if(entries.some(([key])=>['title','name','timestamp','date'].includes(key)&&typeof body[key]!=='string'))return fail('Required text fields must be strings',400);
    if(entries.some(([key])=>['title','name','timestamp','date'].includes(key)&&typeof body[key]==='string'&&!(body[key] as string).trim()))return fail('Required text fields cannot be empty',400);
    if(entries.some(([key])=>['amount','balance','cost','streak','dueDate'].includes(key)&&(!Number.isFinite(Number(body[key]))||(['amount','cost','streak','dueDate'].includes(key)&&Number(body[key])<0)|| (key==='dueDate'&&(Number(body[key])<1||Number(body[key])>31)))))return fail('Numeric field is invalid',400);
    if('completed' in body&&typeof body.completed!=='boolean')return fail('Completed must be a boolean',400);
    if('date' in body&&(!('date' in config.fields)||typeof body.date!=='string'||!validDate(body.date)))return fail('Invalid date',400);
    const jsonFields='json'in config?config.json:[];
    if(resource==='quests'&&Object.hasOwn(body,'completed')){
      const old=await env.DB.prepare('SELECT completed FROM quests WHERE user_id=? AND id=?').bind(userId,id).first<{completed:number}>();
      if(!old)return fail('Not found',404);
      if(!old.completed&&body.completed===true){const profile=await env.DB.prepare('SELECT avatar_wins FROM profiles WHERE user_id=?').bind(userId).first<{avatar_wins:number}>();const wins=Number(profile?.avatar_wins||0)+50;let level=1,needed=100,xp=wins;while(xp>=needed){xp-=needed;level++;needed=level*100;}body.avatarXp=wins;body.avatarLevel=level;}
    }
    if(resource==='habits'&&Object.hasOwn(body,'completedDates')){
      const old=await env.DB.prepare('SELECT completed_dates FROM habits WHERE user_id=? AND id=?').bind(userId,id).first<{completed_dates:string}>();
      if(!old)return fail('Not found',404);
      const oldDates=JSON.parse(old.completed_dates) as string[];const nextDates=body.completedDates as string[];
      if(nextDates.some(date=>!validDate(date)))return fail('Invalid habit completion date',400);
      const removed=oldDates.filter(date=>!nextDates.includes(date));
      const added=nextDates.filter(date=>!oldDates.includes(date));
      let streak=0;const completed=new Set(nextDates);let cursor=new Date();
      if(!completed.has(cursor.toLocaleDateString('en-CA')))cursor.setDate(cursor.getDate()-1);
      while(completed.has(cursor.toLocaleDateString('en-CA'))){streak++;cursor.setDate(cursor.getDate()-1);}
      if(added.length){const profile=await env.DB.prepare('SELECT avatar_wins FROM profiles WHERE user_id=?').bind(userId).first<{avatar_wins:number}>();const wins=Number(profile?.avatar_wins||0)+10*added.length;let level=1,needed=100,xp=wins;while(xp>=needed){xp-=needed;level++;needed=level*100;}body.avatarXp=wins;body.avatarLevel=level;}
      body.streak=streak;
    }
    const values=entries.map(([key,column])=>[column,jsonFields.includes(column as never)?JSON.stringify(body[key]):body[key]] as const);
    const updatedValues=entries.map(([key,column])=>[column,jsonFields.includes(column as never)?JSON.stringify(body[key]):body[key]] as const);
    if(resource==='quests'&&typeof body.avatarXp==='number')updatedValues.push(['completed',1] as never);
    const result=await env.DB.prepare(`UPDATE ${config.table} SET ${updatedValues.map(([column])=>`${column}=?`).join(',')} WHERE user_id=? AND id=?`).bind(...updatedValues.map(([,value])=>value),userId,id).run();
    if(result.meta.changes&&typeof body.avatarXp==='number'&&typeof body.avatarLevel==='number')await env.DB.prepare("UPDATE profiles SET avatar_wins=?,avatar_level=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=?").bind(body.avatarXp,body.avatarLevel,userId).run();
    if(!result.meta.changes)return fail('Not found',404);const row=await env.DB.prepare(`SELECT * FROM ${config.table} WHERE user_id=? AND id=?`).bind(userId,id).first<Row>();return json(parseRow(row!,jsonFields));
  }
  if(id&&request.method==='DELETE'){const result=await env.DB.prepare(`DELETE FROM ${config.table} WHERE user_id=? AND id=?`).bind(userId,id).run();return result.meta.changes?json({ok:true}):fail('Not found',404);}
  return fail('Method not allowed',405);
}

export default {
  async fetch(request:Request,env:Env,ctx:AccessContext = {}):Promise<Response>{
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Origin':url.origin,'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
    try{
      let identity: Identity | Response;
      if(url.pathname==='/api/identity'&&request.method==='GET'){
        const accessIdentity=await ctx.access?.getIdentity();
        if(!accessIdentity?.email)return fail('Authentication required',401);
        if(accessIdentity.email.toLowerCase()!==env.ALLOWED_EMAIL?.trim().toLowerCase())return fail('Access denied',403);
        identity={email:accessIdentity.email,name:accessIdentity.name??null,subject:accessIdentity.id??accessIdentity.email.toLowerCase()};
      }else{
        identity=await requireIdentity(request,env);
        if(isResponse(identity))return identity;
      }
      if(isResponse(identity))return identity;
      await ensureUser(env,identity);
      if(url.pathname==='/api/identity'&&request.method==='GET')return json({email:identity.email,name:identity.name});
      return await api(request,env,identity);
    }
    catch(error){console.error('Worker API error',error instanceof Error?error.message:'unknown');return fail('Internal server error',500);}
  },
};
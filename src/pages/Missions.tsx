import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Plus, Folder, Target, CheckSquare, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';



export function Missions() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Form states
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [showQuestForm, setShowQuestForm] = useState(false);

  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectNotionLink, setNewProjectNotionLink] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectTitle, setEditProjectTitle] = useState('');
  const [editProjectNotionLink, setEditProjectNotionLink] = useState('');
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionProjectId, setNewMissionProjectId] = useState('');
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestMissionId, setNewQuestMissionId] = useState('');

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [projectRows, missionRows, questRows] = await Promise.all([api.list('projects'), api.list('missions'), api.list('quests', { date: todayStr })]);
      setProjects(projectRows); setMissions(missionRows); setQuests(questRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load missions.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProjectTitle.trim()) return;
    setError('');
    try {
      const createdProject = await api.create('projects', {
        title: newProjectTitle.trim(),
        description: '',
        notionLink: newProjectNotionLink.trim(),
        status: 'Active',
        createdAt: new Date().toISOString()
      });
      setNewProjectTitle('');
      setNewProjectNotionLink('');
      setShowProjectForm(false);
      setActiveProjectId(createdProject.id);
      fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add project.');
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProjectId || !editProjectTitle.trim()) return;
    setError('');
    try {
      await api.update('projects', editingProjectId, {
        title: editProjectTitle.trim(),
        notionLink: editProjectNotionLink.trim()
      });
      setEditingProjectId(null);
      fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update project.');
    }
  };

  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMissionTitle.trim()) return;
    setError('');
    try {
      await api.create('missions', {
        projectId: activeProjectId || newMissionProjectId,
        title: newMissionTitle.trim(),
        description: '',
        category: 'General',
        status: 'Active',
        createdAt: new Date().toISOString()
      });
      setNewMissionTitle('');
      setNewMissionProjectId('');
      setShowMissionForm(false);
      fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add mission.');
    }
  };

  const handleAddQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newQuestTitle.trim()) return;
    setError('');
    try {
      const mission = missions.find(m => m.id === newQuestMissionId);
      const resolvedProjectId = mission ? mission.projectId : (activeProjectId || '');
      await api.create('quests', {
        projectId: resolvedProjectId,
        title: newQuestTitle.trim(),
        missionId: newQuestMissionId,
        dueTime: '',
        completed: false,
        date: todayStr,
        createdAt: new Date().toISOString()
      });
      setNewQuestTitle('');
      setNewQuestMissionId('');
      setShowQuestForm(false);
      fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add quest.');
    }
  };

  const toggleQuest = async (quest: any) => {
    if (!user) return;
    setError('');
    try {
      await api.update('quests', quest.id, { completed: !quest.completed });
      fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update quest.');
    }
  };

  const deleteItem = async (collectionName: string, id: string) => {
    if (!user) return;
    setError('');
    try {
      await api.remove(collectionName, id);
      if (collectionName === 'projects' && activeProjectId === id) {
        setActiveProjectId(null);
      }
      fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to delete ${collectionName}.`);
    }
  };

  const displayedMissions = activeProjectId 
    ? missions.filter(m => m.projectId === activeProjectId) 
    : missions;
    
  const displayedQuests = activeProjectId 
    ? quests.filter(q => q.projectId === activeProjectId) 
    : quests;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Projects & Missions</h1>
        <p className="text-zinc-400 mt-1">Organize your overarching goals into daily quests</p>
      </header>
      {error && <p role="alert" className="text-red-400">{error}</p>}

      {/* TABS */}
      <div 
        className="flex overflow-x-auto pb-2 gap-2 items-center" 
        style={{ scrollbarWidth: 'none' }}
      >
        <button
          onClick={() => setActiveProjectId(null)}
          className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${
            activeProjectId === null 
              ? 'bg-white text-black' 
              : 'bg-bg-card border border-border-dark text-zinc-400 hover:text-white'
          }`}
        >
          All Overview
        </button>
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => setActiveProjectId(project.id)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeProjectId === project.id 
                ? 'bg-neon-purple text-white border border-neon-purple' 
                : 'bg-bg-card border border-border-dark text-zinc-400 hover:text-white'
            }`}
          >
            <Folder className="w-4 h-4" />
            {project.title}
          </button>
        ))}
        <button 
          onClick={() => setShowProjectForm(!showProjectForm)}
          className="px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap border border-dashed border-border-dark text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {showProjectForm && (
        <form onSubmit={handleAddProject} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex flex-col gap-4">
          <input
            type="text"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            placeholder="Project Name (e.g., Personal Website)"
            className="w-full bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-purple"
            autoFocus
          />
          <div className="flex gap-4">
            <input
              type="url"
              value={newProjectNotionLink}
              onChange={(e) => setNewProjectNotionLink(e.target.value)}
              placeholder="Notion Todo List Link (optional)"
              className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-purple"
            />
            <button type="submit" disabled={!newProjectTitle.trim()} className="bg-neon-purple text-white px-6 py-2 rounded-xl font-bold disabled:opacity-50 whitespace-nowrap">Add Project</button>
          </div>
        </form>
      )}

      {activeProjectId && editingProjectId !== activeProjectId && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-neon-purple/10 border border-neon-purple/20 p-4 rounded-2xl gap-4">
          <div className="flex items-center gap-3">
            <Folder className="w-6 h-6 text-neon-purple" />
            <h2 className="text-xl font-bold text-white">
              {projects.find(p => p.id === activeProjectId)?.title}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {projects.find(p => p.id === activeProjectId)?.notionLink && (
              <a 
                href={projects.find(p => p.id === activeProjectId)?.notionLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-bold text-neon-purple hover:text-[#a64dff] transition-colors flex items-center gap-1.5"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" alt="Notion" className="w-4 h-4" />
                Todo List
              </a>
            )}
            <button 
              onClick={() => {
                const p = projects.find(p => p.id === activeProjectId);
                if (p) {
                  setEditProjectTitle(p.title);
                  setEditProjectNotionLink(p.notionLink || '');
                  setEditingProjectId(activeProjectId);
                }
              }} 
              className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button 
              onClick={() => deleteItem('projects', activeProjectId)} 
              className="text-zinc-500 hover:text-neon-orange transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      )}

      {activeProjectId && editingProjectId === activeProjectId && (
        <form onSubmit={handleEditProject} className="bg-neon-purple/10 border border-neon-purple/20 p-4 rounded-2xl flex flex-col gap-4">
          <input
            type="text"
            value={editProjectTitle}
            onChange={(e) => setEditProjectTitle(e.target.value)}
            placeholder="Project Name"
            className="w-full bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-purple"
            autoFocus
          />
          <div className="flex gap-4">
            <input
              type="url"
              value={editProjectNotionLink}
              onChange={(e) => setEditProjectNotionLink(e.target.value)}
              placeholder="Notion Todo List Link (optional)"
              className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-purple"
            />
            <button type="button" onClick={() => setEditingProjectId(null)} className="text-zinc-400 hover:text-white px-4 py-2 font-bold text-sm">Cancel</button>
            <button type="submit" disabled={!editProjectTitle.trim()} className="bg-neon-purple text-white px-6 py-2 rounded-xl font-bold disabled:opacity-50 whitespace-nowrap">Save</button>
          </div>
        </form>
      )}

      {/* MISSIONS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-neon-cyan" />
            <h2 className="text-xl font-bold text-white">Missions</h2>
          </div>
          <button 
            onClick={() => setShowMissionForm(!showMissionForm)}
            className="bg-transparent border border-border-dark text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-zinc-900 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Mission
          </button>
        </div>

        {showMissionForm && (
          <form onSubmit={handleAddMission} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex flex-col gap-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newMissionTitle}
                onChange={(e) => setNewMissionTitle(e.target.value)}
                placeholder="Mission Name (e.g., Design Homepage)"
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-cyan"
                autoFocus
              />
              {!activeProjectId && (
                <select 
                  value={newMissionProjectId}
                  onChange={(e) => setNewMissionProjectId(e.target.value)}
                  className="bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-cyan"
                >
                  <option value="">No Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              )}
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={!newMissionTitle.trim()} className="bg-neon-cyan text-black px-6 py-2 rounded-xl font-bold disabled:opacity-50">Add Mission</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-24 bg-bg-card border border-border-dark rounded-2xl animate-pulse"></div>
        ) : displayedMissions.length === 0 ? (
          <div className="bg-bg-card border border-border-dark border-dashed p-8 rounded-2xl text-center">
            <p className="text-zinc-500 text-sm">No multi-day missions {activeProjectId ? 'in this project' : 'yet'}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedMissions.map(mission => {
              const project = projects.find(p => p.id === mission.projectId);
              return (
                <div key={mission.id} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex items-center justify-between group">
                  <div>
                    <span className="text-white font-medium block">{mission.title}</span>
                    {!activeProjectId && project && <span className="text-xs text-neon-purple mt-1 block">{project.title}</span>}
                  </div>
                  <button onClick={() => deleteItem('missions', mission.id)} className="text-zinc-600 hover:text-neon-orange opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* QUESTS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-neon-green" />
            <h2 className="text-xl font-bold text-white">Today's Quests</h2>
          </div>
          <button 
            onClick={() => setShowQuestForm(!showQuestForm)}
            className="bg-neon-green text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#2eeb5c] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Quest
          </button>
        </div>

        {showQuestForm && (
          <form onSubmit={handleAddQuest} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex flex-col gap-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newQuestTitle}
                onChange={(e) => setNewQuestTitle(e.target.value)}
                placeholder="Quest Name (e.g., Write Hero Section HTML)"
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
                autoFocus
              />
              <select 
                value={newQuestMissionId}
                onChange={(e) => setNewQuestMissionId(e.target.value)}
                className="bg-bg-dark border border-border-dark rounded-xl px-4 py-2 text-white focus:outline-none focus:border-neon-green"
              >
                <option value="">No Mission</option>
                {displayedMissions.map(m => {
                  const project = projects.find(p => p.id === m.projectId);
                  return (
                    <option key={m.id} value={m.id}>
                      {project && !activeProjectId ? `[${project.title}] ` : ''}{m.title}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={!newQuestTitle.trim()} className="bg-neon-green text-black px-6 py-2 rounded-xl font-bold disabled:opacity-50">Add Quest</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="h-24 bg-bg-card border border-border-dark rounded-2xl animate-pulse"></div>
        ) : displayedQuests.length === 0 ? (
          <div className="bg-bg-card border border-border-dark border-dashed p-8 rounded-2xl text-center">
            <p className="text-zinc-500 text-sm">No big tasks for today {activeProjectId ? 'in this project' : ''}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedQuests.map(quest => {
              const mission = missions.find(m => m.id === quest.missionId);
              const project = projects.find(p => p.id === quest.projectId);
              return (
                <div key={quest.id} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleQuest(quest)}
                      className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                        quest.completed ? 'bg-neon-green border-neon-green text-black' : 'border-zinc-600 text-transparent hover:border-neon-green'
                      }`}
                    >
                      {quest.completed && <CheckSquare className="w-4 h-4" />}
                    </button>
                    <div>
                      <span className={`font-medium block ${quest.completed ? 'text-zinc-500 line-through' : 'text-white'}`}>
                        {quest.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {!activeProjectId && project && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                            {project.title}
                          </span>
                        )}
                        {mission && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
                            {mission.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteItem('quests', quest.id)} className="text-zinc-600 hover:text-neon-orange opacity-0 group-hover:opacity-100 transition-opacity p-2">
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

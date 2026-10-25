import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Target, Activity } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const { user, signIn, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 text-center"
      >
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <Activity className="w-10 h-10 text-zinc-950" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Meating</h1>
          <p className="text-zinc-400 text-lg">Pilot the Meat Suit. Track the stats. Win the day.</p>
        </div>

        {authError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm font-medium">
            {authError}
          </div>
        )}

        <div className="pt-8">
          <button
            onClick={signIn}
            className="w-full bg-zinc-100 text-zinc-950 hover:bg-white font-semibold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3"
          >
            <Target className="w-5 h-5" />
            Continue with Cloudflare Access
          </button>
          <p className="text-xs text-zinc-500 mt-4">
            Private access is managed by your Cloudflare Access policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

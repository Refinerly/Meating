import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, currentUser } from '../lib/api';
import { calculateLevel } from '../utils/leveling';

export interface UserProfile {
  uid: string;
  pilotLevel?: number;
  avatarLevel?: number;
  pilotWins?: number;
  avatarWins?: number;
  currentStreak?: number;
  streak?: number;
  longestStreak?: number;
  lastCheckInDate?: string;
  [key: string]: unknown;
  checkInTimes?: string[];
  badges?: string[];
  createdAt?: string;
  updatedAt?: string;
}
interface User { uid: string; email: string; displayName: string | null }
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  loading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadIdentity = async () => {
      const identity = await currentUser();
      if (!mounted) return;
      if (!identity?.email) {
        setUser(null);
        setProfile(null);
        return;
      }
      const result = await api.me();
      if (!mounted) return;
      const raw = result.profile;
      const profile = raw ? { ...raw } as unknown as UserProfile : null;
      const stableUserId = identity.email.toLowerCase();
      setUser({ uid: stableUserId, email: identity.email, displayName: identity.name ?? null });
      if (profile) {
        profile.pilotWins = Number(raw.pilotWins || 0);
        profile.avatarWins = Number(raw.avatarWins || 0);
        profile.pilotLevel = Number(raw.pilotLevel || 1);
        profile.avatarLevel = Number(raw.avatarLevel || 1);
        profile.currentStreak = Number(raw.currentStreak || 0);
        profile.streak = profile.currentStreak || 0;
        const pilot = calculateLevel(profile.pilotWins || 0).level;
        const avatar = calculateLevel(profile.avatarWins || 0).level;
        profile.pilotLevel = Math.max(profile.pilotLevel || 1, pilot);
        profile.avatarLevel = Math.max(profile.avatarLevel || 1, avatar);
        if (profile.pilotLevel !== Number(raw.pilotLevel || 1) || profile.avatarLevel !== Number(raw.avatarLevel || 1)) {
          void api.profile({ pilotLevel: profile.pilotLevel, avatarLevel: profile.avatarLevel });
        }
      }
      setProfile(profile);
    };
    loadIdentity().catch(error => {
      if (mounted) setAuthError(error instanceof Error ? error.message : 'Unable to load your account.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const signIn = async () => { setAuthError(null); window.location.assign('/cdn-cgi/access/login'); };
  const logout = async () => { window.location.assign('/cdn-cgi/access/logout?returnTo=/login'); };
  return <AuthContext.Provider value={{ user, profile, setProfile, loading, authError, signIn, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
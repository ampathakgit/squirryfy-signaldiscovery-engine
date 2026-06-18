'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ShieldAlert, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to dashboard on success
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
      {/* Dynamic Background Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Panel */}
      <div className="relative w-full max-w-md p-8 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-10 mx-4">
        {/* Branding Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-full border border-emerald-500/30 text-emerald-400 mb-3 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Squirryfy Signal Discovery
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sign in to access the administrator dashboard
          </p>
        </div>

        {/* Error Alert Display */}
        {error && (
          <div className="mb-6 flex items-start p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-sm transition-all duration-200">
            <ShieldAlert className="w-5 h-5 mr-3 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Input Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                placeholder="Enter admin username"
                className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-colors duration-200"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password Input Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-colors duration-200"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold tracking-wide rounded-lg cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-950 mr-2" />
            ) : null}
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          Secure, isolated session. Logs are monitored.
        </div>
      </div>
    </div>
  );
}

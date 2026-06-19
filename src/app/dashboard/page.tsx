"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Play, Settings, Globe, Tag, Flame, FileJson, 
  CheckCircle2, XCircle, AlertCircle, Loader2, 
  ExternalLink, Edit3, Save, Check, RefreshCw,
  LogOut, Image, Eye, Calendar, Sparkles,
  AlertTriangle
} from 'lucide-react';

const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Fetch current user details
  const fetchMe = async () => {
    try {
      const resp = await fetch('/api/auth/me');
      if (resp.ok) {
        const data = await resp.json();
        setCurrentUser(data.username);
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
  };

  const handleLogout = async () => {
    try {
      const resp = await fetch('/api/auth/logout', { method: 'POST' });
      if (resp.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (e) {
      console.error('Failed to logout:', e);
    }
  };

  // Configs state
  const [regions, setRegions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);
  const [scoringRules, setScoringRules] = useState<any[]>([]);

  // Runs state
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  
  // Selected filter states for signals and instagram posts
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRunFilter, setSelectedRunFilter] = useState<string>('all');
  const [finalSignals, setFinalSignals] = useState<any[]>([]);

  // Edit keywords states
  const [editingConfig, setEditingConfig] = useState<{ rId: string; cId: string } | null>(null);
  const [editKeywordsStr, setEditKeywordsStr] = useState<string>('');

  // UI state
  const [activeSection, setActiveSection] = useState<'discovery' | 'instagram'>('discovery');
  const [activeDiscoveryTab, setActiveDiscoveryTab] = useState<'runs' | 'signals' | 'configs' | 'export'>('runs');
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [isFetchingConfig, setIsFetchingConfig] = useState<boolean>(false);
  const [isFetchingSignals, setIsFetchingSignals] = useState<boolean>(false);
  
  // Export states
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0] || '2026-06-17');
  const [exportJson, setExportJson] = useState<any>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Dashboard Date Context States
  const [filterMode, setFilterMode] = useState<'single' | 'range' | 'all'>('single');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0] || '2026-06-17');
  const [filterStartDate, setFilterStartDate] = useState<string>(new Date().toISOString().split('T')[0] || '2026-06-17');
  const [filterEndDate, setFilterEndDate] = useState<string>(new Date().toISOString().split('T')[0] || '2026-06-17');

  // Instagram Agent States
  const [instagramPosts, setInstagramPosts] = useState<any[]>([]);
  const [isFetchingInstagramPosts, setIsFetchingInstagramPosts] = useState<boolean>(false);
  const [isTriggeringInstagram, setIsTriggeringInstagram] = useState<boolean>(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>('');

  // Fetch initial config and runs
  const fetchConfigs = async () => {
    setIsFetchingConfig(true);
    try {
      const resp = await fetch('/api/configs');
      if (resp.ok) {
        const data = await resp.json();
        setRegions(data.regions || []);
        setCategories(data.categories || []);
        setConfigs(data.configs || []);
        setWeights(data.weights || []);
        setScoringRules(data.scoringRules || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingConfig(false);
    }
  };

  const fetchRuns = async () => {
    try {
      let url = '/api/discovery/runs';
      const params = new URLSearchParams();
      if (filterMode === 'single') {
        params.append('date', filterDate);
      } else if (filterMode === 'range') {
        params.append('startDate', filterStartDate);
        params.append('endDate', filterEndDate);
      }
      const queryStr = params.toString();
      if (queryStr) {
        url += `?${queryStr}`;
      }

      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        setRuns(data || []);
        if (data.length > 0) {
          if (!selectedRun || !data.some((r: any) => r.id === selectedRun.id)) {
            fetchSingleRun(data[0].id);
          }
        } else {
          setSelectedRun(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSingleRun = async (id: string, previousStatus?: string) => {
    try {
      const resp = await fetch(`/api/discovery/runs/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setSelectedRun(data);
        if (data.status === 'COMPLETED' && previousStatus === 'RUNNING') {
          fetchFinalSignals();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFinalSignals = async () => {
    setIsFetchingSignals(true);
    try {
      const params = new URLSearchParams({
        region: selectedRegion,
        category: selectedCategory,
        runId: selectedRunFilter
      });
      if (selectedRunFilter === 'all') {
        if (filterMode === 'single') {
          params.append('date', filterDate);
        } else if (filterMode === 'range') {
          params.append('startDate', filterStartDate);
          params.append('endDate', filterEndDate);
        }
      }
      const resp = await fetch(`/api/signals/final?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        setFinalSignals(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingSignals(false);
    }
  };

  const fetchExport = async () => {
    setIsExporting(true);
    try {
      const resp = await fetch(`/api/squirry/export?date=${exportDate}`);
      if (resp.ok) {
        const data = await resp.json();
        setExportJson(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch Instagram Posts
  const fetchInstagramPosts = async () => {
    setIsFetchingInstagramPosts(true);
    try {
      const params = new URLSearchParams();
      if (filterMode === 'single') {
        params.append('date', filterDate);
      } else if (filterMode === 'range') {
        params.append('startDate', filterStartDate);
        params.append('endDate', filterEndDate);
      }
      
      if (selectedRegion && selectedRegion !== 'all') {
        params.append('region', selectedRegion);
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      
      const resp = await fetch(`/api/instagram/posts?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        setInstagramPosts(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch Instagram posts:', e);
    } finally {
      setIsFetchingInstagramPosts(false);
    }
  };

  // Run pipeline trigger
  const triggerPipeline = async () => {
    const isConfirmed = window.confirm(`Are you sure you want to trigger a new Signal Discovery pipeline run for date context: ${filterDate}? This will scan all active regions and categories, consuming Gemini API credits.`);
    if (!isConfirmed) return;

    setIsTriggering(true);
    try {
      const resp = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentDate: filterDate })
      });
      if (resp.ok) {
        const data = await resp.json();
        alert(`Pipeline triggered successfully for date context: ${filterDate}. Run ID: ${data.runId}`);
        
        if (data.runId && data.runId !== 'pending') {
          fetchSingleRun(data.runId);
        }
        
        fetchRuns();
      }
    } catch (e) {
      alert('Error triggering discovery run.');
    } finally {
      setIsTriggering(false);
    }
  };

  // Trigger Instagram Agent
  const triggerInstagramAgent = async () => {
    const isConfirmed = window.confirm("Are you sure you want to trigger the Squirryfy Instagram Creator Agent? This will process the top daily signal and generate/render slide carousels in the background.");
    if (!isConfirmed) return;
    
    setIsTriggeringInstagram(true);
    try {
      const resp = await fetch('/api/instagram/trigger', { method: 'POST' });
      if (resp.ok) {
        alert("Instagram agent triggered in the background. It will fetch the top signal, render slides, and post to Instagram. Check status in a few seconds.");
        setTimeout(() => {
          fetchInstagramPosts();
        }, 3000);
      } else {
        const errData = await resp.json().catch(() => ({}));
        alert(`Error triggering agent: ${errData.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error triggering agent: ${e.message}`);
    } finally {
      setIsTriggeringInstagram(false);
    }
  };

  // Toggle handlers
  const toggleRegion = async (id: string, currentEnabled: boolean) => {
    try {
      const resp = await fetch('/api/regions/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !currentEnabled })
      });
      if (resp.ok) {
        fetchConfigs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCategory = async (id: string, currentEnabled: boolean) => {
    try {
      const resp = await fetch('/api/categories/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !currentEnabled })
      });
      if (resp.ok) {
        fetchConfigs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Keywords update
  const saveKeywords = async (regionId: string, categoryId: string) => {
    const list = editKeywordsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    try {
      const resp = await fetch('/api/configs/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionId, categoryId, keywords: list })
      });
      if (resp.ok) {
        fetchConfigs();
        setEditingConfig(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyExportToClipboard = () => {
    if (!exportJson) return;
    navigator.clipboard.writeText(JSON.stringify(exportJson, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchRuns();
  }, [filterMode, filterDate, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchFinalSignals();
  }, [selectedRegion, selectedCategory, selectedRunFilter, filterMode, filterDate, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (activeSection === 'instagram') {
      fetchInstagramPosts();
    }
  }, [activeSection, filterMode, filterDate, filterStartDate, filterEndDate, selectedRegion, selectedCategory]);

  useEffect(() => {
    fetchExport();
  }, [exportDate]);

  // Dynamic Polling Hook for Active/Running Runs & Background Updates
  useEffect(() => {
    const hasActiveRun = runs.some(run => run.status === 'RUNNING' || run.status === 'PENDING');
    const pollInterval = hasActiveRun ? 3000 : 15000;

    const intervalId = setInterval(() => {
      fetchRuns();
      if (selectedRun && (selectedRun.status === 'RUNNING' || selectedRun.status === 'PENDING' || hasActiveRun)) {
        fetchSingleRun(selectedRun.id, selectedRun.status);
      }
    }, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [runs, selectedRun]);

  // Polling for Instagram posts
  useEffect(() => {
    if (activeSection !== 'instagram') return;
    
    const hasPendingPost = instagramPosts.some(post => post.status === 'PENDING');
    const interval = hasPendingPost ? 3000 : 15000;
    
    const intervalId = setInterval(() => {
      fetchInstagramPosts();
    }, interval);
    
    return () => clearInterval(intervalId);
  }, [activeSection, instagramPosts]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-cyan-500/30 flex flex-col md:flex-row">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-950/10 blur-[150px]" />
      </div>

      {/* Left Sidebar Navigation Drawer */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-900 bg-neutral-950/80 backdrop-blur-md flex flex-col justify-between flex-shrink-0 md:sticky md:top-0 md:h-screen z-20">
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-neutral-900">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center font-bold text-black text-lg shadow-lg shadow-cyan-500/10">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Squirryfy
              </h1>
              <p className="text-[10px] text-neutral-500">Discovery & Content Agent</p>
            </div>
          </div>

          {/* Navigation Sections */}
          <div className="px-4 py-6 space-y-6">
            {/* Section 1: Trend Discovery */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2">Trend Discovery</p>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveSection('discovery'); setActiveDiscoveryTab('runs'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === 'discovery' && activeDiscoveryTab === 'runs' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}
                >
                  <Settings className="w-4 h-4" />
                  Runs & Logs
                </button>
                <button
                  onClick={() => { setActiveSection('discovery'); setActiveDiscoveryTab('signals'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === 'discovery' && activeDiscoveryTab === 'signals' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}
                >
                  <Flame className="w-4 h-4" />
                  Signal Inspector
                </button>
                <button
                  onClick={() => { setActiveSection('discovery'); setActiveDiscoveryTab('configs'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === 'discovery' && activeDiscoveryTab === 'configs' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}
                >
                  <Globe className="w-4 h-4" />
                  Sources & Configs
                </button>
                <button
                  onClick={() => { setActiveSection('discovery'); setActiveDiscoveryTab('export'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === 'discovery' && activeDiscoveryTab === 'export' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}
                >
                  <FileJson className="w-4 h-4" />
                  Squirry Export
                </button>
              </div>
            </div>

            {/* Section 2: Instagram Creator */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2">Instagram Creator</p>
              <button
                onClick={() => setActiveSection('instagram')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${activeSection === 'instagram' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'}`}
              >
                <span className="flex items-center gap-3">
                  <Instagram className="w-4 h-4" />
                  Instagram Carousels
                </span>
                <span className="text-[9px] bg-pink-950/80 text-pink-400 px-1.5 py-0.5 rounded border border-pink-800/40">Agentic</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Profile and Logout */}
        {currentUser && (
          <div className="p-4 border-t border-neutral-900 bg-neutral-900/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <div className="h-7 w-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-cyan-450">
                {currentUser.substring(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{currentUser}</p>
                <p className="text-[9px] text-neutral-500">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-450 hover:bg-rose-950/20 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 relative z-10 max-w-7xl w-full mx-auto overflow-y-auto">
        
        {/* Dynamic Headers based on active section */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-neutral-950 mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              {activeSection === 'instagram' ? (
                <>
                  Instagram Creator Studio
                  <span className="text-pink-400 font-medium text-xs px-2.5 py-0.5 rounded-full bg-pink-950/50 border border-pink-800/30">AI Agent Deck</span>
                </>
              ) : (
                <>
                  Trend Discovery Engine
                  <span className="text-cyan-400 font-medium text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-800/30">Signal Core</span>
                </>
              )}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {activeSection === 'instagram' 
                ? "Automated design synthesis and carousel generation workflow" 
                : "Real-time attention scoring and search indexing control"}
            </p>
          </div>

          <div className="text-sm font-semibold text-cyan-400 flex items-center gap-2 bg-neutral-900/60 border border-neutral-800/80 px-4 py-2 rounded-xl self-start md:self-auto shadow-sm">
            <span className="text-xs">📅</span>
            <span>
              {filterMode === 'single' ? `Date Context: ${filterDate}` : filterMode === 'range' ? `Date Range: ${filterStartDate} to ${filterEndDate}` : 'Date Context: All Time'}
            </span>
          </div>
        </header>

        {/* Unified Ingestion Trigger Control Centers */}
        {activeSection === 'discovery' ? (
          <section className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-neutral-900/60 to-neutral-900/40 backdrop-blur-md border border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[80px] pointer-events-none" />
            
            <div className="flex flex-col gap-1 relative z-10">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Pipeline Control Center
              </span>
              <h2 className="text-base font-bold text-white">Trigger Attention Discovery Scan</h2>
              <p className="text-xs text-neutral-400 max-w-2xl">
                Initiate a manual run of the Squirryfy signal discovery ingestion. This will parse active RSS feeds, Subreddits, and YouTube channels, running them through the Gemini extraction, clustering, and scoring pipeline.
              </p>
            </div>
            
            <button
              onClick={triggerPipeline}
              disabled={isTriggering}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-cyan-950/20 relative z-10 flex-shrink-0"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Running Ingestion...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Trigger Discovery Run
                </>
              )}
            </button>
          </section>
        ) : (
          <section className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-neutral-900/60 to-neutral-900/40 backdrop-blur-md border border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-pink-500/5 blur-[80px] pointer-events-none" />
            
            <div className="flex flex-col gap-1 relative z-10">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-pulse" />
                Creative Content Agent
              </span>
              <h2 className="text-base font-bold text-white">Trigger Instagram Carousel Generation</h2>
              <p className="text-xs text-neutral-400 max-w-2xl">
                Initiate the Creative Director Agent to pick the top-performing daily trend, draft a slide copywriting script, render JPEGs via headless Playwright, and upload them to Supabase Storage.
              </p>
            </div>
            
            <button
              onClick={triggerInstagramAgent}
              disabled={isTriggeringInstagram}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-pink-950/20 relative z-10 flex-shrink-0"
            >
              {isTriggeringInstagram ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Spawning Agent...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  Generate Instagram Carousel
                </>
              )}
            </button>
          </section>
        )}

        {/* Date Selection & Filter Panel */}
        <section className="mb-8 p-4 rounded-2xl bg-neutral-900/50 backdrop-blur-md border border-neutral-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Date Context</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterMode('single')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    filterMode === 'single'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  Single Date
                </button>
                <button
                  onClick={() => setFilterMode('range')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    filterMode === 'range'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  Date Range
                </button>
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    filterMode === 'all'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  Show All Stats
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {filterMode === 'single' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Select Date</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}
              {filterMode === 'range' && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Start Date</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">End Date</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Region Filter</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="all">All Regions</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Category Filter</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* RENDER ACTIVE SECTION CONTENT */}
        {activeSection === 'discovery' ? (
          <div className="space-y-6">
            
            {/* Quick Stats Overview */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 p-5 rounded-2xl">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1 font-semibold">Total Runs</p>
                <p className="text-2xl font-bold text-white">{runs.length}</p>
              </div>
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 p-5 rounded-2xl">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1 font-semibold">Latest Run Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {runs[0]?.status === 'COMPLETED' && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                  {runs[0]?.status === 'FAILED' && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                  {runs[0]?.status === 'RUNNING' && <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />}
                  <span className="text-sm font-semibold text-white uppercase tracking-wider">{runs[0]?.status || 'NO RUNS'}</span>
                </div>
              </div>
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 p-5 rounded-2xl">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1 font-semibold">Ingested Signals</p>
                <p className="text-2xl font-bold text-emerald-400">{runs[0]?.signalsFoundCount || 0}</p>
              </div>
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 p-5 rounded-2xl">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1 font-semibold">Active Regions</p>
                <p className="text-2xl font-bold text-cyan-400">{regions.filter(r => r.enabled).length} <span className="text-xs text-neutral-500">/ {regions.length}</span></p>
              </div>
              <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 p-5 rounded-2xl col-span-2 lg:col-span-1">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1 font-semibold">Active Categories</p>
                <p className="text-2xl font-bold text-white">{categories.filter(c => c.enabled).length} <span className="text-xs text-neutral-500">/ {categories.length}</span></p>
              </div>
            </section>

            {/* TAB 1: RUNS & LOGS */}
            {activeDiscoveryTab === 'runs' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Run List */}
                <div className="bg-neutral-900/20 backdrop-blur-md border border-neutral-800/60 rounded-2xl overflow-hidden lg:col-span-1">
                  <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/40">
                    <h2 className="text-sm font-semibold text-white">Discovery Runs History</h2>
                  </div>
                  <div className="divide-y divide-neutral-900 max-h-[600px] overflow-y-auto">
                    {runs.length === 0 ? (
                      <div className="p-8 text-center text-neutral-500 text-sm">No discovery runs found. Trigger a run above!</div>
                    ) : (
                      runs.map(run => (
                        <button
                          key={run.id}
                          onClick={() => fetchSingleRun(run.id)}
                          className={`w-full text-left p-4 hover:bg-neutral-900/50 transition-all flex items-center justify-between ${selectedRun?.id === run.id ? 'bg-cyan-950/15 border-l-2 border-cyan-500' : ''}`}
                        >
                          <div className="truncate pr-2">
                            <p className="text-xs font-mono text-neutral-400 truncate">{run.id}</p>
                            <p className="text-xs text-neutral-500 mt-1">Started: {new Date(run.startedAt).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${run.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : run.status === 'FAILED' ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-cyan-950 text-cyan-400 border border-cyan-900'}`}>
                              {run.status}
                            </span>
                            {run.status === 'COMPLETED' && (
                              <span className="text-[10px] text-neutral-400 font-semibold">{run.finalSignalsGeneratedCount} signals</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Run Details & Logs */}
                <div className="bg-neutral-900/20 backdrop-blur-md border border-neutral-800/60 rounded-2xl overflow-hidden lg:col-span-2 flex flex-col">
                  {selectedRun ? (
                    <>
                      <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/40 flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                            Run Details: <span className="font-mono text-xs text-cyan-400">{selectedRun.id}</span>
                          </h2>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Duration: {selectedRun.completedAt ? `${Math.round((new Date(selectedRun.completedAt).getTime() - new Date(selectedRun.startedAt).getTime()) / 1000)} seconds` : 'Running...'}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${selectedRun.status === 'COMPLETED' ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-900/50' : selectedRun.status === 'FAILED' ? 'bg-red-950/70 text-red-400 border border-red-900/50' : 'bg-cyan-950/70 text-cyan-400 border border-cyan-900/50'}`}>
                          {selectedRun.status}
                        </span>
                      </div>

                      {/* Summary Indicators */}
                      <div className="grid grid-cols-3 border-b border-neutral-800 bg-neutral-900/10 text-center py-4">
                        <div>
                          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Raw Ingested</p>
                          <p className="text-lg font-bold text-white mt-1">{selectedRun.signalsFoundCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Clustered</p>
                          <p className="text-lg font-bold text-cyan-400 mt-1">{selectedRun.signalsClusteredCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Final Signals</p>
                          <p className="text-lg font-bold text-emerald-400 mt-1">{selectedRun.finalSignalsGeneratedCount}</p>
                        </div>
                      </div>

                      {/* Log Console */}
                      <div className="p-4 flex-1">
                        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Pipeline Execution Logs</h3>
                        <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-4 font-mono text-xs max-h-[350px] overflow-y-auto space-y-2.5 text-neutral-300">
                          {selectedRun.logs?.length === 0 ? (
                            <div className="text-neutral-600 text-center py-8">No logs available for this run.</div>
                          ) : (
                            [...selectedRun.logs].reverse().map((log: any) => (
                              <div key={log.id} className="flex items-start gap-2 border-b border-neutral-900/40 pb-1.5 last:border-0 last:pb-0">
                                <span className="text-neutral-600 flex-shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                <span className={`font-semibold flex-shrink-0 ${log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-yellow-500' : 'text-cyan-500'}`}>
                                  [{log.level}]
                                </span>
                                <span className="break-all">{log.message}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Final Signals generated in this run */}
                      {selectedRun.finalSignals?.length > 0 && (
                        <div className="p-4 border-t border-neutral-800 bg-neutral-900/10">
                          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Generated Signals ({selectedRun.finalSignals.length})</h3>
                          <div className="space-y-2">
                            {selectedRun.finalSignals.map((sig: any) => (
                              <div key={sig.id} className="flex items-center justify-between p-3 bg-neutral-900/40 border border-neutral-800/80 rounded-xl">
                                <div className="truncate pr-3">
                                  <p className="text-sm font-semibold text-white truncate">{sig.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-800 font-mono tracking-wider">{sig.signalId}</span>
                                    <span className="text-[10px] text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/40 font-semibold">{sig.categoryId} ({sig.regionId})</span>
                                    <span className="text-xs text-neutral-500 truncate max-w-[200px]">{sig.canonicalSource}</span>
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/30 px-2.5 py-1 rounded-lg flex-shrink-0">
                                  {sig.score} pt
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-3">
                      <AlertCircle className="w-8 h-8 text-neutral-700" />
                      Select a run from the history sidebar to inspect details and pipeline execution logs.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: SIGNAL INSPECTOR */}
            {activeDiscoveryTab === 'signals' && (
              <div className="space-y-6">
                {/* Search / Filter Sub-options */}
                <div className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-neutral-400 font-medium">Discovery Run Filter:</span>
                    <select
                      value={selectedRunFilter}
                      onChange={(e) => setSelectedRunFilter(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-500 max-w-[260px]"
                    >
                      <option value="all">All Runs (Overall Top)</option>
                      {runs.map(run => (
                        <option key={run.id} value={run.id}>
                          {new Date(run.startedAt).toLocaleDateString()} - {run.id.substring(0, 8)} ({run.finalSignalsGeneratedCount} sigs)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Showing top signals. Every signal has one canonical URL.
                  </div>
                </div>

                {/* Signals Grid */}
                <div className="space-y-4">
                  {isFetchingSignals ? (
                    <div className="text-center py-12 text-neutral-500 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      Loading signals...
                    </div>
                  ) : finalSignals.length === 0 ? (
                    <div className="bg-neutral-900/10 border border-neutral-900/60 rounded-2xl p-12 text-center text-neutral-500 text-sm">
                      No final signals generated yet for region "{selectedRegion}" / category "{selectedCategory}". Run the discovery pipeline to populate signals!
                    </div>
                  ) : (
                    finalSignals.map(sig => {
                      const configWeight = weights.find(w => w.regionId === sig.regionId && w.categoryId === sig.categoryId);
                      const activeRule = scoringRules.find(r => r.categoryId === sig.categoryId) || scoringRules.find(r => r.categoryId === null);
                      const ruleWeights = activeRule?.weights || {};

                      return (
                        <div key={sig.id} className="bg-neutral-900/20 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-hidden p-6 flex flex-col lg:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                            {/* Title and ID */}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono font-bold bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700/50">{sig.signalId}</span>
                                <span className="text-[10px] font-bold bg-cyan-950/80 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/40">Canonical URL Verified</span>
                                {sig.readyForSquirryAnalysis && (
                                  <span className="text-[10px] font-bold bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40">Squirry Ready</span>
                                )}
                                <span className="text-xs text-neutral-500 ml-auto">{new Date(sig.createdAt).toLocaleDateString()}</span>
                              </div>
                              <h2 className="text-lg font-bold text-white mt-2 leading-snug">{sig.title}</h2>
                            </div>

                            {/* Original Article URL info */}
                            <div className="bg-neutral-950/60 border border-neutral-900 rounded-xl p-4">
                              <div>
                                <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                  Original Article URL
                                </p>
                                <a 
                                  href={sig.articleUrl || sig.canonicalUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 group break-all"
                                >
                                  {sig.articleUrl || sig.canonicalUrl}
                                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </a>
                                <p className="text-[10px] text-neutral-500 mt-1">
                                  Source: <span className="font-semibold text-neutral-400">{sig.canonicalSource}</span> ({sig.sourceType.toUpperCase()})
                                </p>
                              </div>
                            </div>

                            {/* Why Selected (Bullet points) */}
                            {sig.whySelected && sig.whySelected.length > 0 && (
                              <div>
                                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Attention Rationale</h3>
                                <ul className="list-disc list-inside space-y-1 text-sm text-neutral-300 pl-1.5">
                                  {sig.whySelected.map((reason: string, idx: number) => (
                                    <li key={idx}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Supporting links */}
                            {sig.supportingUrls && sig.supportingUrls.length > 0 && (
                              <div>
                                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Cross-Source Evidence ({sig.supportingUrls.length})</h3>
                                <div className="flex flex-wrap gap-2">
                                  {sig.supportingUrls.map((url: string, idx: number) => {
                                    const domain = new URL(url).hostname.replace('www.', '');
                                    return (
                                      <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 px-2.5 py-1 rounded-lg flex items-center gap-1"
                                      >
                                        {domain}
                                        <ExternalLink className="w-3 h-3 text-neutral-600" />
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Entities list */}
                            {sig.entities && sig.entities.length > 0 && (
                              <div>
                                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Discovered Entities</h3>
                                <div className="flex flex-wrap gap-1.5">
                                  {sig.entities.map((ent: string, idx: number) => (
                                    <span key={idx} className="text-xs font-medium text-neutral-300 bg-neutral-950 border border-neutral-900 px-2 py-0.5 rounded-md">
                                      {ent}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Score Breakdown (Side bar) */}
                          <div className="w-full lg:w-[220px] bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-5 flex flex-col justify-between flex-shrink-0 gap-4">
                            <div className="text-center">
                              <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Discovery Score</p>
                              <p className="text-4xl font-black text-cyan-400 mt-1">{sig.score}</p>
                              <p className="text-[10px] text-neutral-500 mt-1 font-mono">Normalized Index</p>
                            </div>
                            
                            <div className="space-y-2 border-t border-neutral-800/50 pt-4 text-xs">
                              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Scoring Framework</p>
                              <div className="flex justify-between text-neutral-500">
                                <span>Rule weights:</span>
                                <span className="font-semibold text-neutral-400">
                                  {activeRule?.name.replace(' Scoring Rule', '') || 'Default'}
                                </span>
                              </div>
                              <div className="space-y-1 font-mono text-[10px] text-neutral-500">
                                <div className="flex justify-between">
                                  <span>Attention Weight:</span>
                                  <span>{ruleWeights.attention * 100}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Velocity Weight:</span>
                                  <span>{ruleWeights.velocity * 100}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Freshness Weight:</span>
                                  <span>{ruleWeights.freshness * 100}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Cross-Source:</span>
                                  <span>{ruleWeights.cross_source_confirmation * 100}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Source Trust:</span>
                                  <span>{ruleWeights.source_trust * 100}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CONFIGURATION MANAGER */}
            {activeDiscoveryTab === 'configs' && (
              <div className="space-y-6">
                <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-semibold text-white">Sync Configuration Data</h3>
                    <p className="text-xs text-neutral-500">Pull latest region, category, weight, and scoring configurations from the database.</p>
                  </div>
                  <button
                    onClick={fetchConfigs}
                    disabled={isFetchingConfig}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-neutral-300 font-semibold text-xs transition-all disabled:opacity-50 self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingConfig ? 'animate-spin text-cyan-400' : ''}`} />
                    {isFetchingConfig ? 'Syncing...' : 'Sync Config Data'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Regions toggle */}
                  <div className="bg-neutral-900/20 border border-neutral-800/60 rounded-2xl p-6">
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-cyan-400" />
                      Active Regions Configuration
                    </h2>
                    <p className="text-xs text-neutral-500 mb-4">Toggle regions to enable/disable scanning for that demographic group.</p>
                    <div className="space-y-3">
                      {regions.map(r => (
                        <div key={r.id} className="flex items-center justify-between p-4 bg-neutral-950/60 border border-neutral-900 rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-white">{r.name}</p>
                            <p className="text-[10px] font-mono text-neutral-500 mt-0.5">ID: {r.id} | TZ: {r.timezone}</p>
                          </div>
                          <button
                            onClick={() => toggleRegion(r.id, r.enabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${r.enabled ? 'bg-cyan-500' : 'bg-neutral-800'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${r.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categories toggle */}
                  <div className="bg-neutral-900/20 border border-neutral-800/60 rounded-2xl p-6">
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <Tag className="w-5 h-5 text-emerald-400" />
                      Discovered Categories Configuration
                    </h2>
                    <p className="text-xs text-neutral-500 mb-4">Toggle categories to include/exclude them from daily pipeline operations.</p>
                    <div className="space-y-3">
                      {categories.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-4 bg-neutral-950/60 border border-neutral-900 rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-white">{c.name}</p>
                            <p className="text-[10px] font-mono text-neutral-500 mt-0.5">ID: {c.id} | Default Target: top {c.defaultTopN} signals</p>
                          </div>
                          <button
                            onClick={() => toggleCategory(c.id, c.enabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${c.enabled ? 'bg-cyan-500' : 'bg-neutral-800'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${c.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Keywords Editor */}
                  <div className="bg-neutral-900/20 border border-neutral-800/60 rounded-2xl p-6 md:col-span-2">
                    <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-purple-400" />
                      Category-Region Keyword Rules Editor
                    </h2>
                    <p className="text-xs text-neutral-500 mb-6">Edit active search keywords mapped to each region and category. Separate values with commas.</p>
                    
                    <div className="space-y-4">
                      {configs.map(cfg => {
                        const region = regions.find(r => r.id === cfg.regionId);
                        const category = categories.find(c => c.id === cfg.categoryId);
                        if (!region || !category) return null;

                        const isEditing = editingConfig?.rId === cfg.regionId && editingConfig?.cId === cfg.categoryId;

                        return (
                          <div key={`${cfg.regionId}-${cfg.categoryId}`} className="p-4 bg-neutral-950/60 border border-neutral-900 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{region.name}</span>
                                <span className="text-neutral-600">&bull;</span>
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{category.name}</span>
                              </div>
                              {isEditing ? (
                                <textarea
                                  value={editKeywordsStr}
                                  onChange={(e) => setEditKeywordsStr(e.target.value)}
                                  rows={2}
                                  className="w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                                />
                              ) : (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {cfg.keywords.length === 0 ? (
                                    <span className="text-xs text-neutral-600 italic">No keywords configured</span>
                                  ) : (
                                    cfg.keywords.map((kw: string, idx: number) => (
                                      <span key={idx} className="text-xs bg-neutral-900 text-neutral-400 border border-neutral-850 px-2.5 py-0.5 rounded-full">
                                        {kw}
                                      </span>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-shrink-0 flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveKeywords(cfg.regionId, cfg.categoryId)}
                                    className="p-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-900 text-emerald-400 flex items-center gap-1.5 text-xs font-semibold transition-all"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingConfig(null)}
                                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-805 border border-neutral-800 text-neutral-400 text-xs font-semibold transition-all"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingConfig({ rId: cfg.regionId, cId: cfg.categoryId });
                                    setEditKeywordsStr(cfg.keywords.join(', '));
                                  }}
                                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 flex items-center gap-1.5 text-xs font-semibold transition-all"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit keywords
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SQUIRRY EXPORT */}
            {activeDiscoveryTab === 'export' && (
              <div className="space-y-6">
                <div className="bg-neutral-900/20 border border-neutral-800/60 rounded-2xl p-6">
                  <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-cyan-400" />
                    Squirry AI Integration Export Tool
                  </h2>
                  <p className="text-xs text-neutral-500 mb-6">Select a date and copy the exported JSON. This matches Squirry's ingestion specification formats.</p>

                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-400 font-medium">Export Date:</span>
                      <input
                        type="date"
                        value={exportDate}
                        onChange={(e) => setExportDate(e.target.value)}
                        className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>

                    <button
                      onClick={copyExportToClipboard}
                      disabled={!exportJson || exportJson.signals?.length === 0}
                      className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {copySuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          Copy JSON to Clipboard
                        </>
                      )}
                    </button>
                  </div>

                  {/* Code viewer container */}
                  <div className="bg-neutral-950 border border-neutral-900 rounded-2xl overflow-hidden font-mono text-xs text-neutral-300">
                    <div className="bg-neutral-900/40 px-5 py-3 border-b border-neutral-900 flex justify-between items-center">
                      <span className="text-neutral-500 font-medium text-[10px] uppercase tracking-wider">JSON Export Output Payload</span>
                      <span className="text-neutral-400 text-[10px] font-semibold">{exportJson?.signals?.length || 0} signals ready</span>
                    </div>
                    <div className="p-5 max-h-[500px] overflow-y-auto">
                      {isExporting ? (
                        <div className="text-center py-16 text-neutral-500 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                          Generating payload...
                        </div>
                      ) : !exportJson || exportJson.signals?.length === 0 ? (
                        <div className="text-neutral-600 text-center py-16">
                          No signals discovered on {exportDate}. Trigger a discovery run for this date.
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap">{JSON.stringify(exportJson, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* INSTAGRAM CREATOR SECTION CONTENT */
          <div className="space-y-6">
            {isFetchingInstagramPosts ? (
              <div className="text-center py-16 text-neutral-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                Loading Instagram Carousels...
              </div>
            ) : instagramPosts.length === 0 ? (
              <div className="bg-neutral-900/10 border border-neutral-900/60 rounded-2xl p-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-3">
                <Instagram className="w-8 h-8 text-neutral-700" />
                <span>No Instagram Carousel posts found for this filter context. Trigger generation above!</span>
              </div>
            ) : (
              <div className="space-y-8">
                {instagramPosts.map((post) => {
                  const signal = post.discovery_final_signals || {};
                  const slides = post.carousel_data?.slides || [];
                  const mediaUrls = post.media_urls || [];
                  const status = post.status;
                  const caption = post.carousel_data?.caption || "";

                  return (
                    <div key={post.id} className="bg-neutral-900/20 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-hidden p-6 space-y-6">
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-neutral-900">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap text-[10px]">
                            <span className="font-mono font-bold bg-neutral-850 text-neutral-350 px-2 py-0.5 rounded border border-neutral-700/50">Post ID: {post.id.substring(0, 8)}</span>
                            <span className="font-semibold bg-cyan-950/80 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/40">Signal ID: {post.signal_id}</span>
                            <span className="text-neutral-500 font-semibold">{new Date(post.created_at).toLocaleString()}</span>
                          </div>
                          <h3 className="text-lg font-bold text-white mt-2 leading-snug">{signal.title || "Unknown Trend"}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                            <span className="font-semibold text-cyan-400">{signal.region_id?.toUpperCase()}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-emerald-400">{signal.category_id?.replace('_', ' ')}</span>
                            <span>&bull;</span>
                            <span className="text-neutral-500 font-medium">Trend Score: {signal.score} pts</span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                          {/* Status Badge */}
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto border ${
                            status === 'PUBLISHED' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30' :
                            status === 'GENERATED' ? 'bg-cyan-950/50 text-cyan-400 border-cyan-500/30' :
                            status === 'PENDING' ? 'bg-amber-950/50 text-amber-400 border-amber-500/30 animate-pulse' :
                            'bg-red-950/50 text-red-400 border-red-500/30'
                          }`}>
                            {status}
                          </span>

                          {post.post_url && (
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 mt-1 group"
                            >
                              View on Instagram
                              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </a>
                          )}

                          {post.error_message && (
                            <span className="text-[10px] text-red-400 max-w-[240px] text-left sm:text-right font-mono bg-red-950/20 px-2 py-1 rounded border border-red-900/30 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              {post.error_message}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Section: Grid of Caption and Slides */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Caption Card */}
                        <div className="lg:col-span-1 bg-neutral-950/60 border border-neutral-900 rounded-xl p-4 flex flex-col h-[280px]">
                          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Instagram className="w-3.5 h-3.5 text-pink-400" />
                            Instagram Caption Copywriting
                          </h4>
                          <div className="flex-1 overflow-y-auto text-sm text-neutral-300 font-sans whitespace-pre-wrap pr-1 custom-scrollbar">
                            {caption ? (
                              caption.split(/(\s#\w+)/g).map((part: string, index: number) => {
                                if (part.startsWith(' #') || part.startsWith('#')) {
                                  return <span key={index} className="text-pink-400 font-medium">{part}</span>;
                                }
                                return part;
                              })
                            ) : (
                              <span className="text-neutral-600 italic">Caption copy generation pending...</span>
                            )}
                          </div>
                        </div>

                        {/* Slides Deck Carousel */}
                        <div className="lg:col-span-2 space-y-2">
                          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Image className="w-3.5 h-3.5 text-cyan-400" />
                            Slide Deck Carousel ({slides.length || mediaUrls.length} slides)
                          </h4>
                          
                          <div className="flex items-center gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                            {/* Render slide items */}
                            {mediaUrls.length > 0 ? (
                              mediaUrls.map((url: string, idx: number) => {
                                const slideInfo = slides[idx] || {};
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      setLightboxUrl(url);
                                      setLightboxCaption(slideInfo.title ? `Slide ${idx+1}: ${slideInfo.title}` : `Slide ${idx+1}`);
                                    }}
                                    className="relative w-[180px] h-[180px] rounded-xl overflow-hidden border border-neutral-805 hover:border-cyan-500/50 flex-shrink-0 cursor-pointer group shadow-lg transition-all hover:scale-[1.02]"
                                  >
                                    <img
                                      src={url}
                                      alt={`Slide ${idx+1}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Eye className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm border border-neutral-800 text-[10px] text-white px-2 py-0.5 rounded-full font-bold">
                                      Slide {idx+1}
                                    </div>
                                  </div>
                                );
                              })
                            ) : slides.length > 0 ? (
                              // Render mock slides if pending
                              slides.map((slide: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`w-[180px] h-[180px] rounded-xl border border-neutral-800 p-3.5 flex-shrink-0 flex flex-col justify-between shadow-lg relative bg-neutral-950/50 backdrop-blur-sm`}
                                >
                                  <div className="absolute top-2 right-2 text-[9px] bg-neutral-900 border border-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                    Pending
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Slide {slide.slide_number}</span>
                                    <h5 className="text-[11px] font-bold text-white line-clamp-2">{slide.title}</h5>
                                    <p className="text-[9px] text-neutral-400 line-clamp-4 leading-normal">{slide.body}</p>
                                  </div>
                                  <div className="text-[8px] font-mono text-cyan-400/60 truncate mt-1">
                                    Theme: {slide.bg_theme}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="w-full h-[180px] border border-dashed border-neutral-850 rounded-xl flex items-center justify-center text-neutral-600 text-xs italic">
                                Slide assets generation pending...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-[-40px] right-0 text-neutral-400 hover:text-white text-sm font-bold bg-neutral-900/60 hover:bg-neutral-850 px-3 py-1.5 rounded-xl border border-neutral-850 transition-colors"
            >
              Close
            </button>
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-950">
              <img
                src={lightboxUrl}
                alt={lightboxCaption}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-sm font-semibold text-neutral-350">{lightboxCaption}</p>
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { 
  Play, Settings, Globe, Tag, Flame, FileJson, 
  CheckCircle2, XCircle, AlertCircle, Loader2, 
  ExternalLink, Edit3, Save, Check, RefreshCw
} from 'lucide-react';

export default function DashboardPage() {
  // Configs state
  const [regions, setRegions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);
  const [scoringRules, setScoringRules] = useState<any[]>([]);

  // Runs state
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  
  // Selected filter states for signals
  const [selectedRegion, setSelectedRegion] = useState<string>('us');
  const [selectedCategory, setSelectedCategory] = useState<string>('ai_tech');
  const [selectedRunFilter, setSelectedRunFilter] = useState<string>('all');
  const [finalSignals, setFinalSignals] = useState<any[]>([]);

  // Edit keywords states
  const [editingConfig, setEditingConfig] = useState<{ rId: string; cId: string } | null>(null);
  const [editKeywordsStr, setEditKeywordsStr] = useState<string>('');

  // UI state
  const [activeTab, setActiveTab] = useState<'runs' | 'signals' | 'configs' | 'export'>('runs');
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

  // Run pipeline trigger
  const triggerPipeline = async () => {
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
        
        // Immediately fetch details of the new run and select it
        if (data.runId && data.runId !== 'pending') {
          fetchSingleRun(data.runId);
        }
        
        // Refresh runs list immediately to show the new run
        fetchRuns();
      }
    } catch (e) {
      alert('Error triggering discovery run.');
    } finally {
      setIsTriggering(false);
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
    fetchConfigs();
    fetchRuns();
  }, [filterMode, filterDate, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchFinalSignals();
  }, [selectedRegion, selectedCategory, selectedRunFilter, filterMode, filterDate, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchExport();
  }, [exportDate]);

  // Dynamic Polling Hook for Active/Running Runs & Background Updates
  useEffect(() => {
    const hasActiveRun = runs.some(run => run.status === 'RUNNING' || run.status === 'PENDING');
    
    // Poll faster (3s) if there is an active run, otherwise slower (15s) for background updates
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-16 antialiased selection:bg-cyan-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-950/10 blur-[150px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between py-8 border-b border-neutral-900 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center font-bold text-black text-xl shadow-lg shadow-cyan-500/10">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Squirryfy <span className="text-cyan-400 font-medium text-sm px-2 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-800/30">Signal Discovery</span>
              </h1>
              <p className="text-xs text-neutral-500">Automated internet attention scanner for Squirry AI Engine</p>
              <div className="mt-1.5 text-sm font-semibold text-cyan-400 flex items-center gap-2">
                <span>📅</span>
                {filterMode === 'single' ? `Date Context: ${filterDate}` : filterMode === 'range' ? `Date Range: ${filterStartDate} to ${filterEndDate}` : 'Date Context: All Time'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchConfigs}
              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-all text-neutral-400"
              title="Refresh configuration data"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingConfig ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={triggerPipeline}
              disabled={isTriggering}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-cyan-950/20"
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
          </div>
        </header>

        {/* Date Selection Panel */}
        <section className="mb-8 p-4 rounded-2xl bg-neutral-900/50 backdrop-blur-md border border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Dashboard Date Context</span>
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
            {filterMode === 'all' && (
              <span className="text-xs text-neutral-500 italic">Showing all history across runs.</span>
            )}
          </div>
        </section>

        {/* Quick Stats Overview */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

        {/* Dashboard Tabs Navigation */}
        <div className="flex border-b border-neutral-900 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('runs')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all -mb-px ${activeTab === 'runs' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            <Settings className="w-4 h-4" />
            Runs & Logs
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all -mb-px ${activeTab === 'signals' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            <Flame className="w-4 h-4" />
            Signal Inspector
          </button>
          <button
            onClick={() => setActiveTab('configs')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all -mb-px ${activeTab === 'configs' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            <Globe className="w-4 h-4" />
            Sources & Configs
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all -mb-px ${activeTab === 'export' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            <FileJson className="w-4 h-4" />
            Squirry Export
          </button>
        </div>

        {/* TAB 1: RUNS & LOGS */}
        {activeTab === 'runs' && (
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
        {activeTab === 'signals' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-2xl flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-neutral-400 font-medium">Region:</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-neutral-400 font-medium">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-cyan-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-neutral-400 font-medium">Discovery Run:</span>
                <select
                  value={selectedRunFilter}
                  onChange={(e) => setSelectedRunFilter(e.target.value)}
                  className="bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-cyan-500 max-w-[260px]"
                >
                  <option value="all">All Runs (Overall Top)</option>
                  {runs.map(run => (
                    <option key={run.id} value={run.id}>
                      {new Date(run.startedAt).toLocaleDateString()} - {run.id.substring(0, 8)} ({run.finalSignalsGeneratedCount} sigs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-neutral-500 ml-auto">
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
                  No final signals generated yet for {selectedRegion.toUpperCase()} / {selectedCategory.replace('_', ' ').toUpperCase()}. Run the discovery pipeline to populate signals!
                </div>
              ) : (
                finalSignals.map(sig => {
                  // Find weights for score breakdown
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
        {activeTab === 'configs' && (
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
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${r.enabled ? 'bg-cyan-500' : 'bg-neutral-850'}`}
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
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${c.enabled ? 'bg-cyan-500' : 'bg-neutral-850'}`}
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
                              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 text-xs font-semibold transition-all"
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
        )}

        {/* TAB 4: SQUIRRY EXPORT */}
        {activeTab === 'export' && (
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
                    className="bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:border-cyan-500 font-mono"
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
    </div>
  );
}

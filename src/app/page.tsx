'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Search, Globe, Tag, ExternalLink, Lock, X, 
  Sparkles, Loader2, ArrowRight, BookOpen, Clock, AlertCircle
} from 'lucide-react';
import './squirry.css';

interface Entity {
  entity_name: string;
  entity_type: string;
  description?: string;
  search_query?: string;
}

interface SquirryResponseData {
  title?: string;
  summary?: string;
  categories?: string[];
  tags?: string[];
  referred_entities?: Entity[];
  structured_summary?: {
    credibility?: {
      status?: string;
      reason?: string;
    };
  };
  action_items?: Array<{
    task?: string;
    description?: string;
    rationale?: string;
    due_date?: string;
  }>;
  author?: string;
  platform?: string;
  thumbnail?: string;
}

interface Signal {
  id: string;
  signalId: string;
  regionId: string;
  categoryId: string;
  title: string;
  canonicalUrl: string;
  articleUrl?: string;
  score: number;
  whySelected?: string;
  squirryResponse?: {
    data?: SquirryResponseData;
    success?: boolean;
  };
  createdAt: string;
  regionName: string;
  categoryName: string;
}

interface FilterOption {
  id: string;
  name: string;
}

const renderMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    let cleanLine = line.trim();
    const isBullet = cleanLine.startsWith('- ') || cleanLine.startsWith('* ');
    if (isBullet) {
      cleanLine = cleanLine.substring(2);
    }

    const isH3 = cleanLine.startsWith('### ');
    const isH2 = cleanLine.startsWith('## ');
    const isH1 = cleanLine.startsWith('# ');

    if (isH3) {
      cleanLine = cleanLine.substring(4);
    } else if (isH2) {
      cleanLine = cleanLine.substring(3);
    } else if (isH1) {
      cleanLine = cleanLine.substring(2);
    }

    const parts = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = boldRegex.exec(cleanLine)) !== null) {
      const before = cleanLine.substring(lastIndex, match.index);
      if (before) parts.push(before);
      parts.push(<strong key={match.index} className="text-[#dac898] font-bold">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    const after = cleanLine.substring(lastIndex);
    if (after) parts.push(after);

    const content = parts.length > 0 ? parts : cleanLine;

    if (isH1) {
      return (
        <h3 key={idx} className="text-lg font-extrabold mt-6 mb-2 text-[#dac898]">
          {content}
        </h3>
      );
    }
    if (isH2) {
      return (
        <h4 key={idx} className="text-base font-bold mt-4 mb-2 text-[#dac898]">
          {content}
        </h4>
      );
    }
    if (isH3) {
      return (
        <h5 key={idx} className="text-sm font-semibold mt-3 mb-1 text-[#f0ebdd]">
          {content}
        </h5>
      );
    }

    if (isBullet) {
      return (
        <li key={idx} className="ml-4 mb-1.5 list-disc text-sm leading-relaxed text-[#f0ebdd]">
          {content}
        </li>
      );
    }

    return (
      <p key={idx} className="mb-2.5 min-h-[1em] text-sm leading-relaxed text-[#f0ebdd]">
        {content}
      </p>
    );
  });
};

export default function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<FilterOption[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  
  // Active Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Drawer Detail view state
  const [activeDetailSignal, setActiveDetailSignal] = useState<Signal | null>(null);

  // Fetch filters on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await fetch('/api/squirry/filters');
        if (res.ok) {
          const data = await res.json();
          // Filter out disabled ones to show only active options
          setRegions(data.regions?.filter((r: any) => r.enabled) || []);
          setCategories(data.categories?.filter((c: any) => c.enabled) || []);
        }
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      }
    };
    fetchFilters();
  }, []);

  // Fetch signals reactively on filter change
  useEffect(() => {
    const fetchSignals = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedRegion !== 'all') params.append('region', selectedRegion);
        if (selectedCategory !== 'all') params.append('category', selectedCategory);
        if (searchQuery.trim().length > 0) params.append('search', searchQuery);

        const res = await fetch(`/api/squirry/signals?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setSignals(data || []);
        }
      } catch (err) {
        console.error('Failed to load signals:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search input slightly to prevent API spamming
    const timer = setTimeout(() => {
      fetchSignals();
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedRegion, selectedCategory, searchQuery]);

  return (
    <div className="squirry-theme min-h-screen">
      <div className="squirry-app-container">
        
        {/* Left Sidebar */}
        <aside className="squirry-sidebar">
          {/* Logo Branding */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#5b256e] to-[#dac898] flex items-center justify-center shadow-lg border border-white/10">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#f0ebdd]">Squirryfy</h2>
              <span className="text-[10px] text-[#dac898] font-semibold tracking-widest uppercase">Intel Portal</span>
            </div>
          </div>

          {/* Region Selector */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#b5adc0] mb-2 px-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Regions
            </p>
            <button 
              onClick={() => setSelectedRegion('all')}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                selectedRegion === 'all' 
                  ? 'bg-[#dac898]/15 text-[#f0ebdd] border border-[#dac898]/25 font-medium' 
                  : 'text-[#b5adc0] hover:text-[#f0ebdd] border border-transparent'
              }`}
            >
              All Regions
            </button>
            {regions.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRegion(r.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 capitalize ${
                  selectedRegion === r.id 
                    ? 'bg-[#dac898]/15 text-[#f0ebdd] border border-[#dac898]/25 font-medium' 
                    : 'text-[#b5adc0] hover:text-[#f0ebdd] border border-transparent'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* Category Selector */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#b5adc0] mb-2 px-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Topics
            </p>
            <button 
              onClick={() => setSelectedCategory('all')}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                selectedCategory === 'all' 
                  ? 'bg-[#dac898]/15 text-[#f0ebdd] border border-[#dac898]/25 font-medium' 
                  : 'text-[#b5adc0] hover:text-[#f0ebdd] border border-transparent'
              }`}
            >
              All Topics
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 capitalize ${
                  selectedCategory === c.id 
                    ? 'bg-[#dac898]/15 text-[#f0ebdd] border border-[#dac898]/25 font-medium' 
                    : 'text-[#b5adc0] hover:text-[#f0ebdd] border border-transparent'
                }`}
              >
                {c.name.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Admin Lock Access */}
          <div className="mt-auto pt-4 border-t border-white/5">
            <Link 
              href="/dashboard"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-[#dac898] border border-[#dac898]/20 bg-[#dac898]/5 hover:bg-[#dac898]/10 hover:border-[#dac898]/40 transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Admin Control Portal
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </aside>

        {/* Main Feed Content Area */}
        <main className="squirry-main-content">
          <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#f0ebdd]">Stash Library</h1>
              <p className="text-xs text-[#b5adc0]">Explore the latest viral attention signals and deep AI insights</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#b5adc0] bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                Active Signals: <strong className="text-[#dac898]">{signals.length}</strong>
              </span>
            </div>
          </header>

          {/* Search Inputs */}
          <div className="relative w-full">
            <Search className="w-5 h-5 text-[#b5adc0] absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search stashes, summary key takeaways, entities, or hashtags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="squirry-input-primary pl-12 w-full"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b5adc0] hover:text-[#f0ebdd]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Signal Cards Display Grid */}
          {loading ? (
            <div className="flex flex-col flex-1 items-center justify-center min-h-[300px] gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-[#dac898]" />
              <p className="text-sm text-[#b5adc0]">Loading intelligence feed...</p>
            </div>
          ) : signals.length === 0 ? (
            <div className="squirry-glass-panel py-16 px-4 text-center flex flex-col items-center gap-4 max-w-lg mx-auto w-full">
              <AlertCircle className="w-10 h-10 text-[#b5adc0]" />
              <div>
                <h3 className="text-lg font-bold">No insights matched</h3>
                <p className="text-sm text-[#b5adc0] mt-1">Try adjusting your filters, clearing your search terms, or check back later.</p>
              </div>
              {(selectedRegion !== 'all' || selectedCategory !== 'all' || searchQuery) && (
                <button 
                  onClick={() => {
                    setSelectedRegion('all');
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="squirry-btn-secondary mt-2"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="squirry-cards-grid">
              {signals.map(sig => {
                const sqData = sig.squirryResponse?.data || {};
                const thumbnail = sqData.thumbnail;
                
                // Format display date
                const date = new Date(sig.createdAt);
                const displayDate = date.toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                });

                return (
                  <div 
                    key={sig.id}
                    onClick={() => setActiveDetailSignal(sig)}
                    className="squirry-glass-panel squirry-link-card cursor-pointer group hover:scale-[1.01] hover:shadow-[#dac898]/5"
                  >
                    {/* Thumbnail Image / Fallback Gradient */}
                    {thumbnail ? (
                      <img src={thumbnail} alt="" className="squirry-link-card-image" />
                    ) : (
                      <div className="squirry-link-card-image bg-gradient-to-br from-[#411f5c] to-[#0b0614] flex items-center justify-center relative">
                        <Sparkles className="w-10 h-10 text-[#dac898]/30 group-hover:scale-110 transition-transform duration-300" />
                        <span className="absolute bottom-3 left-3 text-[9px] font-bold uppercase tracking-wider text-[#dac898]/50">
                          Squirry AI Analysis
                        </span>
                      </div>
                    )}

                    {/* Metadata tags line */}
                    <div className="squirry-link-card-meta">
                      <span className="squirry-badge-category">
                        {sig.categoryName?.replace(/_/g, ' ') || 'General'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="squirry-badge-region">{sig.regionId}</span>
                        {sqData.platform && (
                          <span className="text-[11px] capitalize text-[#b5adc0]">
                            {sqData.platform}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="flex flex-col gap-1.5 flex-1">
                      <h3 className="text-base font-bold text-[#f0ebdd] line-clamp-2 group-hover:text-[#dac898] transition-colors duration-200 leading-snug">
                        {sqData.title || sig.title}
                      </h3>
                      <p className="text-xs text-[#b5adc0] line-clamp-3 leading-relaxed mt-1">
                        {sig.whySelected || 'No additional summary details available.'}
                      </p>
                    </div>

                    {/* Tags row */}
                    {sqData.tags && sqData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sqData.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="squirry-badge-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom date and actions details */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3.5 mt-2 text-[11px] text-[#b5adc0]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {displayDate}
                      </span>
                      <span className="text-[#dac898] group-hover:underline flex items-center gap-0.5 font-semibold">
                        View Analysis →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Collapsible right slide-out details panel / drawer */}
        {activeDetailSignal && (
          <div 
            className="fixed inset-0 bg-black/80 z-[100] flex justify-end transition-opacity duration-300"
            onClick={() => setActiveDetailSignal(null)}
          >
            <div 
              className="squirry-glass-panel w-full max-w-xl h-full rounded-none border-l border-white/10 flex flex-col p-6 sm:p-8 overflow-y-auto bg-[#0e081a] relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Header section with buttons */}
              <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="squirry-badge-category">
                    {activeDetailSignal.categoryName?.replace(/_/g, ' ')}
                  </span>
                  <span className="squirry-badge-region">
                    {activeDetailSignal.regionId}
                  </span>
                </div>
                
                <button 
                  onClick={() => setActiveDetailSignal(null)}
                  className="p-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 text-[#b5adc0] hover:text-[#f0ebdd] transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              {/* Thumbnail / Hero photo */}
              {activeDetailSignal.squirryResponse?.data?.thumbnail && (
                <img 
                  src={activeDetailSignal.squirryResponse.data.thumbnail} 
                  alt="" 
                  className="w-full h-52 object-cover rounded-xl border border-white/5 mb-6"
                />
              )}

              {/* Title heading */}
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#f0ebdd] leading-snug mb-3">
                {activeDetailSignal.squirryResponse?.data?.title || activeDetailSignal.title}
              </h2>

              {/* Author / Source */}
              {activeDetailSignal.squirryResponse?.data?.author && (
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-lg text-sm text-[#f0ebdd] mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#5b256e] flex items-center justify-center font-bold text-xs">
                    {activeDetailSignal.squirryResponse.data.author.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{activeDetailSignal.squirryResponse.data.author}</p>
                    {activeDetailSignal.squirryResponse.data.platform && (
                      <p className="text-[10px] text-[#b5adc0] uppercase tracking-wider">
                        Source: {activeDetailSignal.squirryResponse.data.platform}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Source Link */}
              <a 
                href={activeDetailSignal.canonicalUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#dac898] hover:underline mb-6"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open original stashed link
              </a>

              {/* AI Details Content Container */}
              <div className="flex flex-col gap-6">
                
                {/* Branding Headers */}
                <div className="flex items-center gap-3.5 border-b border-white/5 pb-3">
                  <div className="w-7 h-7 rounded-md bg-[#dac898] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#0b0614]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#f0ebdd] m-0">Squirry.AI Analytical Intel</h3>
                  <span className="bg-[#dac898] text-[#0b0614] text-[9px] font-black px-2 py-0.5 rounded tracking-wide">
                    PRO
                  </span>
                </div>

                {/* Credibility Box */}
                {activeDetailSignal.squirryResponse?.data?.structured_summary?.credibility && (
                  <div className="p-4 rounded-xl border bg-[#5b256e]/5 border-[#dac898]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[#dac898]" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[#dac898]">
                        Credibility: {activeDetailSignal.squirryResponse.data.structured_summary.credibility.status}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#f0ebdd] m-0">
                      {activeDetailSignal.squirryResponse.data.structured_summary.credibility.reason}
                    </p>
                  </div>
                )}

                {/* Summary takeaways */}
                {activeDetailSignal.squirryResponse?.data?.summary && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#b5adc0] mb-3">Quick Takeaway Summary</h4>
                    <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                      {renderMarkdown(activeDetailSignal.squirryResponse.data.summary)}
                    </div>
                  </div>
                )}

                {/* Detected Entities list */}
                {activeDetailSignal.squirryResponse?.data?.referred_entities && activeDetailSignal.squirryResponse.data.referred_entities.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#b5adc0] mb-3">Extracted Core Entities</h4>
                    <div className="flex flex-col gap-2">
                      {activeDetailSignal.squirryResponse.data.referred_entities.map((ent, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-4 p-3 rounded-lg border border-white/5 bg-white/2">
                          <div>
                            <p className="text-xs font-bold text-[#f0ebdd]">{ent.entity_name}</p>
                            <p className="text-[10px] text-[#b5adc0] mt-0.5">{ent.entity_type}</p>
                            {ent.description && (
                              <p className="text-[11px] text-[#b5adc0]/70 mt-1.5 leading-relaxed">{ent.description}</p>
                            )}
                          </div>
                          {ent.search_query && (
                            <a 
                              href={`https://www.google.com/search?q=${encodeURIComponent(ent.search_query)}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] font-bold text-[#dac898] hover:underline shrink-0"
                            >
                              Search Google →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Action items */}
                {activeDetailSignal.squirryResponse?.data?.action_items && activeDetailSignal.squirryResponse.data.action_items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#b5adc0] mb-3">Suggested Tasks & Actions</h4>
                    <div className="flex flex-col gap-2">
                      {activeDetailSignal.squirryResponse.data.action_items.map((item, idx) => (
                        <div key={idx} className="flex gap-3 bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-lg">
                          <div className="text-emerald-400 font-bold mt-0.5">✓</div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-[#f0ebdd]">{item.task || item.description || item.rationale}</p>
                            {item.due_date && (
                              <span className="text-[10px] text-[#b5adc0] block mt-1">Due: {item.due_date}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Tags list */}
                {activeDetailSignal.squirryResponse?.data?.tags && activeDetailSignal.squirryResponse.data.tags.length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#b5adc0] mb-3">Tags & Hashtags</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeDetailSignal.squirryResponse.data.tags.map((tag, idx) => (
                        <span key={idx} className="squirry-badge-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

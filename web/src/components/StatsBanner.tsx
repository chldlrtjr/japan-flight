'use client';

import React from 'react';
import { Sparkles, Calendar, Globe } from 'lucide-react';
import { CrawlStats } from '@/types';

interface StatsBannerProps {
  stats?: CrawlStats;
  selectedAirline?: string;
  onSelectAirline?: (airline: string) => void;
  selectedRegion?: string;
  onSelectRegion?: (region: string) => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  stats,
}) => {
  if (!stats) return null;

  return (
    <div className="bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-1/3 -top-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Intro */}
        <div className="max-w-xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
            일본 여행 항공권 특가,<br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-300">
              한일 모든 항공사를 한곳에서 비교
            </span>
            하세요
          </h1>
        </div>

        {/* Right Stats Quick Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 self-stretch md:self-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs text-sky-300 font-medium mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>진행 중인 특가</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">
              {stats.activeCount} <span className="text-sm font-normal text-slate-300">건</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs text-sky-300 font-medium mb-1">
              <Globe className="w-3.5 h-3.5" />
              <span>국제선 프로모션</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {stats.internationalCount} <span className="text-sm font-normal text-slate-300">건</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs text-sky-300 font-medium mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>수집 항공사</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {Object.keys(stats.airlineCounts).length} <span className="text-sm font-normal text-slate-300">개사</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

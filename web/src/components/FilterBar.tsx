'use client';

import React from 'react';
import { Search, SlidersHorizontal, Check, X } from 'lucide-react';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  selectedAirline: string;
  onSelectAirline: (airline: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  sortOrder: string;
  onSortChange: (sort: string) => void;
  totalFilteredCount: number;
}

export const JAPAN_CITIES = [
  { id: 'ALL', label: '🇯🇵 전체 일본 노선' },
  { id: '도쿄', label: '🗼 도쿄 (나리타/하네다)' },
  { id: '오사카', label: '🏯 오사카 (간사이)' },
  { id: '후쿠오카', label: '🍜 후쿠오카' },
  { id: '삿포로', label: '❄️ 삿포로 (신치토세)' },
  { id: '나고야', label: '🍤 나고야 (주부)' },
  { id: '오키나와', label: '🌺 오키나와 (나하)' },
  { id: '마쓰야마', label: '🍊 마쓰야마' },
  { id: '다카마쓰', label: '🍲 다카마쓰' },
  { id: '히로시마', label: '🍁 히로시마' },
  { id: '시즈오카', label: '🗻 시즈오카' },
  { id: '기타큐슈', label: '⚓ 기타큐슈' },
  { id: '구마모토', label: '🐻 구마모토' },
  { id: '가고시마', label: '🌋 가고시마' },
  { id: '오이타', label: '♨️ 오이타' },
  { id: '사가', label: '🏺 사가' },
  { id: '나가사키', label: '⛪ 나가사키' },
  { id: '미야자키', label: '🌴 미야자키' },
  { id: '요나고', label: '🐫 요나고 (돗토리)' },
  { id: '오카야마', label: '🍑 오카야마' },
  { id: '고마쓰', label: '🍵 고마쓰 (가나자와)' },
  { id: '센다이', label: '🎋 센다이' },
  { id: '아오모리', label: '🍎 아오모리' },
  { id: '니가타', label: '🌾 니가타' },
  { id: '도쿠시마', label: '🌀 도쿠시마' },
  { id: '아사히카와', label: '🐧 아사히카와' },
  { id: '하코다테', label: '🌃 하코다테' },
  { id: '도야마', label: '🏔️ 도야마' },
  { id: '고베', label: '🥩 고베' },
  { id: '미야코지마', label: '🏝️ 미야코지마 (시모지지마)' },
  { id: '우베', label: '✈️ 우베 (야마구치)' },
  { id: '이바라키', label: '🌸 이바라키' },
];

const AIRLINES = [
  { id: 'ALL', label: '전체 항공사' },
  { id: 'JAPAN_ALL', label: '🇯🇵 일본 항공사 전체' },
  { id: 'KOREA_ALL', label: '🇰🇷 국내 항공사 전체' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedRegion,
  onSelectRegion,
  selectedAirline,
  onSelectAirline,
  selectedStatus,
  onSelectStatus,
  sortOrder,
  onSortChange,
  totalFilteredCount,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm mb-6 space-y-4">
      {/* Top Search & Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="목적지(도쿄, 다낭, 괌, 홍콩...) 또는 특가명 검색"
            className="w-full pl-11 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-900 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort & Status controls */}
        <div className="flex items-center gap-2">
          {/* Status Segmented Control */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            <button
              onClick={() => onSelectStatus('ING')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'ING'
                  ? 'bg-white text-emerald-600 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              진행중만
            </button>
            <button
              onClick={() => onSelectStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              종료 포함 전체
            </button>
          </div>

          {/* Sort selector */}
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
          >
            <option value="default">인기/추천순</option>
            <option value="end_soon">마감임박순</option>
            <option value="start_recent">최신등록순</option>
          </select>
        </div>
      </div>

      {/* Japan City Tabs */}
      <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">일본 취항 도시:</span>
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
              한국 직항 31개 도시
            </span>
          </div>
          {selectedRegion !== 'ALL' && (
            <button
              onClick={() => onSelectRegion('ALL')}
              className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium transition-colors"
            >
              <span>전체 일본 노선 보기</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {JAPAN_CITIES.map((city) => {
            const isSelected = selectedRegion === city.id;
            return (
              <button
                key={city.id}
                onClick={() => onSelectRegion(city.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-600/30'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {city.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Airline Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          <span className="text-xs font-bold text-slate-400 w-14 shrink-0">항공사:</span>
          {AIRLINES.map((air) => {
            const isSelected = selectedAirline === air.id;
            const isJapanGroup = air.id === 'JAPAN_ALL';
            const isKoreaGroup = air.id === 'KOREA_ALL';

            let btnClass = 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100';
            if (isSelected) {
              if (isJapanGroup) {
                btnClass = 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-600/30';
              } else if (isKoreaGroup) {
                btnClass = 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30';
              } else {
                btnClass = 'bg-slate-900 text-white font-bold shadow-sm';
              }
            } else if (isJapanGroup) {
              btnClass = 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold';
            } else if (isKoreaGroup) {
              btnClass = 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold';
            }

            return (
              <button
                key={air.id}
                onClick={() => onSelectAirline(air.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${btnClass}`}
              >
                {air.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-500 whitespace-nowrap shrink-0 self-end lg:self-start lg:pt-1.5 pl-2">
          검색 결과 <span className="font-bold text-sky-600">{totalFilteredCount}</span>개
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, Check, X, ChevronDown, ChevronUp, Globe } from 'lucide-react';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCountry: 'ALL' | 'JAPAN' | 'NZ';
  onCountryChange: (country: 'ALL' | 'JAPAN' | 'NZ') => void;
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  selectedAirline: string;
  onSelectAirline: (airline: string) => void;
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

export const NZ_CITIES = [
  { id: 'ALL', label: '🇳🇿 전체 뉴질랜드' },
  { id: '오클랜드', label: '🥝 오클랜드 (AKL 직항)' },
  { id: '크라이스트처치', label: '🏔️ 크라이스트처치 (CHC)' },
  { id: '퀸스타운', label: '🎿 퀸스타운 (ZQN)' },
  { id: '웰링턴', label: '💨 웰링턴 (WLG)' },
];

const PRIMARY_JAPAN_CITIES = JAPAN_CITIES.slice(0, 7);
const SECONDARY_JAPAN_CITIES = JAPAN_CITIES.slice(7);

export const FilterBar: React.FC<FilterBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedCountry,
  onCountryChange,
  selectedRegion,
  onSelectRegion,
  selectedAirline,
  onSelectAirline,
  sortOrder,
  onSortChange,
  totalFilteredCount,
}) => {
  const [isCitiesExpanded, setIsCitiesExpanded] = useState(false);
  const isSelectedInSecondary = SECONDARY_JAPAN_CITIES.some((c) => c.id === selectedRegion);

  // Get airlines based on current selected country
  const getAirlines = () => {
    if (selectedCountry === 'NZ') {
      return [
        { id: 'ALL', label: '전체 항공사' },
        { id: '에어뉴질랜드', label: '🥝 에어뉴질랜드 (국적기)' },
        { id: '대한항공', label: '✈️ 대한항공 (직항)' },
        { id: '중국남방항공', label: '🌏 중국남방항공 (가성비)' },
      ];
    }
    if (selectedCountry === 'JAPAN') {
      return [
        { id: 'ALL', label: '전체 항공사' },
        { id: 'JAPAN_ALL', label: '🇯🇵 일본 항공사 전체' },
        { id: 'KOREA_ALL', label: '🇰🇷 국내 항공사 전체' },
      ];
    }
    return [
      { id: 'ALL', label: '전체 항공사' },
      { id: 'JAPAN_ALL', label: '🇯🇵 일본 항공사' },
      { id: 'KOREA_ALL', label: '🇰🇷 국내 항공사' },
      { id: 'NZ_ALL', label: '🇳🇿 뉴질랜드 노선사' },
    ];
  };

  const currentAirlines = getAirlines();

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
            placeholder="목적지(오클랜드, 도쿄, 삿포로...) 또는 항공사, 특가명 검색"
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

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer shadow-2xs"
          >
            <option value="default">특가 시작일순 (최신순)</option>
            <option value="end_soon">마감임박순</option>
            <option value="created_recent">최신등록순</option>
          </select>
        </div>
      </div>

      {/* Country / Destination Section Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
        <span className="text-xs font-bold text-slate-500 shrink-0">국가/지역:</span>
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => {
              onCountryChange('ALL');
              onSelectRegion('ALL');
              onSelectAirline('ALL');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedCountry === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🌏 전체 특가
          </button>
          <button
            onClick={() => {
              onCountryChange('JAPAN');
              onSelectRegion('ALL');
              onSelectAirline('ALL');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedCountry === 'JAPAN'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇯🇵 일본 노선 (31개 도시)
          </button>
          <button
            onClick={() => {
              onCountryChange('NZ');
              onSelectRegion('ALL');
              onSelectAirline('ALL');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              selectedCountry === 'NZ'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇳🇿 뉴질랜드 노선 (오클랜드 등)
          </button>
        </div>
      </div>

      {/* New Zealand Destinations (when NZ is active or ALL) */}
      {selectedCountry === 'NZ' && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800">🇳🇿 뉴질랜드 취항 도시:</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                인천/부산 출발 직항 & 주요 연계 노선
              </span>
            </div>
            {selectedRegion !== 'ALL' && (
              <button
                onClick={() => onSelectRegion('ALL')}
                className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-medium transition-colors"
              >
                <span>전체 뉴질랜드 보기</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {NZ_CITIES.map((city) => {
              const isSelected = selectedRegion === city.id;
              return (
                <button
                  key={city.id}
                  onClick={() => onSelectRegion(city.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-600/20'
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {city.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Japan City Tabs (when JAPAN or ALL) */}
      {(selectedCountry === 'JAPAN' || selectedCountry === 'ALL') && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">🇯🇵 일본 취항 도시:</span>
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
            {PRIMARY_JAPAN_CITIES.map((city) => {
              const isSelected = selectedRegion === city.id;
              return (
                <button
                  key={city.id}
                  onClick={() => onSelectRegion(city.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-600/30 ring-2 ring-rose-600/20'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {city.label}
                </button>
              );
            })}

            {!isCitiesExpanded && isSelectedInSecondary && (
              <button
                onClick={() => onSelectRegion(selectedRegion)}
                className="text-xs px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all bg-rose-600 text-white shadow-sm shadow-rose-600/30 flex items-center gap-1 ring-2 ring-rose-600/20"
              >
                <span>{JAPAN_CITIES.find((c) => c.id === selectedRegion)?.label}</span>
                <span className="text-[10px] bg-rose-700/80 px-1 py-0.2 rounded text-rose-100 font-normal">선택됨</span>
              </button>
            )}

            {isCitiesExpanded &&
              SECONDARY_JAPAN_CITIES.map((city) => {
                const isSelected = selectedRegion === city.id;
                return (
                  <button
                    key={city.id}
                    onClick={() => onSelectRegion(city.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-600/30 ring-2 ring-rose-600/20'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    {city.label}
                  </button>
                );
              })}

            <button
              onClick={() => setIsCitiesExpanded(!isCitiesExpanded)}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1 border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 shadow-2xs active:scale-95"
              aria-expanded={isCitiesExpanded}
            >
              {isCitiesExpanded ? (
                <>
                  <span>접기</span>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                </>
              ) : (
                <>
                  <span>+ 25개 도시 더보기</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Airline Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          <span className="text-xs font-bold text-slate-400 w-14 shrink-0">항공사:</span>
          {currentAirlines.map((air) => {
            const isSelected = selectedAirline === air.id;
            const isJapanGroup = air.id === 'JAPAN_ALL';
            const isKoreaGroup = air.id === 'KOREA_ALL';
            const isNZGroup = air.id === 'NZ_ALL' || air.id === '에어뉴질랜드';

            let btnClass = 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100';
            if (isSelected) {
              if (isJapanGroup) {
                btnClass = 'bg-rose-600 text-white font-bold shadow-sm shadow-rose-600/30';
              } else if (isKoreaGroup) {
                btnClass = 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30';
              } else if (isNZGroup) {
                btnClass = 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/30';
              } else {
                btnClass = 'bg-slate-900 text-white font-bold shadow-sm';
              }
            } else if (isJapanGroup) {
              btnClass = 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold';
            } else if (isKoreaGroup) {
              btnClass = 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold';
            } else if (isNZGroup) {
              btnClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold';
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

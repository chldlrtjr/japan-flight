'use client';

import React from 'react';
import { ExternalLink, Calendar, MapPin, Bookmark, Tag } from 'lucide-react';
import { Promotion } from '@/types';
import { getPromoEventUrl } from '@/lib/filterData';

interface PromoCardProps {
  promo: Promotion;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onSelectPromo: (promo: Promotion) => void;
}

export const PromoCard: React.FC<PromoCardProps> = ({
  promo,
  isBookmarked,
  onToggleBookmark,
  onSelectPromo,
}) => {
  // Airline style helper (Minimalist architectural dot & badge)
  const getAirlineBadge = (airline: string) => {
    let dot = 'bg-slate-400';
    if (airline.includes('뉴질랜드')) dot = 'bg-emerald-400';
    else if (airline.includes('대한항공') || airline.includes('ANA')) dot = 'bg-sky-400';
    else if (airline.includes('아시아나')) dot = 'bg-amber-400';
    else if (airline.includes('티웨이') || airline.includes('이스타') || airline.includes('일본항공')) dot = 'bg-rose-400';
    else if (airline.includes('제주항공')) dot = 'bg-orange-400';
    else if (airline.includes('진에어')) dot = 'bg-lime-400';
    else if (airline.includes('에어서울')) dot = 'bg-teal-400';

    return {
      bg: 'bg-black/65 backdrop-blur-md text-white border-white/10',
      dot,
    };
  };

  // D-Day calculation (Precise & Minimal)
  const calculateDday = (endStr: string | null, status: string) => {
    if (status === 'END') return { text: '종료', color: 'bg-slate-200/80 dark:bg-white/10 text-slate-500' };
    if (!endStr) return { text: '상시진행', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' };

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endStr);
      end.setHours(0, 0, 0, 0);

      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { text: '종료', color: 'bg-slate-200/80 dark:bg-white/10 text-slate-500' };
      if (diffDays === 0) return { text: '오늘 마감', color: 'bg-rose-500 text-white font-bold animate-pulse' };
      if (diffDays <= 3) return { text: `D-${diffDays} 마감임박`, color: 'bg-amber-500 text-white font-bold' };
      return { text: `D-${diffDays}`, color: 'bg-white/80 dark:bg-black/70 backdrop-blur-md text-slate-900 dark:text-white border border-black/5 dark:border-white/10 font-semibold' };
    } catch {
      return { text: '진행중', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    }
  };

  const airlineStyle = getAirlineBadge(promo.airline);
  const dday = calculateDday(promo.promo_end, promo.status);
  const eventUrl = getPromoEventUrl(promo);
  const destList = promo.destinations
    ? promo.destinations.split(',').map((d) => d.trim()).filter(Boolean)
    : [];

  // 특가 기간 텍스트 (시작일 ~ 종료일 온전한 표기)
  const promoPeriodText = promo.promo_start && promo.promo_end
    ? `${promo.promo_start} ~ ${promo.promo_end}`
    : promo.promo_end
    ? `~ ${promo.promo_end}`
    : promo.promo_start
    ? `${promo.promo_start} ~`
    : '상시 진행';

  const fallbackSvg =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%230f172a"/><circle cx="300" cy="200" r="120" fill="none" stroke="%23334155" stroke-width="1.5"/><path d="M260 200 L340 200 M300 160 L300 240" stroke="%23475569" stroke-width="1.5"/><text x="50%" y="82%" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="14" font-weight="600" letter-spacing="2">AIRLINE PROMOTION</text></svg>';

  const displayImage = promo.image_url && promo.image_url.startsWith('http')
    ? promo.image_url
    : fallbackSvg;

  return (
    <div
      onClick={() => onSelectPromo(promo)}
      className="group relative flex flex-row sm:flex-col bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/20 transition-all duration-300 shadow-xs hover:shadow-xl dark:hover:shadow-2xl overflow-hidden cursor-pointer arch-card-glow p-3 sm:p-0 gap-3 sm:gap-0"
    >
      {/* Visual Window (차경 프레이밍: 모바일에서는 콤팩트 스퀘어, PC에서는 와이드 윈도우) */}
      <div className="relative w-28 self-stretch min-h-[112px] sm:w-full sm:h-48 sm:min-h-0 sm:self-auto shrink-0 overflow-hidden rounded-xl sm:rounded-none bg-slate-100 dark:bg-slate-800">
        <img
          src={displayImage}
          alt={promo.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackSvg;
          }}
        />

        {/* Ambient Overlay Layer (Desktop) */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />

        {/* Desktop Top Floating Chips */}
        <div className="hidden sm:flex absolute top-3 left-3 right-3 items-center justify-between pointer-events-none">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-xs ${airlineStyle.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${airlineStyle.dot}`} />
            {promo.airline}
          </span>

          <span className={`text-[11px] px-2.5 py-1 rounded-full shadow-xs ${dday.color}`}>
            {dday.text}
          </span>
        </div>

        {/* Desktop Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(promo.id);
          }}
          className="hidden sm:block absolute bottom-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
          title={isBookmarked ? '관심 특가 저장 취소' : '관심 특가 저장'}
          aria-label="북마크"
        >
          <Bookmark className={`w-3.5 h-3.5 stroke-[1.75] ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
        </button>

        {/* Desktop Region Tag */}
        <div className="hidden sm:flex absolute bottom-3 left-3 items-center gap-1">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md backdrop-blur-md bg-black/70 text-white border border-white/15">
            {promo.region_category === '뉴질랜드' ? '뉴질랜드' : (promo.region_category || '국제선')}
          </span>
        </div>

        {/* Mobile Floating D-Day Chip */}
        <div className="sm:hidden absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs ${dday.color}`}>
            {dday.text}
          </span>
        </div>
      </div>

      {/* Content Space (모바일은 가볍게, PC는 디테일하게) */}
      <div className="flex-1 min-w-0 flex flex-col justify-between sm:p-5">
        <div>
          {/* Mobile Airline Header & Bookmark */}
          <div className="flex sm:hidden items-center justify-between gap-1 mb-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${airlineStyle.dot}`} />
              <span className="truncate">{promo.airline}</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(promo.id);
              }}
              className="p-1 text-slate-400 hover:text-amber-500 transition-colors shrink-0"
              title={isBookmarked ? '관심 특가 취소' : '관심 특가 저장'}
              aria-label="북마크"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
            </button>
          </div>

          {/* Desktop Badge text / Benefit Highlight */}
          {promo.badge_text && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 tracking-tight">
              <Tag className="w-3 h-3 stroke-[2]" />
              <span className="line-clamp-1">{promo.badge_text}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="text-xs sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {promo.title}
          </h3>

          {/* Subtitle (Desktop only - 모바일에서는 과밀 억제를 위해 생략) */}
          {promo.subtitle && promo.subtitle !== promo.badge_text && (
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-1 leading-relaxed">
              {promo.subtitle}
            </p>
          )}

          {/* Destination Tags (Desktop only) */}
          {destList.length > 0 && (
            <div className="hidden sm:flex mt-3.5 flex-wrap gap-1.5">
              {destList.slice(0, 4).map((dest, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/[0.04]"
                >
                  <MapPin className="w-2.5 h-2.5 text-slate-400 stroke-[2]" />
                  {dest}
                </span>
              ))}
              {destList.length > 4 && (
                <span className="text-[10px] text-slate-400 px-1 py-0.5">
                  +{destList.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Horizon: Period & CTA Button */}
        <div className="mt-2.5 sm:mt-5 sm:pt-3.5 sm:border-t sm:border-slate-100 sm:dark:border-white/[0.06] flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-2 gap-x-2 text-xs text-slate-500 dark:text-slate-400">
          {/* 특가 시작일 및 종료일 (모바일/PC 모두 온전하게 전체 노출) */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 stroke-[1.75] shrink-0" />
            <span className="tabular-nums whitespace-nowrap">
              {promoPeriodText}
            </span>
          </div>

          {/* AGENTS.md Standard CTA: "바로가기" */}
          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-2xs active:scale-96 shrink-0 ml-auto sm:ml-0"
            title={`${promo.airline} 바로가기`}
          >
            <span>바로가기</span>
            <ExternalLink className="w-3 h-3 stroke-[2.5]" />
          </a>
        </div>
      </div>
    </div>
  );
};

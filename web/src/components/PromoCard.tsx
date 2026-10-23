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

  // Default fallback image
  const defaultBg =
    promo.region_category === '일본'
      ? 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80'
      : promo.region_category === '뉴질랜드'
      ? 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80'
      : 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80';

  const displayImage = promo.image_url && promo.image_url.startsWith('http')
    ? promo.image_url
    : defaultBg;

  return (
    <div
      onClick={() => onSelectPromo(promo)}
      className="group relative flex flex-col bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/20 transition-all duration-300 shadow-xs hover:shadow-xl dark:hover:shadow-2xl overflow-hidden cursor-pointer arch-card-glow"
    >
      {/* Visual Window (차경 프레이밍 효과) */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={displayImage}
          alt={promo.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultBg;
          }}
        />

        {/* Ambient Overlay Layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />

        {/* Top Floating Chips (Layering) */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {/* Airline Chip */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-xs ${airlineStyle.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${airlineStyle.dot}`} />
            {promo.airline}
          </span>

          {/* D-Day Chip */}
          <span className={`text-[11px] px-2.5 py-1 rounded-full shadow-xs ${dday.color}`}>
            {dday.text}
          </span>
        </div>

        {/* Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(promo.id);
          }}
          className="absolute bottom-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-md transition-colors border border-white/10"
          title={isBookmarked ? '관심 특가 저장 취소' : '관심 특가 저장'}
          aria-label="북마크"
        >
          <Bookmark className={`w-3.5 h-3.5 stroke-[1.75] ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
        </button>

        {/* Region Tag */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md backdrop-blur-md bg-black/70 text-white border border-white/15">
            {promo.region_category === '뉴질랜드' ? '뉴질랜드' : (promo.region_category || '국제선')}
          </span>
        </div>
      </div>

      {/* Content Space (마당과 여백의 미학) */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Badge text / Benefit Highlight */}
          {promo.badge_text && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 tracking-tight">
              <Tag className="w-3 h-3 stroke-[2]" />
              <span className="line-clamp-1">{promo.badge_text}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
              title={`${promo.airline} 공식 이벤트 페이지 바로가기`}
            >
              {promo.title}
            </a>
          </h3>

          {/* Subtitle */}
          {promo.subtitle && promo.subtitle !== promo.badge_text && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-1 leading-relaxed">
              {promo.subtitle}
            </p>
          )}

          {/* Destination Tags (Minimal Geometric Pills) */}
          {destList.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
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
                <span className="text-[10px] font-mono text-slate-400 px-1 py-0.5">
                  +{destList.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Horizon: Period & CTA Button */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
            <span className="truncate max-w-[130px] sm:max-w-[150px]">
              {promo.promo_start && promo.promo_end
                ? `${promo.promo_start} ~ ${promo.promo_end}`
                : '진행중'}
            </span>
          </div>

          {/* AGENTS.md Standard CTA: "바로가기" */}
          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-2xs active:scale-96 shrink-0"
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

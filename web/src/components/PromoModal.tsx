'use client';

import React from 'react';
import { X, ExternalLink, Calendar, MapPin, Tag, Bookmark, AlertCircle } from 'lucide-react';
import { Promotion } from '@/types';
import { getPromoEventUrl } from '@/lib/filterData';

interface PromoModalProps {
  promo: Promotion | null;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}

export const PromoModal: React.FC<PromoModalProps> = ({
  promo,
  onClose,
  isBookmarked,
  onToggleBookmark,
}) => {
  if (!promo) return null;

  const eventUrl = getPromoEventUrl(promo);
  const destList = promo.destinations
    ? promo.destinations.split(',').map((d) => d.trim()).filter(Boolean)
    : [];

  const regionLabel = promo.region_category === '뉴질랜드'
    ? '뉴질랜드'
    : (promo.region_category || '국제선');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80 dark:border-white/[0.1] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close & Bookmark Actions */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => onToggleBookmark(promo.id)}
            className="p-2.5 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer"
            title={isBookmarked ? '관심 특가 취소' : '관심 특가 저장'}
            aria-label="북마크"
          >
            <Bookmark className={`w-4 h-4 stroke-[1.75] ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        {/* Modal Banner Frame (차경 뷰) */}
        {promo.image_url ? (
          <div className="relative h-64 sm:h-72 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <img
              src={promo.image_url}
              alt={promo.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-black/30 pointer-events-none" />

            <div className="absolute bottom-5 left-6 right-6 text-white pointer-events-none">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md border border-white/20 text-white mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {promo.airline} · {regionLabel}
              </div>
              <h2 className="text-xl sm:text-2xl font-black leading-snug tracking-tight">
                {promo.title}
              </h2>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-white/[0.06]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 mb-3">
              {promo.airline} · {regionLabel}
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {promo.title}
            </h2>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Subtitle / summary */}
          {promo.subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.03] p-4 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] leading-relaxed">
              {promo.subtitle}
            </p>
          )}

          {/* Details Grid (Simple Materials) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-slate-500 stroke-[2]" />
                <span>프로모션 기간</span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {promo.promo_start && promo.promo_end
                  ? `${promo.promo_start} ~ ${promo.promo_end}`
                  : '공식 사이트 확인 요망'}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Tag className="w-3.5 h-3.5 text-slate-500 stroke-[2]" />
                <span>혜택 유형</span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {promo.badge_text || '국제선 정기/특가 할인'}
              </p>
            </div>
          </div>

          {/* Target Destinations */}
          {destList.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 stroke-[2]" />
                <span>주요 대상 노선</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {destList.map((dest, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/60 dark:border-white/[0.05]"
                  >
                    {dest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verification Notice */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 stroke-[2]" />
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">실시간 공식 이벤트 안내:</span> 특가 운임은 좌석 상황에 따라 조기 마감될 수 있으며, 유류할증료 및 공항세가 별도 적용됩니다. 상세 일정 및 예매 조건은 공식 이벤트 페이지에서 확인하실 수 있습니다.
            </div>
          </div>

          {/* Direct CTA (AGENTS.md Standard) */}
          <div className="pt-2">
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all text-sm cursor-pointer"
            >
              <span>바로가기</span>
              <ExternalLink className="w-4 h-4 stroke-[2.5]" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { X, ExternalLink, Calendar, MapPin, Tag, Bookmark, CheckCircle2, AlertCircle } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close & Action Buttons */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={() => onToggleBookmark(promo.id)}
            className="p-2.5 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 backdrop-blur-md shadow-md transition-all"
            title={isBookmarked ? '북마크 해제' : '북마크 저장'}
          >
            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 backdrop-blur-md shadow-md transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Banner */}
        {promo.image_url && (
          <div className="relative h-64 sm:h-72 w-full bg-slate-100 overflow-hidden">
            <img
              src={promo.image_url}
              alt={promo.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />
            
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white mb-2 shadow-sm">
                {promo.airline} · {regionLabel}
              </div>
              <h2 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-md">
                {promo.title}
              </h2>
            </div>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {!promo.image_url && (
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md">
                {promo.airline} · {regionLabel}
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {promo.title}
              </h2>
            </div>
          )}

          {/* Subtitle / summary */}
          {promo.subtitle && (
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              {promo.subtitle}
            </p>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>프로모션 기간</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {promo.promo_start && promo.promo_end
                  ? `${promo.promo_start} ~ ${promo.promo_end}`
                  : '공식 사이트 확인 요망'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Tag className="w-4 h-4 text-amber-500" />
                <span>프로모션 혜택 유형</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {promo.badge_text || '국제선 정기/특가 할인'}
              </p>
            </div>
          </div>

          {/* Target Destinations */}
          {destList.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>주요 대상 목적지</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {destList.map((dest, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 text-xs font-bold border border-indigo-100 dark:border-indigo-800"
                  >
                    {dest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tip Notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-900 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">항공권 예매 시 유의사항:</span> 특가 운임은 좌석 수에 따라 조기 매진될 수 있으며, 유류할증료 및 공항이용료가 별도 부과됩니다. 상세 규정 및 환불 조건은 {promo.airline} 공식 페이지를 확인해주세요.
            </div>
          </div>

          {/* Direct CTA */}
          <div className="pt-2">
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all text-base"
            >
              <span>바로가기</span>
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

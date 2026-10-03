'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { StatsBanner } from '@/components/StatsBanner';
import { FilterBar } from '@/components/FilterBar';
import { PromoCard } from '@/components/PromoCard';
import { PromoModal } from '@/components/PromoModal';
import { NewsCard } from '@/components/NewsCard';
import { clusterNewsArticles } from '@/lib/clusterNews';
import { filterPromotions, filterNewsArticles, calculatePromoStats, isPromoExpired } from '@/lib/filterData';
import { Promotion, CrawlStats, NewsArticle, GroupedNews } from '@/types';
import { BookmarkX, PlaneTakeoff, Newspaper, RefreshCw } from 'lucide-react';

export default function Home() {
  const [rawPromotions, setRawPromotions] = useState<Promotion[]>([]);
  const [rawNewsArticles, setRawNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  // Tab: 'news' (특가 기사) | 'promotions' (공식 특가)
  const [activeTab, setActiveTab] = useState<'news' | 'promotions'>('news');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ING');
  const [sortOrder, setSortOrder] = useState('default');
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

  // News states
  const [isJapanOnlyNews, setIsJapanOnlyNews] = useState(false);
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
  const [newsStatusFilter, setNewsStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING'>('ALL');

  // Bookmarks (LocalStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Load bookmarks on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('flypromo_bookmarks');
      if (saved) {
        setBookmarkedIds(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse bookmarks:', e);
    }
  }, []);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('flypromo_bookmarks', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save bookmarks:', e);
      }
      return next;
    });
  };

  // Fetch static data (Compatible with GitHub Pages & Local dev)
  const loadData = useCallback(async () => {
    setLoading(true);
    setNewsLoading(true);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

    try {
      const cacheBust = `?t=${Date.now()}`;
      const [promosRes, newsRes] = await Promise.all([
        fetch(`${basePath}/data/promotions.json${cacheBust}`),
        fetch(`${basePath}/data/news.json${cacheBust}`),
      ]);

      if (promosRes.ok) {
        const promosData = await promosRes.json();
        setRawPromotions(promosData);
      }

      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setRawNewsArticles(newsData);
      }
    } catch (err) {
      console.error('Failed to load static flight data:', err);
    } finally {
      setLoading(false);
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    const count = rawPromotions.filter(isPromoExpired).length;
    setRefreshMessage(`최신 특가 데이터를 갱신했습니다! (마감/종료 특가 ${count}건 자동 내림 완료)`);
    setTimeout(() => setRefreshMessage(null), 4000);
  };

  // Computed: Stats
  const stats = useMemo(() => calculatePromoStats(rawPromotions), [rawPromotions]);

  // Computed: Expired promos count
  const expiredPromosCount = useMemo(() => {
    return rawPromotions.filter(isPromoExpired).length;
  }, [rawPromotions]);

  // Computed: Filtered Promotions
  const displayedPromotions = useMemo(() => {
    return filterPromotions(rawPromotions, {
      airline: selectedAirline,
      region: selectedRegion,
      status: selectedStatus,
      search: searchTerm,
      sort: sortOrder,
      bookmarkedIds,
      showOnlyBookmarks,
    });
  }, [rawPromotions, selectedAirline, selectedRegion, selectedStatus, searchTerm, sortOrder, bookmarkedIds, showOnlyBookmarks]);

  // Computed: Filtered News Articles
  const filteredNews = useMemo(() => {
    return filterNewsArticles(rawNewsArticles, {
      isJapanOnly: isJapanOnlyNews,
      airline: selectedAirline,
      search: searchTerm,
    });
  }, [rawNewsArticles, isJapanOnlyNews, selectedAirline, searchTerm]);

  const totalNewsCount = useMemo(() => rawNewsArticles.length, [rawNewsArticles]);
  const japanNewsCount = useMemo(() => rawNewsArticles.filter((n) => n.is_japan === 1).length, [rawNewsArticles]);

  // Grouped news by topic
  const groupedNews = useMemo(() => clusterNewsArticles(filteredNews), [filteredNews]);

  const rawDisplayList: GroupedNews[] = useMemo(() => {
    if (isGroupingEnabled) return groupedNews;
    return filteredNews.map((art) => ({
      id: art.id,
      mainArticle: art,
      relatedArticles: [],
      articleCount: 1,
      sources: [art.source],
      is_japan: art.is_japan,
      japan_cities: art.japan_cities,
      airline: art.airline,
      promo_status: art.promo_status || 'ACTIVE',
      promo_period_desc: art.promo_period_desc || '실시간 진행중',
      latestPublishedAt: art.published_at,
    }));
  }, [isGroupingEnabled, groupedNews, filteredNews]);

  const displayNewsList = useMemo(() => {
    if (newsStatusFilter === 'ALL') return rawDisplayList;
    return rawDisplayList.filter((g) => g.promo_status === newsStatusFilter);
  }, [rawDisplayList, newsStatusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Refresh Toast Notification */}
      {refreshMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>{refreshMessage}</span>
        </div>
      )}

      {/* Global Navbar */}
      <Navbar
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        bookmarkCount={bookmarkedIds.length}
        showOnlyBookmarks={showOnlyBookmarks}
        onToggleBookmarks={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
        lastUpdated={stats?.lastUpdated}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Stats & Header Hero Banner */}
        <StatsBanner
          stats={stats}
          selectedAirline={selectedAirline}
          onSelectAirline={setSelectedAirline}
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegion}
        />

        {/* Tab Switcher: Flight News vs Airline Website Events */}
        <div className="flex flex-wrap items-center gap-3 mb-6 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'news'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>📰 실시간 특가 보도자료</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'news' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalNewsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('promotions')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'promotions'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <PlaneTakeoff className="w-4 h-4" />
            <span>✈️ 항공사 공식 특가 이벤트</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'promotions' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {stats.total}
            </span>
          </button>
        </div>

        {/* Main Content View by Active Tab */}
        {activeTab === 'promotions' ? (
          <>
            {/* Filter Bar */}
            <FilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              selectedAirline={selectedAirline}
              onSelectAirline={setSelectedAirline}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              totalFilteredCount={displayedPromotions.length}
              expiredCount={expiredPromosCount}
            />

            {/* Promotions Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                ))}
              </div>
            ) : displayedPromotions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedPromotions.map((promo) => (
                  <PromoCard
                    key={promo.id}
                    promo={promo}
                    isBookmarked={bookmarkedIds.includes(promo.id)}
                    onToggleBookmark={toggleBookmark}
                    onSelectPromo={setSelectedPromo}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
                <BookmarkX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">
                  {showOnlyBookmarks ? '저장된 관심 특가가 없습니다' : '조건에 맞는 특가가 없습니다'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {showOnlyBookmarks
                    ? '마음에 드는 항공권 특가의 북마크 아이콘을 눌러 저장해보세요.'
                    : '검색 조건을 변경하거나 필터를 초기화해보세요.'}
                </p>
              </div>
            )}
          </>
        ) : (
          /* News Feed Mode */
          <div className="space-y-6">
            {/* News Filter Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* News Status Filter (All / Active / Upcoming) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                  <button
                    onClick={() => setNewsStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      newsStatusFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-sm font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setNewsStatusFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      newsStatusFilter === 'ACTIVE'
                        ? 'bg-white text-emerald-600 shadow-sm font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    🔥 진행중
                  </button>
                  <button
                    onClick={() => setNewsStatusFilter('UPCOMING')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      newsStatusFilter === 'UPCOMING'
                        ? 'bg-white text-amber-600 shadow-sm font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    ⏰ 오픈 예정
                  </button>
                </div>

                {/* Japan Only Filter Toggle */}
                <button
                  onClick={() => setIsJapanOnlyNews(!isJapanOnlyNews)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isJapanOnlyNews
                      ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🇯🇵 일본 노선 전용 ({japanNewsCount})
                </button>

                {/* Topic Clustering Toggle */}
                <button
                  onClick={() => setIsGroupingEnabled(!isGroupingEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isGroupingEnabled
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🔗 동일 기사 묶어보기
                </button>
              </div>

              {/* News Search */}
              <div className="w-full lg:w-72">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="기사 검색 (도쿄, 오사카, 할인...)"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            {/* News List */}
            {newsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200 animate-pulse h-40" />
                ))}
              </div>
            ) : displayNewsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayNewsList.map((grouped) => (
                  <NewsCard key={grouped.id} grouped={grouped} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
                <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">해당 조건의 기사가 없습니다</h3>
                <p className="text-xs text-slate-500 mt-1">검색어를 지우거나 전체 기사 보기를 클릭해보세요.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <PromoModal
        promo={selectedPromo}
        onClose={() => setSelectedPromo(null)}
        isBookmarked={selectedPromo ? bookmarkedIds.includes(selectedPromo.id) : false}
        onToggleBookmark={toggleBookmark}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 일본특가모아 (JapanFlight). 한일 전 노선 항공권 프로모션 애그리게이터.</p>
          <p className="text-slate-400">
            각 프로모션의 세부 운임 규정 및 예약은 해당 항공사 공식 사이트를 기준으로 합니다.
          </p>
        </div>
      </footer>
    </div>
  );
}

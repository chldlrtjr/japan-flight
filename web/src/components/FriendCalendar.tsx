'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Search,
  Calendar as CalendarIcon,
  MapPin,
  FileText,
  Trash2,
  Edit2,
  X,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface Friend {
  id: string;
  name: string;
  color: string;
}

interface CalendarEvent {
  id: string;
  friendId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  location?: string;
  memo?: string;
}

const DEFAULT_FRIENDS: Friend[] = [
  { id: 'f_1', name: '민수', color: '#3b82f6' },
  { id: 'f_2', name: '지은', color: '#ec4899' },
  { id: 'f_3', name: '태호', color: '#10b981' },
  { id: 'f_4', name: '수빈', color: '#f59e0b' },
  { id: 'f_5', name: '동현', color: '#8b5cf6' },
];

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'ev_init_1',
    friendId: 'f_1',
    title: '민수와 오사카 특가 여행 계획 회의',
    date: '2026-10-18',
    time: '19:00',
    location: '강남역 카페',
    memo: '항공권 예매 및 숙소 리스트 공유',
  },
  {
    id: 'ev_init_2',
    friendId: 'f_2',
    title: '지은이 후쿠오카 주말 특가 출발',
    date: '2026-10-24',
    time: '08:30',
    location: '인천공항 제1터미널',
    memo: '인적사항, e티켓 출력물 확인',
  },
];

const getFormattedDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const FriendCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [friends, setFriends] = useState<Friend[]>(DEFAULT_FRIENDS);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeFilterFriendId, setActiveFilterFriendId] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Form states
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formFriendId, setFormFriendId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formMemo, setFormMemo] = useState<string>('');

  // Friend form states
  const [newFriendName, setNewFriendName] = useState<string>('');
  const [newFriendColor, setNewFriendColor] = useState<string>('#6366f1');

  // Selected event for view modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // 🔥 1. Real-time Firebase Firestore synchronization
  useEffect(() => {
    const docRef = doc(db, 'calendar_data', 'shared');

    // Subscribe to real-time changes
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        setIsConnected(true);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.friends && Array.isArray(data.friends)) {
            setFriends(data.friends);
          }
          if (data.events && Array.isArray(data.events)) {
            setEvents(data.events);
          }
        } else {
          // Initialize Firebase if empty
          setDoc(docRef, {
            friends: DEFAULT_FRIENDS,
            events: INITIAL_EVENTS,
            updatedAt: new Date().toISOString(),
          }).catch((err) => console.error('Failed to init Firestore document:', err));
        }
      },
      (error) => {
        console.error('Firestore real-time subscription error:', error);
        setIsConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Update Firestore helper
  const syncToFirestore = async (newFriends: Friend[], newEvents: CalendarEvent[]) => {
    try {
      const docRef = doc(db, 'calendar_data', 'shared');
      await setDoc(docRef, {
        friends: newFriends,
        events: newEvents,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to sync to Firestore:', err);
      alert('일정 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const getFriend = (friendId: string): Friend => {
    return friends.find((f) => f.id === friendId) || { id: 'unknown', name: '알 수 없음', color: '#94a3b8' };
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToday = () => {
    setCurrentDate(new Date());
  };

  // Open Event Modal
  const openAddEventModal = (dateStr?: string) => {
    setEditingEventId(null);
    setFormFriendId(friends[0]?.id || '');
    setFormTitle('');
    setFormDate(dateStr || getFormattedDate(new Date()));
    setFormTime('');
    setFormLocation('');
    setFormMemo('');
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setFormFriendId(ev.friendId);
    setFormTitle(ev.title);
    setFormDate(ev.date);
    setFormTime(ev.time || '');
    setFormLocation(ev.location || '');
    setFormMemo(ev.memo || '');
    setIsEventModalOpen(true);
  };

  // Save Event (Add or Edit) -> Direct real-time sync
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFriendId || !formTitle || !formDate) {
      alert('친구, 일정 제목, 날짜를 입력해주세요.');
      return;
    }

    let updatedEvents: CalendarEvent[];
    if (editingEventId) {
      updatedEvents = events.map((ev) =>
        ev.id === editingEventId
          ? {
              ...ev,
              friendId: formFriendId,
              title: formTitle,
              date: formDate,
              time: formTime,
              location: formLocation,
              memo: formMemo,
            }
          : ev
      );
    } else {
      const newEv: CalendarEvent = {
        id: 'ev_' + Date.now(),
        friendId: formFriendId,
        title: formTitle,
        date: formDate,
        time: formTime,
        location: formLocation,
        memo: formMemo,
      };
      updatedEvents = [...events, newEv];
    }

    // Local optimistic update
    setEvents(updatedEvents);
    setIsEventModalOpen(false);

    // Push to Firestore (auto-reflected to all users)
    await syncToFirestore(friends, updatedEvents);
  };

  // Delete Event -> Direct real-time sync
  const handleDeleteEvent = async (id: string) => {
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      const updatedEvents = events.filter((ev) => ev.id !== id);
      setEvents(updatedEvents);
      setIsEventModalOpen(false);
      setIsViewModalOpen(false);
      await syncToFirestore(friends, updatedEvents);
    }
  };

  // Add Friend -> Direct real-time sync
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFriendName.trim();
    if (!trimmed) return;
    const newFriend: Friend = {
      id: 'f_' + Date.now(),
      name: trimmed,
      color: newFriendColor,
    };
    const updatedFriends = [...friends, newFriend];
    setFriends(updatedFriends);
    setNewFriendName('');
    await syncToFirestore(updatedFriends, events);
  };

  // Delete Friend -> Direct real-time sync
  const handleDeleteFriend = async (id: string) => {
    if (confirm('이 친구를 삭제하시겠습니까?')) {
      const updatedFriends = friends.filter((f) => f.id !== id);
      setFriends(updatedFriends);
      await syncToFirestore(updatedFriends, events);
    }
  };

  // Calendar cells computation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const firstDayWeekIndex = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: { day: number; dateStr: string; isOtherMonth: boolean; isToday: boolean; dayOfWeek: number }[] = [];
    const todayStr = getFormattedDate(new Date());

    // Previous month padding
    for (let i = firstDayWeekIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        day: d,
        dateStr: getFormattedDate(prevDate),
        isOtherMonth: true,
        isToday: false,
        dayOfWeek: prevDate.getDay(),
      });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = getFormattedDate(dateObj);
      days.push({
        day: d,
        dateStr,
        isOtherMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: dateObj.getDay(),
      });
    }

    // Next month padding
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        day: d,
        dateStr: getFormattedDate(nextDate),
        isOtherMonth: true,
        isToday: false,
        dayOfWeek: nextDate.getDay(),
      });
    }

    return days;
  }, [year, month]);

  // Filtered Events
  const getEventsForDate = (dateStr: string) => {
    return events.filter((ev) => {
      if (ev.date !== dateStr) return false;
      if (activeFilterFriendId !== 'ALL' && ev.friendId !== activeFilterFriendId) return false;
      if (searchKeyword) {
        const friend = getFriend(ev.friendId);
        const matchTitle = ev.title.toLowerCase().includes(searchKeyword.toLowerCase());
        const matchFriend = friend.name.toLowerCase().includes(searchKeyword.toLowerCase());
        const matchLoc = (ev.location || '').toLowerCase().includes(searchKeyword.toLowerCase());
        if (!matchTitle && !matchFriend && !matchLoc) return false;
      }
      return true;
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Real-time Sync Status */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
              title="이전달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 h-8 text-xs font-semibold rounded-md hover:bg-white text-slate-700 transition"
            >
              오늘
            </button>
            <button
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
              title="다음달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight min-w-[140px]">
            {year}년 {month + 1}월
          </h2>

          {/* Real-time Indicator Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>실시간 자동 동기화</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Search Input */}
          <div className="relative w-full sm:w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="일정 검색..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Add Event Button */}
          <button
            onClick={() => openAddEventModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>새 일정 등록</span>
          </button>

          {/* Manage Friends */}
          <button
            onClick={() => setIsFriendModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>친구 관리</span>
          </button>
        </div>
      </div>

      {/* Friends Filter Chips */}
      <div className="bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-400 uppercase shrink-0 mr-1">친구 필터:</span>
        <button
          onClick={() => setActiveFilterFriendId('ALL')}
          className={`px-3 py-1 text-xs font-bold rounded-full transition shrink-0 ${
            activeFilterFriendId === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          전체 보기
        </button>
        {friends.map((f) => {
          const isActive = activeFilterFriendId === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilterFriendId(isActive ? 'ALL' : f.id)}
              className="px-3 py-1 text-xs font-semibold rounded-full transition shrink-0 flex items-center gap-1.5"
              style={{
                backgroundColor: isActive ? f.color : `${f.color}15`,
                color: isActive ? '#ffffff' : '#334155',
                border: `1px solid ${f.color}40`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
              <span>{f.name}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Day of Week Header */}
        <div className="grid grid-cols-7 text-center text-xs font-bold py-3 bg-slate-50 border-b border-slate-200 text-slate-500">
          <div className="text-rose-500">일</div>
          <div>월</div>
          <div>화</div>
          <div>수</div>
          <div>목</div>
          <div>금</div>
          <div className="text-sky-600">토</div>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {calendarDays.map((cDay, idx) => {
            const dayEvents = getEventsForDate(cDay.dateStr);

            let dayColorClass = 'text-slate-800';
            if (cDay.isOtherMonth) {
              dayColorClass = 'text-slate-300';
            } else if (cDay.dayOfWeek === 0) {
              dayColorClass = 'text-rose-500';
            } else if (cDay.dayOfWeek === 6) {
              dayColorClass = 'text-sky-600';
            }

            return (
              <div
                key={idx}
                onClick={() => openAddEventModal(cDay.dateStr)}
                className={`min-h-[110px] sm:min-h-[120px] p-2 flex flex-col transition hover:bg-slate-50 cursor-pointer group ${
                  cDay.isOtherMonth ? 'bg-slate-50/40' : 'bg-white'
                }`}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      cDay.isToday ? 'bg-indigo-600 text-white font-bold shadow-xs' : dayColorClass
                    }`}
                  >
                    {cDay.day}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddEventModal(cDay.dateStr);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 text-xs transition p-0.5"
                    title="일정 추가"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Event Badges List */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-24">
                  {dayEvents.map((ev) => {
                    const friend = getFriend(ev.friendId);
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                          setIsViewModalOpen(true);
                        }}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md truncate cursor-pointer transition hover:brightness-95 flex items-center gap-1.5 shadow-2xs"
                        style={{
                          backgroundColor: `${friend.color}15`,
                          borderLeft: `3px solid ${friend.color}`,
                          color: '#1e293b',
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: friend.color }} />
                        <span className="font-bold text-slate-700 shrink-0">{friend.name}:</span>
                        <span className="truncate flex-1">{ev.title}</span>
                        {ev.time && <span className="text-[10px] text-slate-400 shrink-0">{ev.time}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Modals --- */}

      {/* 1. Add / Edit Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingEventId ? '일정 수정' : '새 친구 일정 추가'}</h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">친구 선택 *</label>
                <div className="flex gap-2">
                  <select
                    value={formFriendId}
                    onChange={(e) => setFormFriendId(e.target.value)}
                    required
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {friends.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsFriendModalOpen(true)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    + 친구추가
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 후쿠오카 특가 여행, 주말 모임"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">날짜 *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">시간</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">장소</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="예: 인천국제공항 제1여객터미널"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">메모</label>
                <textarea
                  rows={2}
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="항공권 예약번호, 챙길 것 등"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {editingEventId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEventId)}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제</span>
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-sm transition"
                  >
                    저장
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Friend Management Modal */}
      {isFriendModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">친구 및 라벨 색상 관리</h3>
              <button onClick={() => setIsFriendModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <form onSubmit={handleAddFriend} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  placeholder="새 친구 이름 (예: 민호)"
                  required
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="color"
                  value={newFriendColor}
                  onChange={(e) => setNewFriendColor(e.target.value)}
                  className="w-10 h-9 p-0.5 border border-slate-200 rounded-xl cursor-pointer bg-white"
                  title="친구 색상 선택"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                >
                  추가
                </button>
              </form>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  등록된 친구 ({friends.length}명)
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={f.color}
                          onChange={async (e) => {
                            const newColor = e.target.value;
                            const updated = friends.map((item) => (item.id === f.id ? { ...item, color: newColor } : item));
                            setFriends(updated);
                            await syncToFirestore(updated, events);
                          }}
                          className="w-6 h-6 rounded border-0 p-0 cursor-pointer bg-transparent"
                        />
                        <span className="text-sm font-semibold text-slate-800">{f.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteFriend(f.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. View Event Detail Modal */}
      {isViewModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div
              className="h-3.5"
              style={{ backgroundColor: getFriend(selectedEvent.friendId).color }}
            />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className="inline-block text-xs px-2.5 py-0.5 rounded-full font-bold text-white mb-1.5"
                    style={{ backgroundColor: getFriend(selectedEvent.friendId).color }}
                  >
                    {getFriend(selectedEvent.friendId).name}
                  </span>
                  <h4 className="text-base font-bold text-slate-900">{selectedEvent.title}</h4>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    {selectedEvent.date} {selectedEvent.time || ''}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.memo && (
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedEvent.memo}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    openEditEventModal(selectedEvent);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>수정</span>
                </button>
                <button
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

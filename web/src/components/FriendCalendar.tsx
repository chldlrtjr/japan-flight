'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowRight,
  Clock,
  UserCheck,
  Copy,
  Check,
  Sparkles,
  Plane,
  Download,
  Upload,
  History,
  ShieldCheck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Flame,
  Database,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface Friend {
  id: string;
  name: string;
  color: string;
  birthDate?: string;      // 생년월일 (YYYY-MM-DD)
  gender?: 'M' | 'F' | ''; // 성별 (M: 남성, F: 여성)
  memo?: string;           // 메모
}

interface CalendarEvent {
  id: string;
  friendId?: string;   // 기존 단일 친구 ID (하위 호환)
  friendIds?: string[]; // 참여 친구 ID 목록 (없거나 비어있으면 참여자 미정 약속)
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  time?: string;     // HH:mm (옵션)
  location?: string;
  memo?: string;
  isAppointment?: boolean; // 약속 여부 (참여 인원이 배정되어도 약속 칸에 유지되며 참여자들에게도 부여됨)
}

// 변경 이력 스냅샷 인터페이스 (절대 유실 방지용)
interface CalendarBackupSnapshot {
  savedAt: string; // ISO string
  summary: string;
  friends: Friend[];
  events: CalendarEvent[];
}

const DEFAULT_FRIENDS: Friend[] = [];
const INITIAL_EVENTS: CalendarEvent[] = [];

const getFormattedDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// 가상/예시 데이터 완전 배제 (Zero Fake Data 원칙)
// 기본 상태는 비어 있는 깨끗한 상태로 시작하여 가상 인물이 실제 입력을 오염시키지 않도록 보장합니다.
// 친구 데이터 무결성 보장 헬퍼 (undefined 원천 차단 및 필수 필드 정규화)
const sanitizeFriend = (f: any): Friend => ({
  id: String(f?.id || 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
  name: String(f?.name || '').trim(),
  color: String(f?.color || '#3b82f6'),
  birthDate: String(f?.birthDate || ''),
  gender: f?.gender === 'M' || f?.gender === 'F' ? f.gender : '',
  memo: String(f?.memo || ''),
});

const sanitizeFriendsList = (rawFriends: any[]): Friend[] => {
  if (!Array.isArray(rawFriends)) return [];
  return rawFriends.map(sanitizeFriend);
};

// 일정 데이터 무결성 보장 헬퍼 (undefined 원천 차단 및 복수 참여자/하위 호환 완벽 정규화)
const sanitizeEvent = (ev: any): CalendarEvent => {
  const friendIds: string[] = Array.isArray(ev?.friendIds)
    ? ev.friendIds.map((id: any) => String(id || '').trim()).filter(Boolean)
    : ev?.friendId
    ? [String(ev.friendId).trim()].filter(Boolean)
    : [];

  const primaryFriendId = ev?.friendId ? String(ev.friendId).trim() : (friendIds[0] || '');
  const fallbackDate = getFormattedDate(new Date());

  // 약속 여부 판별: 명시적 boolean이 있으면 그 값 사용, 없으면 참여자가 없는 경우 약속(true)으로 간주
  const isAppointment =
    typeof ev?.isAppointment === 'boolean'
      ? ev.isAppointment
      : (friendIds.length === 0 && !ev?.friendId);

  return {
    id: String(ev?.id || 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
    friendId: primaryFriendId,
    friendIds: friendIds,
    title: String(ev?.title || '').trim(),
    startDate: String(ev?.startDate || ev?.date || fallbackDate),
    endDate: String(ev?.endDate || ev?.startDate || ev?.date || fallbackDate),
    time: String(ev?.time || ''),
    location: String(ev?.location || ''),
    memo: String(ev?.memo || ''),
    isAppointment: Boolean(isAppointment),
  };
};

const sanitizeEventsList = (rawEvents: any[]): CalendarEvent[] => {
  if (!Array.isArray(rawEvents)) return [];
  return rawEvents.map(sanitizeEvent);
};

// 변경 이력 스냅샷 정제 헬퍼 (스냅샷 내부의 과거 일정/친구 undefined 방지)
const sanitizeBackupSnapshot = (snap: any): CalendarBackupSnapshot => ({
  savedAt: String(snap?.savedAt || new Date().toISOString()),
  summary: String(snap?.summary || ''),
  friends: sanitizeFriendsList(snap?.friends || []),
  events: sanitizeEventsList(snap?.events || []),
});

// Firestore 직렬화 시 undefined 값 완전 박멸 헬퍼 (Deep Recursive Cleanser)
const stripUndefinedDeep = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = stripUndefinedDeep(val);
    }
  }
  return cleaned;
};

// 두 날짜 사이의 일수 및 박수 계산 헬퍼
const calculateDuration = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return '';
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays <= 0) return '종료일이 시작일보다 빠릅니다';
  if (diffDays === 1) return '당일 (1일)';
  const nights = diffDays - 1;
  return `총 ${diffDays}일간 (${nights}박 ${diffDays}일)`;
};

// 콤팩트한 M.D(요일) 날짜 문자열 포맷팅 헬퍼
const formatShortDateWithDay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const date = new Date(parseInt(parts[0], 10), m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[date.getDay()] || '';
  return `${m}.${d}(${dayName})`;
};

// 대한민국 법정 공휴일 및 대체공휴일 매핑 데이터 (2024~2028년)
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2024년
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날 연휴',
  '2024-02-12': '대체공휴일',
  '2024-03-01': '3·1절',
  '2024-04-10': '총선',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체공휴일',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-01': '국군의날',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '크리스마스',

  // 2025년
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '3·1절',
  '2025-03-03': '대체공휴일',
  '2025-05-05': '어린이날',
  '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',

  // 2026년
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '3·1절',
  '2026-03-02': '대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-09-28': '대체공휴일',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',

  // 2027년
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '대체공휴일',
  '2027-03-01': '3·1절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '대체공휴일',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '대체공휴일',
  '2027-12-25': '크리스마스',

  // 2028년
  '2028-01-01': '신정',
  '2028-01-26': '설날 연휴',
  '2028-01-27': '설날',
  '2028-01-28': '설날 연휴',
  '2028-03-01': '3·1절',
  '2028-05-02': '부처님오신날',
  '2028-05-05': '어린이날',
  '2028-06-06': '현충일',
  '2028-08-15': '광복절',
  '2028-10-02': '추석 연휴',
  '2028-10-03': '추석/개천절',
  '2028-10-04': '추석 연휴',
  '2028-10-05': '대체공휴일',
  '2028-10-09': '한글날',
  '2028-12-25': '크리스마스',
};

// 양력 고정 공휴일 헬퍼
const getHolidayName = (dateStr: string): string | null => {
  if (KOREAN_HOLIDAYS[dateStr]) {
    return KOREAN_HOLIDAYS[dateStr];
  }
  const mmdd = dateStr.slice(5);
  const fixedHolidays: Record<string, string> = {
    '01-01': '신정',
    '03-01': '3·1절',
    '05-05': '어린이날',
    '06-06': '현충일',
    '08-15': '광복절',
    '10-03': '개천절',
    '10-09': '한글날',
    '12-25': '크리스마스',
  };
  return fixedHolidays[mmdd] || null;
};

// 생년월일 기준 만 나이 계산 헬퍼
const calculateAge = (birthDateStr?: string) => {
  if (!birthDateStr) return '';
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `만 ${age}세`;
};

export const FriendCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  // 모바일 캘린더에서 현재 선택된 날짜 (기본값: 오늘)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getFormattedDate(new Date()));
  
  // [영구 안전 금고] 로컬스토리지에 저장된 실제 친구 정보가 있으면 즉시 우선 복원!
  const [friends, setFriends] = useState<Friend[]>([]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeFilterFriendId, setActiveFilterFriendId] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [hasLoadedFromFirestore, setHasLoadedFromFirestore] = useState<boolean>(false);

  // 클라우드 변경 이력 스냅샷 목록 (원클릭 과거 복원용)
  const [backupHistory, setBackupHistory] = useState<CalendarBackupSnapshot[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // 관리자 모드 상태 (본인만 백업/복원 버튼을 볼 수 있도록 제어)
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFriendProfileModalOpen, setIsFriendProfileModalOpen] = useState(false);
  const [isFriendScheduleModalOpen, setIsFriendScheduleModalOpen] = useState(false);
  const [selectedFriendForSchedule, setSelectedFriendForSchedule] = useState<Friend | null>(null);
  // 다가오는 약속 위젯 접기/펼치기 상태
  const [isCountdownCollapsed, setIsCountdownCollapsed] = useState<boolean>(false);
  // 친구 필터 드롭다운 상태 & Ref
  const [isFriendFilterDropdownOpen, setIsFriendFilterDropdownOpen] = useState(false);
  const friendFilterDropdownRef = useRef<HTMLDivElement>(null);

  // 친구 인적사항(생년월일 등) 프로필 폼 상태
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [isProfileFormOpen, setIsProfileFormOpen] = useState(false); // 수정/등록 버튼 클릭 시 최상단에 표시
  const profileModalBodyRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profileGender, setProfileGender] = useState<'M' | 'F' | ''>('');
  const [profileColor, setProfileColor] = useState('#3b82f6');

  // 클립보드 복사 알림 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);

  // Form states (startDate & endDate)
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formFriendId, setFormFriendId] = useState<string>('');
  const [formFriendIds, setFormFriendIds] = useState<string[]>([]); // 다중 참여 인원 (빈 배열 가능)
  const [formTitle, setFormTitle] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formMemo, setFormMemo] = useState<string>('');

  // Friend form states (기존 간이 관리용)
  const [newFriendName, setNewFriendName] = useState<string>('');
  const [newFriendColor, setNewFriendColor] = useState<string>('#6366f1');

  // 친구 필터 드롭다운 외부 클릭 시 자동 닫힘
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        friendFilterDropdownRef.current &&
        !friendFilterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFriendFilterDropdownOpen(false);
      }
    };
    if (isFriendFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFriendFilterDropdownOpen]);

  // Selected event for view modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // 이전 브라우저 로컬스토리지 백업 데이터 자동 감지 상태
  const [localBackupData, setLocalBackupData] = useState<{ friends: Friend[]; events: CalendarEvent[]; sourceName: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // 0. 관리자 모드 확인 (로컬 환경, 로컬스토리지, URL 파라미터)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setIsAdmin(true);
      } else if (localStorage.getItem('flypromo_admin_mode') === 'true') {
        setIsAdmin(true);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true' || urlParams.get('admin') === '1') {
          localStorage.setItem('flypromo_admin_mode', 'true');
          setIsAdmin(true);
        }
      }

      // 0-0. 모바일 환경 기본 접힘 또는 이전 설정 복원
      const savedCollapsed = localStorage.getItem('flypromo_countdown_collapsed');
      if (savedCollapsed !== null) {
        setIsCountdownCollapsed(savedCollapsed === 'true');
      } else if (window.innerWidth < 768) {
        setIsCountdownCollapsed(true);
      }

      // 0-1. 영구 안전 금고 캐시 우선 로드
      const cached = localStorage.getItem('flypromo_safe_friends_vault');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFriends(parsed);
        }
      }

      // 0-2. 구버전 로컬스토리지 예시 데이터(민수, 지은 등) 영구 삭제
      const sampleNames = ['민수', '지은', '태호', '수빈', '동현'];
      ['fc_friends', 'fc_events', 'flypromo_calendar_friends', 'flypromo_calendar_events'].forEach((key) => {
        const item = localStorage.getItem(key);
        if (item && sampleNames.some((name) => item.includes(name))) {
          localStorage.removeItem(key);
        }
      });

      // 1. web 서비스 이전 로컬스토리지 검사
      const flyFriends = localStorage.getItem('flypromo_calendar_friends');
      const flyEvents = localStorage.getItem('flypromo_calendar_events');
      
      // 2. 독립형 캘린더 로컬스토리지 검사
      const fcFriends = localStorage.getItem('fc_friends');
      const fcEvents = localStorage.getItem('fc_events');

      let candidateFriends: any[] = [];
      let candidateEvents: any[] = [];
      let source = '';

      if (flyFriends) {
        const parsed = JSON.parse(flyFriends);
        if (Array.isArray(parsed) && parsed.length > 0) {
          candidateFriends = parsed;
          candidateEvents = flyEvents ? JSON.parse(flyEvents) : [];
          source = '이전 웹 캘린더 로컬 저장소';
        }
      } else if (fcFriends) {
        const parsed = JSON.parse(fcFriends);
        if (Array.isArray(parsed) && parsed.length > 0) {
          candidateFriends = parsed;
          candidateEvents = fcEvents ? JSON.parse(fcEvents) : [];
          source = '독립 캘린더(HTML) 저장소';
        }
      }

      if (candidateFriends.length > 0) {
        // 과거 구버전 예시 데이터(민수, 지은 등)는 복원 후보에서 완전히 필터링하여 배제
        const sampleNames = ['민수', '지은', '태호', '수빈', '동현'];
        const realFriends = candidateFriends.filter((f) => !sampleNames.includes(f.name));

        if (realFriends.length > 0) {
          setLocalBackupData({
            friends: realFriends,
            events: candidateEvents,
            sourceName: source,
          });
        }
      }
    } catch (e) {
      console.error('Failed to detect local backup data:', e);
    }
  }, []);

  // [영구 안전 금고] 브라우저 LocalStorage에 실시간 자동 미러링 백업 (클라우드 장애나 실수 대비)
  const saveToLocalVault = (friendsToSave: Friend[], eventsToSave: CalendarEvent[]) => {
    if (typeof window === 'undefined') return;
    try {
      // 혹시라도 예시 데이터가 섞여 들어가지 않도록 필터링
      const cleanFriends = (friendsToSave || []).filter(
        (f) => !['민수', '지은', '태호', '수빈', '동현'].includes(f.name)
      );
      if (cleanFriends.length > 0) {
        localStorage.setItem('flypromo_safe_friends_vault', JSON.stringify(cleanFriends));
        localStorage.setItem('flypromo_safe_events_vault', JSON.stringify(eventsToSave));
        localStorage.setItem('flypromo_safe_vault_time', new Date().toISOString());
      }
    } catch (e) {
      console.error('Failed to save to local vault:', e);
    }
  };

  // 로컬 백업 데이터를 현재 클라우드로 복원하는 함수
  const restoreLocalBackup = async () => {
    if (!localBackupData) return;
    if (confirm(`'${localBackupData.sourceName}'에서 발견된 친구 ${localBackupData.friends.length}명의 데이터를 현재 캘린더에 복원하시겠습니까?`)) {
      setFriends(localBackupData.friends);
      if (localBackupData.events && localBackupData.events.length > 0) {
        setEvents(localBackupData.events);
      }
      await syncToFirestore(localBackupData.friends, localBackupData.events.length > 0 ? localBackupData.events : events, '로컬 저장소 데이터 복원');
      setLocalBackupData(null);
      alert('성공적으로 친구 정보가 복원되어 클라우드에 영구 저장되었습니다!');
    }
  };

  // 1. Firebase Firestore 실시간 동기화
  useEffect(() => {
    const docRef = doc(db, 'calendar_data', 'shared');

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        setIsConnected(true);
        if (docSnap.exists()) {
          const data = docSnap.data();
          let loadedFriends: Friend[] = [];
          let loadedEvents: CalendarEvent[] = [];

          const sampleNames = ['민수', '지은', '태호', '수빈', '동현'];
          if (data.friends && Array.isArray(data.friends)) {
            loadedFriends = data.friends
              .filter((f: any) => !sampleNames.includes(f?.name))
              .map(sanitizeFriend);
            setFriends(loadedFriends);
          }

          if (data.events && Array.isArray(data.events)) {
            // 과거 데이터(date 단일 필드) 호환성 보정 및 예시 일정 제거
            const sampleKeywords = ['민수', '지은', '태호', '수빈', '동현', '오사카 특가 여행 계획 회의', '후쿠오카 주말 특가', '도쿄 시부야 모임'];
            loadedEvents = data.events
              .filter((ev: any) => !sampleKeywords.some((k) => (ev?.title || '').includes(k)))
              .map(sanitizeEvent);
            setEvents(loadedEvents);
          }

          // 백업 히스토리 로드 (여권, 계좌 등 과거 민감 필드 완전 소거 및 undefined 원천 방지)
          if (data.backupHistory && Array.isArray(data.backupHistory)) {
            const sanitizedHistory: CalendarBackupSnapshot[] = data.backupHistory.map(sanitizeBackupSnapshot);
            setBackupHistory(sanitizedHistory);
          }

          // 불러온 실제 데이터를 즉시 브라우저 로컬 안전 금고에도 이중 보관!
          if (loadedFriends.length > 0) {
            saveToLocalVault(loadedFriends, loadedEvents);
          }
        } else {
          // 최초 실행 시에도 가상 예시 데이터 없이 완전히 비어 있는 상태로 생성
          setDoc(docRef, {
            friends: [],
            events: [],
            backupHistory: [],
            updatedAt: new Date().toISOString(),
          }).catch((err) => console.error('Failed to init Firestore document:', err));
        }
        setHasLoadedFromFirestore(true);
      },
      (error) => {
        console.error('Firestore real-time subscription error:', error);
        setIsConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Update Firestore helper (3중 보호 안전 가드 & 자동 히스토리 누적 적용)
  const syncToFirestore = async (newFriends: Friend[], newEvents: CalendarEvent[], actionNote = '정보 업데이트') => {
    // 1단계: 브라우저 로컬 안전 금고에 즉시 0.001초 만에 1차 영구 보관!
    const cleanFriends = sanitizeFriendsList(newFriends);
    const cleanEvents = sanitizeEventsList(newEvents);
    saveToLocalVault(cleanFriends, cleanEvents);

    if (!hasLoadedFromFirestore) {
      console.warn('초기 데이터 로딩 완료 전에 클라우드 덮어쓰기 방지 작동됨');
      return;
    }

    try {
      const docRef = doc(db, 'calendar_data', 'shared');

      // 2단계: 과거 15개 시점 변경 이력 자동 스냅샷 생성!
      const newSnapshot: CalendarBackupSnapshot = {
        savedAt: new Date().toISOString(),
        summary: `${actionNote} (친구 ${cleanFriends.length}명, 일정 ${cleanEvents.length}개)`,
        friends: cleanFriends,
        events: cleanEvents,
      };
      const rawHistory = [newSnapshot, ...(backupHistory || []).slice(0, 14)];
      const updatedHistory = rawHistory.map(sanitizeBackupSnapshot);
      setBackupHistory(updatedHistory);

      // 3단계: 클라우드 Firestore 영구 저장 (undefined 완전 제거 보장)
      const payload = stripUndefinedDeep({
        friends: cleanFriends,
        events: cleanEvents,
        backupHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(docRef, payload);
    } catch (err) {
      console.error('Failed to sync to Firestore:', err);
      alert('클라우드 저장 실패! 하지만 브라우저 영구 안전 금고에 안전하게 보관되었습니다.');
    }
  };

  // 과거 스냅샷 시점으로 즉시 되돌리기 (원클릭 롤백 - 여권/계좌 등은 절대 복원되지 않음)
  const restoreSnapshot = async (snapshot: CalendarBackupSnapshot) => {
    const timeStr = new Date(snapshot.savedAt).toLocaleString();
    if (confirm(`'${timeStr}' 시점 (${snapshot.summary})으로 데이터를 복원하시겠습니까?\n(과거에 입력했던 여권이나 계좌 정보는 복원되지 않고 안전하게 제외됩니다)`)) {
      const cleanFriends = sanitizeFriendsList(snapshot.friends);
      const cleanEvents = sanitizeEventsList(snapshot.events);
      setFriends(cleanFriends);
      setEvents(cleanEvents);
      setIsHistoryModalOpen(false);
      await syncToFirestore(cleanFriends, cleanEvents, `과거 시점 복원 (${timeStr})`);
      alert('성공적으로 이전 시점 데이터로 복원되었습니다!');
    }
  };

  // 과거 변경 이력 전체 영구 삭제 (민감정보 완전 소거)
  const clearAllBackupHistory = async () => {
    if (confirm('저장된 과거 변경 이력 스냅샷을 모두 삭제하시겠습니까?\n(현재 등록된 친구 목록과 일정은 유지되며, 과거 시점 기록만 영구 소거됩니다)')) {
      setBackupHistory([]);
      try {
        const docRef = doc(db, 'calendar_data', 'shared');
        const payload = stripUndefinedDeep({
          friends: sanitizeFriendsList(friends),
          events: sanitizeEventsList(events),
          backupHistory: [],
          updatedAt: new Date().toISOString(),
        });
        await setDoc(docRef, payload, { merge: true });
        alert('과거 변경 이력 스냅샷이 모두 영구 삭제되었습니다.');
      } catch (err) {
        console.error('Failed to clear backup history:', err);
        alert('이력 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // [파일 내보내기] 전체 친구 정보 백업 파일(JSON) 다운로드
  const exportFriendsAsJsonFile = () => {
    const backupData = {
      title: '모임 수첩 Friends Calendar Safe Backup',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      friendsCount: friends.length,
      friends,
      events,
      backupHistory,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `친구일정_백업_${getFormattedDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('친구 정보 백업 파일이 다운로드되었습니다. 스마트폰이나 PC에 소장해두시면 언제든 복원할 수 있습니다!');
  };

  // [파일 불러오기] 백업 파일(JSON)에서 데이터 읽어와 클라우드 복원
  const importFriendsFromJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.friends && Array.isArray(parsed.friends)) {
          if (confirm(`백업 파일에서 친구 ${parsed.friends.length}명의 정보를 복원하시겠습니까?`)) {
            const impFriends: Friend[] = sanitizeFriendsList(parsed.friends);
            const impEvents: CalendarEvent[] = sanitizeEventsList(Array.isArray(parsed.events) ? parsed.events : events);
            setFriends(impFriends);
            setEvents(impEvents);
            await syncToFirestore(impFriends, impEvents, 'JSON 백업 파일 복원');
            alert('성공적으로 복원되었습니다!');
          }
        } else {
          alert('올바른 백업 파일(JSON) 형식이 아닙니다.');
        }
      } catch (err) {
        alert('파일을 불러오는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getFriend = (friendId?: string): Friend => {
    if (!friendId) return { id: 'unassigned', name: '참여자 미정', color: '#6366f1' };
    return friends.find((f) => f.id === friendId) || { id: 'unknown', name: '알 수 없음', color: '#94a3b8' };
  };

  // 이벤트의 참여 친구 ID 목록 반환 (단일 friendId와 복수 friendIds 완벽 하위 호환)
  const getEventFriendIds = (ev: CalendarEvent): string[] => {
    if (Array.isArray(ev.friendIds)) {
      return ev.friendIds;
    }
    return ev.friendId ? [ev.friendId] : [];
  };

  // 이벤트의 참여 Friend 객체 목록 반환
  const getEventFriends = (ev: CalendarEvent): Friend[] => {
    const ids = getEventFriendIds(ev);
    return ids.map((id) => getFriend(id)).filter((f) => f && f.id !== 'unknown' && f.id !== 'unassigned');
  };

  // 이벤트가 '약속'인지 확인하는 헬퍼 (인원이 참여해도 계속 약속 칸에 유지되며 해당 인원들에게도 부여됨)
  const isEventAppointment = (ev?: CalendarEvent | null): boolean => {
    if (!ev) return false;
    if (typeof ev.isAppointment === 'boolean') return ev.isAppointment;
    const ids = getEventFriendIds(ev);
    return ids.length === 0 && !ev.friendId;
  };

  // 이벤트 표시 정보 반환 (대표 색상, 라벨 문구 등)
  const getEventDisplayInfo = (ev: CalendarEvent) => {
    const pFriends = getEventFriends(ev);
    if (pFriends.length === 0) {
      return {
        name: '참여자 미정 (오픈 약속)',
        shortLabel: '오픈 약속',
        color: '#6366f1',
        isUnassigned: true,
        friends: [],
      };
    }
    const primaryFriend = pFriends[0];
    const nameLabel = pFriends.map((f) => f.name).join(', ');
    return {
      name: nameLabel,
      shortLabel: pFriends.length > 1 ? `${primaryFriend.name} 외 ${pFriends.length - 1}명` : primaryFriend.name,
      color: primaryFriend.color,
      isUnassigned: false,
      friends: pFriends,
    };
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(getFormattedDate(today));
  };

  // 특정 친구의 모든 일정 추출 및 정렬 (시작일 기준 오름차순)
  const getEventsForFriend = (friendId: string) => {
    return events
      .filter((ev) => {
        const pIds = getEventFriendIds(ev);
        return pIds.includes(friendId) || ev.friendId === friendId;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  };

  // 특정 친구의 일정 모달 열기 및 필터 적용
  const openFriendSchedule = (friend: Friend) => {
    setSelectedFriendForSchedule(friend);
    setActiveFilterFriendId(friend.id);
    setIsFriendScheduleModalOpen(true);
  };

  // 특정 날짜(연-월)로 캘린더 이동
  const jumpToDate = (dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        setCurrentDate(new Date(y, m - 1, 1));
        setSelectedDateStr(dateStr);
      }
    }
  };

  // 일정 상태 및 D-day 계산
  const getEventStatusBadge = (startDate: string, endDate?: string) => {
    const todayStr = getFormattedDate(new Date());
    const endStr = endDate || startDate;
    if (todayStr >= startDate && todayStr <= endStr) {
      return { label: '진행 중', color: 'bg-emerald-600 text-white animate-pulse' };
    }
    if (todayStr > endStr) {
      return { label: '종료됨', color: 'bg-slate-200 text-slate-600' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(startDate);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: `D-${diffDays}`, color: 'bg-indigo-600 text-white' };
  };

  // 다가오는 약속 위젯용 정밀 카운트다운 및 상태 계산
  const getEventCountdownDetail = (event: CalendarEvent) => {
    const now = new Date();
    const todayStr = getFormattedDate(now);
    const endStr = event.endDate || event.startDate;
    const isOngoing = todayStr >= event.startDate && todayStr <= endStr;

    // 1. 이미 종료된 과거 일정
    if (todayStr > endStr) {
      return {
        type: 'past',
        badge: '종료됨',
        badgeColor: 'bg-slate-100 text-slate-500 border border-slate-200',
        subText: '완료된 일정',
        isUrgent: false,
      };
    }

    // 2. 현재 진행 중인 다일정 (시작일이 오늘 이전이고 아직 종료일 이전)
    if (isOngoing && event.startDate !== todayStr) {
      const start = new Date(event.startDate);
      const diffTime = now.getTime() - start.getTime();
      const currentDayNum = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return {
        type: 'ongoing',
        badge: '진행 중',
        badgeColor: 'bg-emerald-600 text-white animate-pulse shadow-2xs',
        subText: `${currentDayNum}일차 진행 중`,
        isUrgent: true,
      };
    }

    // 3. 오늘 당일 (D-Day)
    if (event.startDate === todayStr) {
      let timeDetail = '오늘 일정';
      if (event.time) {
        const [h, m] = event.time.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
          const diffMinutes = Math.round((targetTime.getTime() - now.getTime()) / (1000 * 60));
          if (diffMinutes > 60) {
            const remH = Math.floor(diffMinutes / 60);
            const remM = diffMinutes % 60;
            timeDetail = remM > 0 ? `약 ${remH}시간 ${remM}분 후` : `약 ${remH}시간 후`;
          } else if (diffMinutes > 0) {
            timeDetail = `${diffMinutes}분 후 시작`;
          } else if (diffMinutes >= -180) {
            timeDetail = '지금 약속 진행 중';
          } else {
            timeDetail = '오늘 완료';
          }
        }
      }
      return {
        type: 'today',
        badge: 'D-Day 오늘',
        badgeColor: 'bg-rose-500 text-white font-extrabold animate-pulse shadow-xs',
        subText: timeDetail,
        isUrgent: true,
      };
    }

    // 4. 미래 다가오는 일정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(event.startDate);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return {
        type: 'tomorrow',
        badge: 'D-1 내일',
        badgeColor: 'bg-amber-500 text-white font-extrabold shadow-xs',
        subText: event.time ? `내일 ${event.time}` : '내일 예정',
        isUrgent: true,
      };
    }

    if (diffDays <= 7) {
      return {
        type: 'thisWeek',
        badge: `D-${diffDays}`,
        badgeColor: 'bg-indigo-600 text-white font-extrabold shadow-xs',
        subText: `${diffDays}일 남음`,
        isUrgent: false,
      };
    }

    return {
      type: 'upcoming',
      badge: `D-${diffDays}`,
      badgeColor: 'bg-slate-700 text-white font-semibold',
      subText: `${diffDays}일 남음`,
      isUrgent: false,
    };
  };

  // 다가오는 약속 위젯 접기/펼치기 토글
  const toggleCountdownCollapse = () => {
    setIsCountdownCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('flypromo_countdown_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // 다가오는 약속 목록 (오늘 진행 중이거나 앞으로 남은 일정, 시작일 빠른 순)
  const upcomingEvents = useMemo(() => {
    const todayStr = getFormattedDate(new Date());
    return events
      .filter((ev) => {
        const endStr = ev.endDate || ev.startDate;
        if (endStr < todayStr) return false; // 완전히 지난 과거 일정 제외

        // '약속' (참여자 미정 오픈 약속 및 인원이 참여한 약속 모두 약속 칸에 영구 유지)
        return isEventAppointment(ev);
      })
      .sort((a, b) => {
        if (a.startDate !== b.startDate) {
          return a.startDate.localeCompare(b.startDate);
        }
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [events]);

  
  // Open Event Modal
  const openAddEventModal = (defaultDate?: string, defaultFriendId?: string) => {
    const initialDate = defaultDate || getFormattedDate(new Date());
    setEditingEventId(null);
    setFormFriendIds(defaultFriendId ? [defaultFriendId] : []);
    setFormFriendId(defaultFriendId || '');
    setFormTitle('');
    setFormStartDate(initialDate);
    setFormEndDate(initialDate);
    setFormTime('');
    setFormLocation('');
    setFormMemo('');
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    const existingIds = getEventFriendIds(ev);
    setFormFriendIds(existingIds);
    setFormFriendId(existingIds[0] || '');
    setFormTitle(ev.title);
    setFormStartDate(ev.startDate);
    setFormEndDate(ev.endDate || ev.startDate);
    setFormTime(ev.time || '');
    setFormLocation(ev.location || '');
    setFormMemo(ev.memo || '');
    setIsEventModalOpen(true);
  };

  // 약속 참여하기 / 참여 취소 토글 (자기가 원하면 즉시 참여/제외 가능)
  const handleToggleEventParticipant = async (eventId: string, friendId: string) => {
    const targetEvent = events.find((e) => e.id === eventId);
    if (!targetEvent) return;

    const currentIds = getEventFriendIds(targetEvent);
    const isAlreadyParticipating = currentIds.includes(friendId);
    const newIds = isAlreadyParticipating
      ? currentIds.filter((id) => id !== friendId)
      : [...currentIds, friendId];

    const targetFriend = getFriend(friendId);
    const actionDesc = isAlreadyParticipating
      ? `'${targetFriend.name}'님이 약속에서 참여 취소`
      : `'${targetFriend.name}'님이 약속 참여 등록!`;

    // 원래 약속이었던 일정은 참여자가 추가/삭제되어도 isAppointment: true 영구 유지!
    const wasAppointment = isEventAppointment(targetEvent);

    const updatedEvents = events.map((ev) =>
      ev.id === eventId
        ? sanitizeEvent({
            ...ev,
            friendId: newIds[0] || '',
            friendIds: newIds,
            isAppointment: wasAppointment ? true : ev.isAppointment,
          })
        : sanitizeEvent(ev)
    );

    setEvents(updatedEvents);

    // 열려 있는 상세 모달 데이터도 실시간 동기화
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent(
        sanitizeEvent({
          ...selectedEvent,
          friendId: newIds[0] || '',
          friendIds: newIds,
          isAppointment: wasAppointment ? true : selectedEvent.isAppointment,
        })
      );
    }

    await syncToFirestore(friends, updatedEvents, actionDesc);
  };

  // Save Event (Add or Edit) -> Direct real-time sync (인원 없어도 등록 가능)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStartDate) {
      alert('일정 제목과 시작 날짜를 입력해주세요.');
      return;
    }

    // 종료일이 시작일보다 앞서면 시작일과 동일하게 자동 보정
    let validEndDate = formEndDate;
    if (!validEndDate || validEndDate < formStartDate) {
      validEndDate = formStartDate;
    }

    const primaryFriendId = formFriendIds[0] || '';

    let updatedEvents: CalendarEvent[];
    if (editingEventId) {
      const existing = events.find((e) => e.id === editingEventId);
      const wasApp = existing ? isEventAppointment(existing) : formFriendIds.length === 0;
      updatedEvents = events.map((ev) =>
        ev.id === editingEventId
          ? sanitizeEvent({
              ...ev,
              friendId: primaryFriendId,
              friendIds: formFriendIds,
              title: formTitle.trim(),
              startDate: formStartDate,
              endDate: validEndDate,
              time: formTime,
              location: formLocation,
              memo: formMemo,
              isAppointment: wasApp,
            })
          : sanitizeEvent(ev)
      );
    } else {
      const isApp = formFriendIds.length === 0;
      const newEv: CalendarEvent = sanitizeEvent({
        id: 'ev_' + Date.now(),
        friendId: primaryFriendId,
        friendIds: formFriendIds,
        title: formTitle.trim(),
        startDate: formStartDate,
        endDate: validEndDate,
        time: formTime,
        location: formLocation,
        memo: formMemo,
        isAppointment: isApp,
      });
      updatedEvents = [...events, newEv];
    }

    // Local optimistic update
    setEvents(updatedEvents);
    setIsEventModalOpen(false);

    const actionText =
      formFriendIds.length === 0
        ? `오픈 약속 등록 (${formTitle.trim()})`
        : `일정 등록 (${formTitle.trim()}, ${formFriendIds.length}명)`;

    // Push to Firestore (auto-reflected to all users)
    await syncToFirestore(friends, updatedEvents, actionText);
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

  // 친구 프로필 (생년월일 등) 폼 리셋
  const resetProfileForm = () => {
    setEditingFriendId(null);
    setProfileName('');
    setProfileBirthDate('');
    setProfileGender('');
    setProfileColor('#3b82f6');
  };

  // 친구 프로필 수정 모드로 폼에 채우기 및 상단으로 스크롤 이동
  const startEditProfile = (friend: Friend) => {
    setEditingFriendId(friend.id);
    setProfileName(friend.name);
    setProfileBirthDate(friend.birthDate || '');
    setProfileGender(friend.gender || '');
    setProfileColor(friend.color || '#3b82f6');
    setIsProfileFormOpen(true);
    // 수정 폼이 위치한 최상단으로 부드럽게 스크롤
    setTimeout(() => {
      profileModalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  // 친구 프로필 저장 (추가 또는 수정) -> Firestore 실시간 동기화
  const handleSaveFriendProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      alert('친구 이름을 입력해주세요.');
      return;
    }

    let updatedFriends: Friend[];
    if (editingFriendId) {
      updatedFriends = friends.map((f) =>
        f.id === editingFriendId
          ? {
              ...f,
              name: trimmedName,
              birthDate: profileBirthDate,
              gender: profileGender,
              color: profileColor,
            }
          : f
      );
    } else {
      const newFriend: Friend = {
        id: 'f_' + Date.now(),
        name: trimmedName,
        birthDate: profileBirthDate,
        gender: profileGender,
        color: profileColor,
      };
      updatedFriends = [...friends, newFriend];
    }

    setFriends(updatedFriends);
    resetProfileForm();
    setIsProfileFormOpen(false); // 저장 완료 후 폼 닫기
    await syncToFirestore(updatedFriends, events);
  };

  // 클립보드 복사 헬퍼
  const copyToClipboard = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setCopyToastMessage(`${label} 복사되었습니다!`);
      setTimeout(() => {
        setCopiedId(null);
        setCopyToastMessage(null);
      }, 2000);
    });
  };

  // 전체 친구 정보 한 번에 복사
  const copyAllFriendsInfo = () => {
    if (friends.length === 0) return;
    const lines = friends.map((f) => {
      const parts = [`${f.name}`];
      if (f.birthDate) {
        const age = calculateAge(f.birthDate);
        parts.push(`생년월일: ${f.birthDate}${age ? ` (${age})` : ''}`);
      }
      return parts.join(' / ');
    });
    copyToClipboard(lines.join('\n'), 'ALL', '전체 친구 정보가');
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

  // 주(Week) 단위로 7일씩 분할
  const weeks = useMemo(() => {
    const result: (typeof calendarDays)[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // 특정 날짜에 해당하는 이벤트 목록 필터링
  const getEventsForDate = (dateStr: string) => {
    return events.filter((ev) => {
      const evStart = ev.startDate;
      const evEnd = ev.endDate || ev.startDate;
      const isOverlapping = evStart <= dateStr && evEnd >= dateStr;
      if (!isOverlapping) return false;

      const evFriendIds = getEventFriendIds(ev);

      // 친구 필터
      if (activeFilterFriendId === 'UNASSIGNED') {
        if (!isEventAppointment(ev)) return false;
      } else if (activeFilterFriendId !== 'ALL') {
        if (!evFriendIds.includes(activeFilterFriendId) && ev.friendId !== activeFilterFriendId) {
          return false;
        }
      }

      // 검색어 필터
      if (searchKeyword) {
        const pFriends = getEventFriends(ev);
        const matchTitle = ev.title.toLowerCase().includes(searchKeyword.toLowerCase());
        const matchFriends = pFriends.some((f) => f.name.toLowerCase().includes(searchKeyword.toLowerCase()));
        const matchLoc = (ev.location || '').toLowerCase().includes(searchKeyword.toLowerCase());
        const matchMemo = (ev.memo || '').toLowerCase().includes(searchKeyword.toLowerCase());
        if (!matchTitle && !matchFriends && !matchLoc && !matchMemo) return false;
      }

      return true;
    });
  };

  // 모바일 선택 날짜의 이벤트 목록
  const selectedDateEvents = useMemo(() => {
    return getEventsForDate(selectedDateStr);
  }, [events, selectedDateStr, activeFilterFriendId, searchKeyword, friends]);

  // 선택된 날짜 헤딩 포맷 헬퍼 (예: "10월 24일 (토)")
  const formatSelectedDateHeading = (dateStr: string) => {
    if (!dateStr) return { title: '', isToday: false, holidayName: null, dayOfWeek: 0 };
    const parts = dateStr.split('-');
    if (parts.length < 3) return { title: dateStr, isToday: false, holidayName: null, dayOfWeek: 0 };
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[dateObj.getDay()];
    const todayStr = getFormattedDate(new Date());
    const isToday = dateStr === todayStr;
    const holidayName = getHolidayName(dateStr);

    return {
      title: `${m}월 ${d}일 (${dayName})`,
      isToday,
      holidayName,
      dayOfWeek: dateObj.getDay(),
    };
  };

  interface WeekEventSegment {
    event: CalendarEvent;
    friend: Friend;
    friends: Friend[];
    isUnassigned: boolean;
    isAppointment: boolean;
    displayTitle: string;
    startCol: number;      // 0 ~ 6
    endCol: number;        // 0 ~ 6
    span: number;          // 1 ~ 7
    isRealStart: boolean;  // 이번 주의 세그먼트 시작이 실제 이벤트 시작일인지
    isRealEnd: boolean;    // 이번 주의 세그먼트 끝이 실제 이벤트 종료일인지
    durationText: string;  // "3박 4일" 등
  }

  // N박 N일 배지용 텍스트
  const getNightsDaysBadge = (startStr: string, endStr: string) => {
    if (!startStr || !endStr || startStr === endStr) return '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 1) return '';
    const nights = diffDays - 1;
    return `${nights}박 ${diffDays}일`;
  };

  // 주(Week)에 속한 연속 일정들을 슬롯에 배치하여 반환하는 함수
  const getWeekSlots = (week: typeof calendarDays) => {
    const weekStartStr = week[0].dateStr;
    const weekEndStr = week[6].dateStr;

    // 이번 주와 날짜가 겹치는 이벤트 선별
    const matchingEvents = events.filter((ev) => {
      const evStart = ev.startDate;
      const evEnd = ev.endDate || ev.startDate;
      const isOverlapping = evStart <= weekEndStr && evEnd >= weekStartStr;
      if (!isOverlapping) return false;

      const evFriendIds = getEventFriendIds(ev);

      // 친구 필터
      if (activeFilterFriendId === 'UNASSIGNED') {
        // 인원이 참여했더라도 약속이면 약속만 모아보기에 계속 표시
        if (!isEventAppointment(ev)) return false;
      } else if (activeFilterFriendId !== 'ALL') {
        if (!evFriendIds.includes(activeFilterFriendId) && ev.friendId !== activeFilterFriendId) {
          return false;
        }
      }

      // 검색 필터
      if (searchKeyword) {
        const pFriends = getEventFriends(ev);
        const matchTitle = ev.title.toLowerCase().includes(searchKeyword.toLowerCase());
        const matchFriends = pFriends.some((f) => f.name.toLowerCase().includes(searchKeyword.toLowerCase()));
        const matchLoc = (ev.location || '').toLowerCase().includes(searchKeyword.toLowerCase());
        const matchMemo = (ev.memo || '').toLowerCase().includes(searchKeyword.toLowerCase());
        if (!matchTitle && !matchFriends && !matchLoc && !matchMemo) return false;
      }
      return true;
    });

    const segments: WeekEventSegment[] = matchingEvents.map((ev) => {
      const displayInfo = getEventDisplayInfo(ev);
      const friend: Friend = displayInfo.friends[0] || {
        id: 'unassigned',
        name: '약속',
        color: '#6366f1',
      };
      const evStart = ev.startDate;
      const evEnd = ev.endDate || ev.startDate;

      let startCol = 0;
      let isRealStart = true;
      if (evStart < weekStartStr) {
        startCol = 0;
        isRealStart = false;
      } else {
        const idx = week.findIndex((d) => d.dateStr === evStart);
        startCol = idx >= 0 ? idx : 0;
        isRealStart = true;
      }

      let endCol = 6;
      let isRealEnd = true;
      if (evEnd > weekEndStr) {
        endCol = 6;
        isRealEnd = false;
      } else {
        const idx = week.findIndex((d) => d.dateStr === evEnd);
        endCol = idx >= 0 ? idx : 6;
        isRealEnd = true;
      }

      const span = Math.max(1, endCol - startCol + 1);
      const durationText = getNightsDaysBadge(ev.startDate, ev.endDate || ev.startDate);

      return {
        event: ev,
        friend,
        friends: displayInfo.friends,
        isUnassigned: displayInfo.isUnassigned,
        isAppointment: isEventAppointment(ev),
        displayTitle: displayInfo.name,
        startCol,
        endCol,
        span,
        isRealStart,
        isRealEnd,
        durationText,
      };
    });

    // 시작일(startCol) 빠른 순 -> 기간(span) 긴 순 -> id 순 정렬
    segments.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      if (b.span !== a.span) return b.span - a.span;
      return a.event.id.localeCompare(b.event.id);
    });

    // 슬롯(행 레벨) 배정
    const slots: WeekEventSegment[][] = [];
    const occupied: boolean[][] = [];

    segments.forEach((seg) => {
      let slotIdx = 0;
      while (true) {
        if (!occupied[slotIdx]) {
          occupied[slotIdx] = [false, false, false, false, false, false, false];
          slots[slotIdx] = [];
        }

        let isAvailable = true;
        for (let c = seg.startCol; c <= seg.endCol; c++) {
          if (occupied[slotIdx][c]) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          for (let c = seg.startCol; c <= seg.endCol; c++) {
            occupied[slotIdx][c] = true;
          }
          slots[slotIdx].push(seg);
          break;
        }
        slotIdx++;
      }
    });

    return slots;
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 이전 로컬스토리지 백업 데이터 복원 배너 */}
      {localBackupData && (
        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                이전 브라우저에 저장된 친구 정보({localBackupData.friends.length}명)가 발견되었습니다!
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                [{localBackupData.friends.map((f) => f.name).join(', ')}] 정보를 지금 현재 캘린더로 복원할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={restoreLocalBackup}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              지금 복원하기
            </button>
            <button
              onClick={() => setLocalBackupData(null)}
              className="px-2.5 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 다가오는 약속 (D-Day 카운트다운) 위젯 */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/[0.08] shadow-xs overflow-hidden transition-all duration-200">
        {/* 위젯 헤더 */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                다가오는 약속
              </h3>
              <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full shrink-0">
                {upcomingEvents.length}건
              </span>
            </div>
          </div>

          {/* 헤더 우측: 다음 일정 간략 힌트 및 접기/펼치기 */}
          <div className="flex items-center gap-2 shrink-0">
            {upcomingEvents.length > 0 && isCountdownCollapsed && (
              <span
                onClick={() => {
                  jumpToDate(upcomingEvents[0].startDate);
                  setSelectedEvent(upcomingEvents[0]);
                  setIsViewModalOpen(true);
                }}
                className="text-[11px] text-indigo-700 font-bold bg-indigo-50 hover:bg-indigo-100 cursor-pointer px-2.5 py-1 rounded-lg border border-indigo-200/60 hidden md:inline-block truncate max-w-[280px] transition"
                title="약속 상세 보기"
              >
                다음: {upcomingEvents[0].title} ({getEventCountdownDetail(upcomingEvents[0]).badge})
              </span>
            )}
            <button
              type="button"
              onClick={toggleCountdownCollapse}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              title={isCountdownCollapsed ? '다가오는 약속 펼치기' : '다가오는 약속 접기'}
            >
              <span className="hidden sm:inline">{isCountdownCollapsed ? '펼치기' : '접기'}</span>
              {isCountdownCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* 위젯 본문: 카드 슬라이더 또는 빈 안내 */}
        {!isCountdownCollapsed && (
          <div className="p-3 sm:p-4">
            {upcomingEvents.length === 0 ? (
              <div className="py-5 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-1.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-700 mb-0.5">
                  {activeFilterFriendId === 'ALL'
                    ? '예정된 다가오는 약속이 없습니다.'
                    : '해당 조건의 다가오는 약속이 없습니다.'}
                </p>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  새 일정을 등록하여 다가오는 약속의 D-Day를 확인해 보세요!
                </p>
                <button
                  type="button"
                  onClick={() => openAddEventModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>새 일정 등록</span>
                </button>
              </div>
            ) : (
              <div
                className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar pb-1 pt-0.5"
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                {upcomingEvents.map((ev, idx) => {
                  const detail = getEventCountdownDetail(ev);
                  const evFriends = getEventFriends(ev);
                  const isFirst = idx === 0;

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        jumpToDate(ev.startDate);
                        setSelectedEvent(ev);
                        setIsViewModalOpen(true);
                      }}
                      className={`min-w-[240px] max-w-[320px] sm:min-w-[260px] sm:max-w-[350px] shrink-0 rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer flex flex-col justify-between group shadow-xs hover:shadow-md hover:-translate-y-0.5 bg-white dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.08] ${
                        isFirst
                          ? 'ring-1 ring-slate-900/15 dark:ring-white/20 border-slate-400 dark:border-white/20'
                          : 'hover:border-slate-400 dark:hover:border-white/20'
                      }`}
                    >
                      {/* 카드 상단: D-Day 뱃지 & 날짜 */}
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 shrink-0 ${detail.badgeColor}`}
                          >
                            {detail.badge}
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate text-right">
                            {formatShortDateWithDay(ev.startDate)}
                            {ev.endDate && ev.endDate !== ev.startDate
                              ? ` ~ ${formatShortDateWithDay(ev.endDate)}`
                              : ''}
                          </span>
                        </div>

                        {/* 카드 제목 */}
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1 mb-1.5">
                          {ev.title}
                        </h4>

                        {/* 시간 / 장소 / 메모 세부 정보 */}
                        {(ev.time || ev.location || ev.memo) ? (
                          <div className="space-y-1 text-[11px] text-slate-500 min-h-[18px]">
                            {ev.time && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded text-[10px]">
                                  {ev.time}
                                </span>
                                {ev.location && (
                                  <span className="truncate text-slate-600 dark:text-slate-400">· {ev.location}</span>
                                )}
                              </div>
                            )}
                            {!ev.time && ev.location && (
                              <div className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-400">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                            {!ev.time && !ev.location && ev.memo && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 truncate">
                                {ev.memo}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="min-h-[18px]" />
                        )}
                      </div>

                      {/* 카드 하단: 참여 친구 전원 목록 & 바로가기 화살표 */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {evFriends.length === 0 ? (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                              
                              <span>참여자 미정 (클릭하여 참여)</span>
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {evFriends.map((f) => (
                                <span
                                  key={f.id}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs whitespace-nowrap transition"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10"
                                    style={{ backgroundColor: f.color }}
                                  />
                                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{f.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <span
                          className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-600 text-slate-400 dark:text-slate-400 group-hover:text-white flex items-center justify-center transition shrink-0 self-center"
                          title="약속 상세 및 참여 관리"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar Grid Container (상단 컨트롤 바와 달력 그리드가 일체형으로 통합) */}
      <div id="calendar-container" className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/[0.08] shadow-xs overflow-hidden w-full min-w-0">
        {/* Calendar Integrated Header Bar */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex flex-col gap-3 bg-white/40 dark:bg-white/[0.01]">
          {/* Top Row: 인적사항, (안전 보관함) 및 새 일정 등록 버튼 (빨간 동그라미 위치) */}
          <div className="flex items-center justify-between gap-2 w-full">
            {/* 좌측: 인적사항 / 안전 보관함 */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* 친구 인적사항 관리 버튼 */}
              <button
                onClick={() => {
                  resetProfileForm();
                  setIsFriendProfileModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] rounded-full text-xs font-semibold transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer"
                title="친구 인적사항 및 생년월일 관리"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">친구 인적사항</span>
              </button>

              {/* 데이터 안전 보관함 및 복원 버튼 (관리자/본인 전용) */}
              {isAdmin && (
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] rounded-full text-xs font-semibold transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer"
                  title="친구 정보 백업 다운로드 및 과거 변경 이력 복원 (관리자 전용)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">안전 보관함 & 이력 복원</span>
                  {backupHistory.length > 0 && (
                    <span className="hidden sm:inline-block bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {backupHistory.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* 우측: 친구 관리 & 새 일정 등록 버튼 */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {isAdmin && (
                <button
                  onClick={() => setIsFriendModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold rounded-full shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
                  title="친구 목록 및 색상 관리"
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                  <span className="hidden sm:inline">친구 관리</span>
                  <span className="sm:hidden">친구 관리</span>
                </button>
              )}

              <button
                onClick={() => openAddEventModal()}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs sm:text-sm font-bold rounded-full shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>새 일정 등록</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: 달력 네비게이션(< 오늘 > & 2026년 10월) 및 검색창 (빨간 동그라미 위치 한 줄 통합) */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            {/* Navigation & Title (< 오늘 > 및 2026년 10월) */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink-0">
              <div className="flex items-center bg-slate-100/90 dark:bg-white/[0.05] border border-slate-200/50 dark:border-white/[0.06] rounded-full p-0.5 sm:p-1 shrink-0">
                <button
                  onClick={prevMonth}
                  className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="이전달"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={goToday}
                  className="px-2 sm:px-3 h-6 sm:h-8 text-[11px] sm:text-xs font-bold rounded-full hover:bg-white dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  오늘
                </button>
                <button
                  onClick={nextMonth}
                  className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="다음달"
                >
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
              <h2 className="text-xs sm:text-xl font-bold sm:font-black text-slate-900 dark:text-slate-50 tracking-tight whitespace-nowrap">
                {year}년 {month + 1}월
              </h2>
            </div>

            {/* 우측: 친구 필터 드롭다운 & 검색창 */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* 친구 필터 콤팩트 드롭다운 */}
              <div className="relative" ref={friendFilterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFriendFilterDropdownOpen((prev) => !prev)}
                  className={`h-6.5 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-full border transition-all flex items-center gap-1 sm:gap-1.5 shadow-2xs active:scale-95 cursor-pointer ${
                    activeFilterFriendId === 'ALL'
                      ? 'bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]'
                      : activeFilterFriendId === 'UNASSIGNED'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-bold'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-bold'
                  }`}
                  title="친구별 일정 필터링"
                >
                  {activeFilterFriendId === 'ALL' ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">친구 필터:</span>
                      <span>전체</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </>
                  ) : activeFilterFriendId === 'UNASSIGNED' ? (
                    <>
                      
                      <span>약속만</span>
                      <span className="text-[10px] px-1 rounded-full bg-indigo-200 text-indigo-900 font-extrabold">
                        {events.filter((e) => isEventAppointment(e)).length}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFilterFriendId('ALL');
                        }}
                        className="p-0.5 hover:bg-indigo-200 rounded text-indigo-700 ml-0.5"
                        title="전체 보기로 리셋"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </>
                  ) : (
                    (() => {
                      const curFriend = friends.find((f) => f.id === activeFilterFriendId);
                      return (
                        <>
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: curFriend?.color || '#3b82f6' }}
                          />
                          <span className="truncate max-w-[65px] sm:max-w-[80px]">
                            {curFriend?.name || '친구'}
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilterFriendId('ALL');
                            }}
                            className="p-0.5 hover:bg-slate-200 rounded text-slate-500 ml-0.5"
                            title="전체 보기로 리셋"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </>
                      );
                    })()
                  )}
                </button>

                {/* 드롭다운 메뉴 팝업 */}
                {isFriendFilterDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 sm:w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100 text-slate-900 dark:text-slate-100">
                    <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      일정 필터 선택
                    </div>

                    {/* 전체 보기 */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFilterFriendId('ALL');
                        setIsFriendFilterDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition cursor-pointer ${
                        activeFilterFriendId === 'ALL'
                          ? 'bg-slate-900 text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        <span>전체 일정 보기</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-bold">
                        {events.length}건
                      </span>
                    </button>

                    {/* 약속만 모아보기 */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFilterFriendId('UNASSIGNED');
                        setIsFriendFilterDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition mt-0.5 cursor-pointer ${
                        activeFilterFriendId === 'UNASSIGNED'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        
                        <span>약속만 모아보기</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          activeFilterFriendId === 'UNASSIGNED'
                            ? 'bg-indigo-700 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                        }`}
                      >
                        {events.filter((e) => isEventAppointment(e)).length}건
                      </span>
                    </button>

                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                    <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400">
                      친구별 일정 ({friends.length}명)
                    </div>

                    {/* 친구 목록 */}
                    <div className="max-h-48 overflow-y-auto space-y-0.5 no-scrollbar">
                      {friends.map((f) => {
                        const isSelected = activeFilterFriendId === f.id;
                        const fCount = getEventsForFriend(f.id).length;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setIsFriendFilterDropdownOpen(false);
                              openFriendSchedule(f);
                            }}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-xl flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold ring-1 ring-slate-300 dark:ring-slate-700'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: f.color }}
                              />
                              <span className="truncate">{f.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {fCount}건
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 검색창 */}
              <div className="relative w-20 sm:w-44 focus-within:w-28 sm:focus-within:w-48 transition-all duration-200 shrink-0">
                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="검색..."
                  className="w-full pl-6 sm:pl-8 pr-5 sm:pr-6 py-0.5 sm:py-1 bg-white/60 dark:bg-slate-950/50 border border-slate-200/80 dark:border-white/[0.08] rounded-full text-[11px] sm:text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword('')}
                    className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="검색어 지우기"
                  >
                    <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* DESKTOP CALENDAR VIEW (md:block)                          */}
        {/* ======================================================== */}
        <div className="hidden md:block">
          {/* Day of Week Header */}
        <div className="grid grid-cols-7 text-center text-xs font-bold py-2.5 sm:py-3 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/[0.06] text-slate-500 dark:text-slate-400">
          <div className="text-rose-500">일</div>
          <div>월</div>
          <div>화</div>
          <div>수</div>
          <div>목</div>
          <div>금</div>
          <div className="text-sky-600">토</div>
        </div>

        {/* Days Matrix (주 단위로 연속 막대 렌더링) */}
        <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
          {weeks.map((week, weekIdx) => {
            const slots = getWeekSlots(week);

            return (
              <div
                key={weekIdx}
                className="relative min-h-[115px] sm:min-h-[125px] flex flex-col"
              >
                {/* 1. 배경 날짜 셀 그리드 (7열) */}
                <div className="absolute inset-0 grid grid-cols-7 divide-x divide-slate-100 dark:divide-white/[0.05] pointer-events-none">
                  {week.map((cDay, colIdx) => {
                    const holidayName = getHolidayName(cDay.dateStr);
                    const isHoliday = !!holidayName;

                    let dayColorClass = 'text-slate-800 dark:text-slate-200';
                    if (cDay.isOtherMonth) {
                      dayColorClass = cDay.dayOfWeek === 0 || isHoliday ? 'text-rose-300 dark:text-rose-400/60' : 'text-slate-300 dark:text-slate-600';
                    } else if (cDay.dayOfWeek === 0 || isHoliday) {
                      dayColorClass = 'text-rose-500 font-bold';
                    } else if (cDay.dayOfWeek === 6) {
                      dayColorClass = 'text-sky-600';
                    }

                    return (
                      <div
                        key={colIdx}
                        onClick={() => openAddEventModal(cDay.dateStr)}
                        className={`h-full p-2 flex flex-col justify-between transition hover:bg-slate-50/70 dark:hover:bg-slate-800/70 cursor-pointer pointer-events-auto group ${
                          cDay.isOtherMonth
                            ? 'bg-slate-50/40 dark:bg-slate-950/60'
                            : isHoliday && cDay.dayOfWeek !== 0
                            ? 'bg-rose-50/30 dark:bg-rose-950/20'
                            : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        {/* 상단 날짜 숫자, 공휴일 이름 및 + 버튼 */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition ${
                                cDay.isToday
                                  ? isHoliday || cDay.dayOfWeek === 0
                                    ? 'bg-rose-500 text-white font-bold shadow-xs'
                                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold shadow-xs'
                                  : dayColorClass
                              }`}
                            >
                              {cDay.day}
                            </span>
                            {holidayName && (
                              <span
                                className={`text-[10px] sm:text-[11px] font-bold truncate max-w-[50px] sm:max-w-[75px] ${
                                  cDay.isOtherMonth ? 'text-rose-300' : 'text-rose-500'
                                }`}
                                title={holidayName}
                              >
                                {holidayName}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddEventModal(cDay.dateStr);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 text-xs transition p-0.5 rounded shrink-0"
                            title="일정 추가"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. 전면 이벤트 바 레이어 (연속 바 렌더링) */}
                <div className="relative pt-9 pb-2 px-1 pointer-events-none flex flex-col gap-1.5 z-10 flex-1">
                  {slots.map((slotEvents, slotIdx) => (
                    <div key={slotIdx} className="grid grid-cols-7 h-6 sm:h-7 items-center">
                      {slotEvents.map((seg) => {
                        const isMultiDay = seg.event.startDate !== (seg.event.endDate || seg.event.startDate);
                        const isAppointment = seg.isAppointment;
                        const isUnassigned = seg.isUnassigned;
                        const barColor = isAppointment ? '#6366f1' : (isUnassigned ? '#6366f1' : seg.friend.color);

                        return (
                          <div
                            key={seg.event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(seg.event);
                              setIsViewModalOpen(true);
                            }}
                            style={{
                              gridColumnStart: seg.startCol + 1,
                              gridColumnEnd: `span ${seg.span}`,
                              backgroundColor: isAppointment ? 'var(--appointment-bar-bg, rgba(99, 102, 241, 0.15))' : (isUnassigned ? 'var(--appointment-bar-bg, rgba(99, 102, 241, 0.15))' : `${barColor}22`),
                              borderColor: isAppointment ? '#818cf8' : (isUnassigned ? '#818cf8' : `${barColor}55`),
                            }}
                            title={`${seg.displayTitle} - ${seg.event.title} (${seg.event.startDate} ~ ${seg.event.endDate || seg.event.startDate}${seg.durationText ? ', ' + seg.durationText : ''})`}
                            className={`h-full my-0.5 border text-[11px] sm:text-xs font-medium cursor-pointer transition flex items-center gap-1.5 shadow-2xs pointer-events-auto hover:brightness-95 hover:shadow-xs overflow-hidden ${
                              seg.isRealStart ? 'ml-1 rounded-l-md' : 'ml-0 rounded-l-none border-l-0 pl-1'
                            } ${
                              seg.isRealEnd ? 'mr-1 rounded-r-md' : 'mr-0 rounded-r-none border-r-0 pr-1'
                            } px-2`}
                          >
                            {/* 이전 주에서 이어진 경우 화살표 */}
                            {!seg.isRealStart && (
                              <span className="text-[10px] text-slate-400 font-bold shrink-0">◀</span>
                            )}

                            {/* 약속인 경우와 친구 일정인 경우 구분 */}
                            {isAppointment ? (
                              <span className="text-[11px] shrink-0 font-bold text-indigo-600 flex items-center gap-0.5">
                                
                                <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold">약속</span>
                                {seg.friends.length > 0 && (
                                  <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-bold max-w-[120px] sm:max-w-[220px] truncate ml-0.5">
                                    ({seg.displayTitle}):
                                  </span>
                                )}
                              </span>
                            ) : isUnassigned ? (
                              <span className="text-[11px] shrink-0 font-bold text-indigo-600 flex items-center gap-0.5">
                                
                                <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold">약속</span>
                              </span>
                            ) : (
                              <>
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: barColor }}
                                />
                                <span
                                  className="font-bold shrink-0 text-slate-800 dark:text-slate-100 truncate max-w-[120px] sm:max-w-[200px]"
                                >
                                  {seg.displayTitle}:
                                </span>
                              </>
                            )}

                            {/* 일정 제목 */}
                            <span className="truncate text-slate-800 dark:text-slate-100 font-semibold flex-1">
                              {seg.event.title}
                            </span>

                            {/* N박 N일 배지 (다일정인 경우) */}
                            {isMultiDay && seg.durationText && (
                              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                {seg.durationText}
                              </span>
                            )}

                            {/* 다음 주로 이어지는 경우 화살표 */}
                            {!seg.isRealEnd && (
                              <span className="text-[10px] text-slate-400 font-bold shrink-0">▶</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* ======================================================== */}
        {/* MOBILE CALENDAR VIEW (block md:hidden)                   */}
        {/* Apple/Google Calendar Paradigm: Compact Month + Agenda   */}
        {/* ======================================================== */}
        <div className="block md:hidden">
          {/* 1. Compact Mini Month Grid */}
          <div className="p-3 bg-slate-50/40 dark:bg-slate-950/20 border-b border-slate-200/60 dark:border-white/[0.06]">
            {/* Day of week labels */}
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1">
              <div className="text-rose-500">일</div>
              <div>월</div>
              <div>화</div>
              <div>수</div>
              <div>목</div>
              <div>금</div>
              <div className="text-sky-600">토</div>
            </div>

            {/* Day numbers & micro-dots */}
            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((cDay, idx) => {
                const isSelected = cDay.dateStr === selectedDateStr;
                const holidayName = getHolidayName(cDay.dateStr);
                const isHoliday = !!holidayName;
                const dayEvents = getEventsForDate(cDay.dateStr);

                // Determine text color
                let textClass = 'text-slate-800 dark:text-slate-200';
                if (isSelected) {
                  textClass = 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold shadow-xs';
                } else if (cDay.isToday) {
                  textClass = 'border border-rose-500 text-rose-500 font-bold';
                } else if (cDay.isOtherMonth) {
                  textClass = cDay.dayOfWeek === 0 || isHoliday ? 'text-rose-300 dark:text-rose-900/60' : 'text-slate-300 dark:text-slate-700';
                } else if (cDay.dayOfWeek === 0 || isHoliday) {
                  textClass = 'text-rose-500 font-bold';
                } else if (cDay.dayOfWeek === 6) {
                  textClass = 'text-sky-600 font-semibold';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedDateStr(cDay.dateStr);
                      if (cDay.isOtherMonth) {
                        jumpToDate(cDay.dateStr);
                      }
                    }}
                    className={`flex flex-col items-center justify-start py-1 rounded-xl transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-white dark:bg-white/[0.08] shadow-2xs'
                        : 'hover:bg-white/60 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Day number pill */}
                    <span
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all ${textClass}`}
                    >
                      {cDay.day}
                    </span>

                    {/* Holiday micro text or micro dots */}
                    <div className="h-2.5 mt-0.5 flex items-center justify-center gap-0.5 overflow-hidden w-full px-0.5">
                      {isHoliday && !isSelected ? (
                        <span className="text-[9px] text-rose-500 font-bold truncate leading-none">
                          {holidayName}
                        </span>
                      ) : dayEvents.length > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {dayEvents.slice(0, 3).map((ev, dIdx) => {
                            const dInfo = getEventDisplayInfo(ev);
                            return (
                              <span
                                key={dIdx}
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: dInfo.color }}
                              />
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                          )}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Selected Date Agenda Stream */}
          <div className="p-3.5 sm:p-4 space-y-3">
            {/* Header of the selected date */}
            {(() => {
              const heading = formatSelectedDateHeading(selectedDateStr);
              return (
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {heading.title}
                      </h3>
                      {heading.isToday && (
                        <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full shrink-0">
                          오늘
                        </span>
                      )}
                      {heading.holidayName && (
                        <span className="text-[11px] text-rose-500 font-bold truncate">
                          {heading.holidayName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">
                      {selectedDateEvents.length}개
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openAddEventModal(selectedDateStr)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold rounded-full shadow-2xs transition active:scale-95 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>일정 추가</span>
                  </button>
                </div>
              );
            })()}

            {/* Events List */}
            {selectedDateEvents.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-dashed border-slate-200/80 dark:border-white/[0.08] flex flex-col items-center justify-center gap-2">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-400 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  등록된 일정이 없습니다.
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  새로운 여행이나 친구와의 약속을 등록해보세요.
                </p>
                <button
                  type="button"
                  onClick={() => openAddEventModal(selectedDateStr)}
                  className="mt-1 text-xs text-slate-900 dark:text-slate-100 font-bold underline hover:opacity-80 transition"
                >
                  + 이 날짜에 새 일정 등록
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedDateEvents.map((ev) => {
                  const dInfo = getEventDisplayInfo(ev);
                  const pFriends = getEventFriends(ev);
                  const isAppointment = isEventAppointment(ev);
                  const durationText = getNightsDaysBadge(ev.startDate, ev.endDate || ev.startDate);

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setSelectedEvent(ev);
                        setIsViewModalOpen(true);
                      }}
                      className="group relative p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-white/[0.08] shadow-2xs hover:shadow-sm active:scale-[0.99] transition cursor-pointer flex flex-col gap-2 overflow-hidden"
                    >
                      {/* Left Accent Color Indicator */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                        style={{ backgroundColor: dInfo.color }}
                      />

                      {/* Top row: Badges & Right arrow */}
                      <div className="flex items-center justify-between gap-2 min-w-0 pl-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {isAppointment ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                              약속
                            </span>
                          ) : (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: dInfo.color }}
                            >
                              {dInfo.shortLabel}
                            </span>
                          )}

                          {/* If multiple participants */}
                          {isAppointment && pFriends.length > 0 && (
                            <div className="flex items-center gap-1">
                              {pFriends.map((f) => (
                                <span
                                  key={f.id}
                                  className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: f.color }}
                                  />
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Multi-day badge */}
                          {durationText && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.06]">
                              {durationText}
                            </span>
                          )}
                        </div>

                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-400 group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900 flex items-center justify-center transition shrink-0">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 pl-1 leading-snug">
                        {ev.title}
                      </h4>

                      {/* Meta details (Time, Period, Location, Memo) */}
                      <div className="pl-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-3 flex-wrap">
                          {ev.time && (
                            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{ev.time}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-slate-400" />
                            <span>
                              {ev.startDate === ev.endDate || !ev.endDate
                                ? ev.startDate
                                : `${ev.startDate} ~ ${ev.endDate}`}
                            </span>
                          </div>
                        </div>

                        {ev.location && (
                          <div className="flex items-center gap-1 truncate text-slate-600 dark:text-slate-300">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{ev.location}</span>
                          </div>
                        )}

                        {ev.memo && (
                          <div className="flex items-start gap-1 text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 pt-0.5">
                            <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="truncate">{ev.memo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Modals --- */}

      {/* 1. Add / Edit Event Modal (기간: 몇일부터 몇일까지) */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{editingEventId ? '일정 수정' : '새 일정 / 약속 등록'}</h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    참여 인원 <span className="text-slate-400 font-normal">(선택 사항)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {friends.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (formFriendIds.length === friends.length) {
                            setFormFriendIds([]);
                          } else {
                            setFormFriendIds(friends.map((f) => f.id));
                          }
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition"
                      >
                        {formFriendIds.length === friends.length ? '모두 해제' : '전체 선택'}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsFriendModalOpen(true)}
                        className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition"
                      >
                        + 친구 관리
                      </button>
                    )}
                  </div>
                </div>

                {friends.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    <span>등록된 친구가 없습니다. 인원 없이 약속을 먼저 등록할 수 있습니다!</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {friends.map((f) => {
                        const isSelected = formFriendIds.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFormFriendIds(formFriendIds.filter((id) => id !== f.id));
                              } else {
                                setFormFriendIds([...formFriendIds, f.id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isSelected
                                ? 'bg-slate-800 text-white border border-slate-800 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span>{f.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      {formFriendIds.length === 0 ? (
                        <span className="text-indigo-600 font-semibold flex items-center gap-1">
                          
                          <span>참여 인원 없이 오픈 약속으로 등록됩니다 (등록 후 누구나 참가 가능)</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium">
                          총 <strong className="text-indigo-600 font-bold">{formFriendIds.length}명</strong>이 참여자로 등록됩니다.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 오사카 3박 4일 여행, 주말 힐링 캠핑"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* 기간 설정: 몇일부터 ~ 몇일까지 */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  일정 기간 (몇일부터 몇일까지) *
                </label>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block mb-1">시작일</span>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setFormStartDate(newStart);
                        // 시작일이 변경되었을 때 종료일이 더 이전이면 자동으로 맞춤
                        if (formEndDate < newStart) {
                          setFormEndDate(newStart);
                        }
                      }}
                      required
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block mb-1">종료일</span>
                    <input
                      type="date"
                      value={formEndDate}
                      min={formStartDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                {formStartDate && formEndDate && (
                  <div className="text-right text-[11px] font-bold text-indigo-600 pt-0.5">
                    {calculateDuration(formStartDate, formEndDate)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">장소</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="예: 일본 오사카/교토"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">메모</label>
                <textarea
                  rows={2}
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="항공권 예약번호, 챙길 것, 여행 코스 등"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {editingEventId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEventId)}
                    className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제</span>
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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

      {/* 2. Friend Management Modal (관리자 전용) */}
      {isAdmin && isFriendModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">친구 및 라벨 색상 관리</h3>
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
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="color"
                  value={newFriendColor}
                  onChange={(e) => setNewFriendColor(e.target.value)}
                  className="w-10 h-9 p-0.5 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer bg-white dark:bg-slate-900"
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
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800"
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
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.name}</span>
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
      {isViewModalOpen && selectedEvent && (() => {
        const pFriends = getEventFriends(selectedEvent);
        const pFriendIds = getEventFriendIds(selectedEvent);
        const isUnassigned = pFriends.length === 0;
        const displayInfo = getEventDisplayInfo(selectedEvent);
        // 아직 참여하지 않은 친구들
        const unjoinedFriends = friends.filter((f) => !pFriendIds.includes(f.id));

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100">
              <div
                className="h-3.5"
                style={{ backgroundColor: displayInfo.color }}
              />
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isEventAppointment(selectedEvent) ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 mb-1.5">
                        
                        <span>{isUnassigned ? '오픈 약속 (인원 모집 중)' : `약속 (${pFriends.length}명 참여 중)`}</span>
                      </span>
                    ) : isUnassigned ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 mb-1.5">
                        
                        <span>오픈 약속 (인원 모집 중)</span>
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span
                          className="inline-block text-xs px-2.5 py-0.5 rounded-full font-bold text-white shadow-2xs"
                          style={{ backgroundColor: displayInfo.color }}
                        >
                          {pFriends.length}명 참여 중
                        </span>
                      </div>
                    )}
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{selectedEvent.title}</h4>
                  </div>
                  <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Event Metadata (일정 기간, 장소, 메모) */}
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedEvent.startDate === selectedEvent.endDate
                          ? selectedEvent.startDate
                          : `${selectedEvent.startDate} ~ ${selectedEvent.endDate}`}
                      </span>
                      <span className="text-[11px] text-indigo-600 font-bold">
                        {calculateDuration(selectedEvent.startDate, selectedEvent.endDate)}
                      </span>
                    </div>
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.memo && (
                    <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedEvent.memo}</p>
                    </div>
                  )}
                </div>

                {/* 참여자 현황 & 약속 참여 관리 섹션 (약속 잡듯이 참여/등록) */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        약속 참여 현황 ({pFriends.length}명)
                      </span>
                    </div>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                      클릭하여 참여/취소
                    </span>
                  </div>

                  {/* 1. 현재 참여 중인 친구 목록 */}
                  {pFriends.length === 0 ? (
                    <div className="py-2.5 px-3 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-indigo-200 dark:border-indigo-900/50 text-center text-xs text-slate-500 dark:text-slate-400">
                      아직 참여 인원이 없습니다. 아래 버튼으로 바로 약속에 참여해보세요!
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {pFriends.map((f) => (
                        <div
                          key={f.id}
                          className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsViewModalOpen(false);
                              openFriendSchedule(f);
                            }}
                            className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title={`${f.name}의 전체 일정 확인하기`}
                          >
                            <span className="w-2 h-2 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: f.color }} />
                            <span className="text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 underline-offset-2 hover:underline font-bold">{f.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleEventParticipant(selectedEvent.id, f.id)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition p-0.5 ml-0.5"
                            title={`${f.name} 참여 취소`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 2. 약속 참여하기 / 인원 추가 버튼들 */}
                  <div>
                    <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      참여 인원 등록:
                    </span>
                    {unjoinedFriends.length === 0 && friends.length > 0 ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>등록된 모든 친구({friends.length}명)가 이 약속에 참여 중입니다!</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {unjoinedFriends.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleToggleEventParticipant(selectedEvent.id, f.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-slate-800 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-600 rounded-lg text-xs font-semibold transition group shadow-2xs active:scale-95"
                          >
                            <span className="w-1.5 h-1.5 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: f.color }} />
                            <span>+ {f.name} 참여</span>
                          </button>
                        ))}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsViewModalOpen(false);
                              setIsFriendModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition"
                          >
                            <span>+ 새 친구 등록</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold rounded-lg transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsViewModalOpen(false);
                        openEditEventModal(selectedEvent);
                      }}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => setIsViewModalOpen(false)}
                      className="px-4 py-1.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. Friend Profile Modal */}
      {isFriendProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden text-slate-900 dark:text-slate-100 my-auto animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    친구 인적사항 관리
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">인적사항</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    친구의 생년월일과 기본 인적사항을 관리합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFriendProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Bar & Toast */}
            <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">
                  총 <span className="font-bold text-indigo-600">{friends.length}명</span>의 친구가 등록되어 있습니다.
                </span>
                {copyToastMessage && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-in fade-in">
                    {copyToastMessage}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (isProfileFormOpen && !editingFriendId) {
                      setIsProfileFormOpen(false);
                    } else {
                      resetProfileForm();
                      setIsProfileFormOpen(true);
                      setTimeout(() => {
                        profileModalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }, 50);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95 ${
                    isProfileFormOpen && !editingFriendId
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isProfileFormOpen && !editingFriendId ? '등록창 닫기' : '새 친구 추가'}</span>
                </button>
                <button
                  type="button"
                  onClick={copyAllFriendsInfo}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
                  title="항공권 예매창에 붙여넣을 수 있도록 전체 친구 정보를 복사합니다"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">전체 정보 복사</span>
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={exportFriendsAsJsonFile}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
                      title="친구 전체 정보를 내 PC/스마트폰에 영구 보관용 JSON 파일로 다운로드합니다 (관리자 전용)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">백업 저장</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
                      title="다운로드해둔 백업 JSON 파일에서 친구 정보를 복원합니다 (관리자 전용)"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">파일 복원</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
                      title="과거 저장 시점 목록을 확인하고 원하는 시점으로 복원합니다 (관리자 전용)"
                    >
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>이력 ({backupHistory.length})</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div ref={profileModalBodyRef} className="p-6 overflow-y-auto space-y-6 flex-1 scroll-smooth">
              {/* Profile Edit / Add Form (수정 버튼이나 새 친구 추가 버튼을 누르면 최상단에 나타남!) */}
              {isProfileFormOpen && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm animate-in slide-in-from-top-3 fade-in duration-150">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>{editingFriendId ? `'${profileName}' 정보 수정` : '새 친구 정보 등록'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        resetProfileForm();
                        setIsProfileFormOpen(false);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 p-1 hover:bg-white/80 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-1"
                      title="닫기"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-[11px]">닫기</span>
                    </button>
                  </div>

                  <form onSubmit={handleSaveFriendProfile} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 한글 이름 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          한글 이름 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="예: 민수"
                          required
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      {/* 생년월일 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">생년월일</label>
                        <input
                          type="date"
                          value={profileBirthDate}
                          onChange={(e) => setProfileBirthDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      {/* 성별 & 라벨 색상 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">성별</label>
                          <select
                            value={profileGender}
                            onChange={(e) => setProfileGender(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                          >
                            <option value="">선택안함</option>
                            <option value="M">남성 (M)</option>
                            <option value="F">여성 (F)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">라벨 색상</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={profileColor}
                              onChange={(e) => setProfileColor(e.target.value)}
                              className="w-full h-9 p-0.5 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetProfileForm();
                          setIsProfileFormOpen(false);
                        }}
                        className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-white dark:hover:bg-slate-800 transition text-xs"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-sm transition text-xs flex items-center gap-1.5"
                      >
                        <span>{editingFriendId ? '수정 완료' : '친구 등록'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Friends List with Quick Copy */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  등록된 친구 정보 ({friends.length}명)
                </label>

                {friends.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    등록된 친구가 없습니다. 위 폼에서 친구를 추가해보세요!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {friends.map((f) => {
                      const ageText = calculateAge(f.birthDate);
                      const isEditing = editingFriendId === f.id;

                      return (
                        <div
                          key={f.id}
                          className={`p-3.5 bg-white dark:bg-slate-900 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isEditing
                              ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/20'
                              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          {/* Friend Info */}
                          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                            {/* Color Dot & Korean Name */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: f.color }}
                              />
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm min-w-[45px]">
                                {f.name}
                              </span>
                            </div>

                            {/* Info Badges */}
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              

                              {/* Birth Date Badge */}
                              {f.birthDate ? (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(f.birthDate!, `birth_${f.id}`, `${f.name}의 생년월일이`)}
                                  className="group flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition"
                                  title="클릭하여 생년월일 복사"
                                >
                                  <span>{f.birthDate}</span>
                                  {ageText && <span className="text-indigo-600 font-bold">({ageText})</span>}
                                  {copiedId === `birth_${f.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">생년월일 미입력</span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setIsFriendProfileModalOpen(false);
                                openFriendSchedule(f);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title={`${f.name}의 전체 일정 확인`}
                            >
                              <CalendarIcon className="w-3 h-3" />
                              <span>일정 ({getEventsForFriend(f.id).length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditProfile(f)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition"
                              title="정보 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFriend(f.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                입력하신 정보는 Firebase 클라우드에 안전하게 실시간 동기화됩니다.
              </span>
              <button
                type="button"
                onClick={() => setIsFriendProfileModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 변경 이력 및 데이터 안전 금고 모달 */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>데이터 안전 보관함 & 변경 이력 복원</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      3중 보호 활성
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    친구 정보가 브라우저 금고 및 클라우드에 실시간 보관되며 언제든 과거 시점으로 복원할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Status Box */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-emerald-950 dark:text-emerald-300 text-xs sm:text-sm">현재 데이터 보관 상태</span>
                  </div>
                  <span className="text-xs text-emerald-800 dark:text-emerald-400 font-semibold">
                    친구 {friends.length}명 / 일정 {events.length}개
                  </span>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                  친구 정보가 추가되거나 변경될 때마다 브라우저 로컬 안전 금고(LocalStorage)에 즉시 미러링되고, 클라우드(Firestore) 및 변경 이력 스냅샷에 3중으로 영구 보관됩니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={exportFriendsAsJsonFile}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>백업 파일(JSON) 다운로드</span>
                  </button>
                  <button
                    onClick={() => jsonFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>백업 파일에서 복원</span>
                  </button>
                </div>
              </div>

              {/* History Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>자동 저장된 변경 이력 스냅샷 ({backupHistory.length}/15)</span>
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 hidden sm:inline">클릭 시 해당 시점으로 원클릭 복원</span>
                    {backupHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllBackupHistory}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 transition"
                        title="과거 모든 변경 이력 스냅샷 영구 삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>이력 전체 비우기</span>
                      </button>
                    )}
                  </div>
                </div>

                {backupHistory.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs">
                    아직 저장된 변경 이력이 없습니다. 친구 정보를 수정하거나 일정을 등록하면 자동으로 시점별 백업이 생성됩니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backupHistory.map((snapshot, idx) => {
                      const timeStr = new Date(snapshot.savedAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const friendNames = snapshot.friends.map((f) => f.name).join(', ');

                      return (
                        <div
                          key={snapshot.savedAt + idx}
                          className="p-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{snapshot.summary}</span>
                              <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 font-semibold px-2 py-0.5 rounded-md">
                                친구 {snapshot.friends.length}명
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 truncate">
                              포함된 친구: <span className="font-medium text-slate-700 dark:text-slate-300">{friendNames || '(없음)'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              저장 일시: {timeStr}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreSnapshot(snapshot)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white dark:hover:text-white text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition shadow-2xs shrink-0 self-end sm:self-center"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>이 시점으로 복원</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                실수로 친구 정보를 지웠더라도 위 목록에서 언제든 이전 시점으로 되돌릴 수 있습니다.
              </span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 친구 전체 일정 및 여행 프로필 상세 모달 */}
      {isFriendScheduleModalOpen && selectedFriendForSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0"
                  style={{ backgroundColor: selectedFriendForSchedule.color }}
                >
                  {selectedFriendForSchedule.name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedFriendForSchedule.name}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                      개인별 일정 브리핑
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedFriendForSchedule.birthDate ? selectedFriendForSchedule.birthDate : '생년월일 미등록'}
                    {selectedFriendForSchedule.birthDate && calculateAge(selectedFriendForSchedule.birthDate) && ` (${calculateAge(selectedFriendForSchedule.birthDate)})`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFriendScheduleModalOpen(false);
                    startEditProfile(selectedFriendForSchedule);
                    setIsFriendProfileModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-xl transition flex items-center gap-1 shadow-2xs"
                  title="친구 정보 수정"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>정보 수정</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFriendScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">

              {/* Schedules Section Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {selectedFriendForSchedule.name} 님의 등록된 일정
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {getEventsForFriend(selectedFriendForSchedule.id).length}건
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFriendScheduleModalOpen(false);
                    openAddEventModal(undefined, selectedFriendForSchedule.id);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ 새 일정 등록</span>
                </button>
              </div>

              {/* Schedules List */}
              {(() => {
                const fEvents = getEventsForFriend(selectedFriendForSchedule.id);
                if (fEvents.length === 0) {
                  return (
                    <div className="py-12 px-4 text-center bg-slate-50/70 dark:bg-slate-950/80 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                        등록된 일정이 아직 없습니다
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                        {selectedFriendForSchedule.name} 님과 함께 갈 일본 여행이나 항공권 특가, 약속 일정을 지금 추가해보세요!
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFriendScheduleModalOpen(false);
                          openAddEventModal(undefined, selectedFriendForSchedule.id);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{selectedFriendForSchedule.name} 님의 새 일정 등록하기</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {fEvents.map((ev) => {
                      const status = getEventStatusBadge(ev.startDate, ev.endDate || ev.startDate);
                      const durationStr = calculateDuration(ev.startDate, ev.endDate || ev.startDate);
                      const otherFriends = getEventFriends(ev).filter((f) => f.id !== selectedFriendForSchedule.id);

                      return (
                        <div
                          key={ev.id}
                          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs transition space-y-3 group"
                        >
                          {/* Card Header: Dates & D-day */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {ev.startDate}
                                {ev.endDate && ev.endDate !== ev.startDate ? ` ~ ${ev.endDate}` : ''}
                              </span>
                              {durationStr && (
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                  {durationStr}
                                </span>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  jumpToDate(ev.startDate);
                                  setIsFriendScheduleModalOpen(false);
                                  const calElem = document.getElementById('calendar-container');
                                  if (calElem) calElem.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-transparent dark:border-slate-700"
                                title="캘린더 해당 일자로 이동"
                              >
                                <CalendarIcon className="w-3 h-3" />
                                <span>캘린더 보기</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFriendScheduleModalOpen(false);
                                  openEditEventModal(ev);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                title="일정 수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                            {ev.title}
                          </div>

                          {/* Details (Location, Time, Memo) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                            {ev.location && (
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                            {ev.time && (
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{ev.time}</span>
                              </div>
                            )}
                            {ev.memo && (
                              <div className="sm:col-span-2 flex items-start gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span className="whitespace-pre-wrap">{ev.memo}</span>
                              </div>
                            )}
                          </div>

                          {/* Other Participants */}
                          {otherFriends.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">함께하는 친구:</span>
                              {otherFriends.map((of) => (
                                <button
                                  key={of.id}
                                  type="button"
                                  onClick={() => openFriendSchedule(of)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: of.color }} />
                                  <span>{of.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveFilterFriendId('ALL');
                  setIsFriendScheduleModalOpen(false);
                }}
                className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                전체 친구 일정 보기 (필터 해제)
              </button>
              <button
                type="button"
                onClick={() => setIsFriendScheduleModalOpen(false)}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition shadow-2xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨겨진 JSON 백업 파일 업로드 input */}
      <input
        type="file"
        ref={jsonFileInputRef}
        onChange={importFriendsFromJsonFile}
        accept=".json"
        className="hidden"
      />
    </div>
  );
};

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
  CreditCard,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface Friend {
  id: string;
  name: string;
  color: string;
  bank?: string;           // 은행명 (예: 카카오뱅크, 신한, 토스 등)
  accountNumber?: string;  // 계좌번호 (예: 3333-01-xxxx)
  accountHolder?: string;  // 예금주 (예: 김민수)
  englishName?: string;    // 인적사항상 영문 이름 (예: KIM MINSU)
  birthDate?: string;      // 생년월일 (YYYY-MM-DD)
  gender?: 'M' | 'F' | ''; // 성별 (M: 남성, F: 여성)
  profileNumber?: string; // 인적사항번호 (선택)
  profileExpiry?: string; // 인적사항 만료일 (YYYY-MM-DD) (선택)
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
}

// 🛡️ 변경 이력 스냅샷 인터페이스 (절대 유실 방지용)
interface CalendarBackupSnapshot {
  savedAt: string; // ISO string
  summary: string;
  friends: Friend[];
  events: CalendarEvent[];
}

// 🚫 가상/예시 데이터 완전 배제 (Zero Fake Data 원칙)
// 기본 상태는 비어 있는 깨끗한 상태로 시작하여 가상 인물이 실제 입력을 오염시키지 않도록 보장합니다.
const DEFAULT_FRIENDS: Friend[] = [];
const INITIAL_EVENTS: CalendarEvent[] = [];

const getFormattedDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// 🇰🇷 대한민국 법정 공휴일 및 대체공휴일 매핑 데이터 (2024~2028년)
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
  
  // 🛡️ [영구 안전 금고] 로컬스토리지에 저장된 실제 친구 정보가 있으면 즉시 우선 복원!
  const [friends, setFriends] = useState<Friend[]>([]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeFilterFriendId, setActiveFilterFriendId] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [hasLoadedFromFirestore, setHasLoadedFromFirestore] = useState<boolean>(false);

  // 🛡️ 클라우드 변경 이력 스냅샷 목록 (원클릭 과거 복원용)
  const [backupHistory, setBackupHistory] = useState<CalendarBackupSnapshot[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // 🔐 관리자 모드 상태 (본인만 백업/복원 버튼을 볼 수 있도록 제어)
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFriendProfileModalOpen, setIsFriendProfileModalOpen] = useState(false);
  const [isFriendScheduleModalOpen, setIsFriendScheduleModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedFriendForSchedule, setSelectedFriendForSchedule] = useState<Friend | null>(null);

  // 친구 인적사항 및 생년월일 프로필 폼 상태
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [isProfileFormOpen, setIsProfileFormOpen] = useState(false); // 수정/등록 버튼 클릭 시 최상단에 표시
  const profileModalBodyRef = useRef<HTMLDivElement>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEnglishName, setProfileEnglishName] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profileGender, setProfileGender] = useState<'M' | 'F' | ''>('');
  const [profileprofileNumber, setProfileprofileNumber] = useState('');
  const [profileprofileExpiry, setProfileprofileExpiry] = useState('');
  const [profileBank, setProfileBank] = useState('');
  const [profileAccountNumber, setProfileAccountNumber] = useState('');
  const [profileAccountHolder, setProfileAccountHolder] = useState('');
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

  // Selected event for view modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // 💾 이전 브라우저 로컬스토리지 백업 데이터 자동 감지 상태
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

  // 🛡️ [영구 안전 금고] 브라우저 LocalStorage에 실시간 자동 미러링 백업 (클라우드 장애나 실수 대비)
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

  // 🔥 1. Firebase Firestore 실시간 동기화
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
              .filter((f: any) => !sampleNames.includes(f.name))
              .map((f: any) => ({
                id: f.id,
                name: f.name,
                color: f.color || '#3b82f6',
                bank: f.bank || '',
                accountNumber: f.accountNumber || '',
                accountHolder: f.accountHolder || '',
                englishName: f.englishName || '',
                birthDate: f.birthDate || '',
                gender: f.gender || '',
                profileNumber: f.profileNumber || '',
                profileExpiry: f.profileExpiry || '',
                memo: f.memo || '',
              }));
            setFriends(loadedFriends);
          }

          if (data.events && Array.isArray(data.events)) {
            // 과거 데이터(date 단일 필드) 호환성 보정 및 예시 일정 제거
            const sampleKeywords = ['민수', '지은', '태호', '수빈', '동현', '오사카 특가 여행 계획 회의', '후쿠오카 주말 특가', '도쿄 시부야 모임'];
            loadedEvents = data.events
              .filter((ev: any) => !sampleKeywords.some((k) => (ev.title || '').includes(k)))
              .map((ev: any) => ({
                id: ev.id,
                friendId: ev.friendId,
                title: ev.title,
                startDate: ev.startDate || ev.date || getFormattedDate(new Date()),
                endDate: ev.endDate || ev.startDate || ev.date || getFormattedDate(new Date()),
                time: ev.time || '',
                location: ev.location || '',
                memo: ev.memo || '',
              }));
            setEvents(loadedEvents);
          }

          // 🛡️ 백업 히스토리 로드
          if (data.backupHistory && Array.isArray(data.backupHistory)) {
            setBackupHistory(data.backupHistory);
          }

          // 🛡️ 불러온 실제 데이터를 즉시 브라우저 로컬 안전 금고에도 이중 보관!
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
    // 🛡️ 1단계: 브라우저 로컬 안전 금고에 즉시 0.001초 만에 1차 영구 보관!
    saveToLocalVault(newFriends, newEvents);

    if (!hasLoadedFromFirestore) {
      console.warn('초기 데이터 로딩 완료 전에 클라우드 덮어쓰기 방지 작동됨');
      return;
    }

    try {
      const docRef = doc(db, 'calendar_data', 'shared');

      // 🛡️ 2단계: 과거 15개 시점 변경 이력 자동 스냅샷 생성!
      const newSnapshot: CalendarBackupSnapshot = {
        savedAt: new Date().toISOString(),
        summary: `${actionNote} (친구 ${newFriends.length}명, 일정 ${newEvents.length}개)`,
        friends: newFriends,
        events: newEvents,
      };
      const updatedHistory = [newSnapshot, ...(backupHistory || []).slice(0, 14)];
      setBackupHistory(updatedHistory);

      // 🛡️ 3단계: 클라우드 Firestore 영구 저장
      await setDoc(docRef, {
        friends: newFriends,
        events: newEvents,
        backupHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to sync to Firestore:', err);
      alert('클라우드 저장 실패! 하지만 브라우저 영구 안전 금고에 안전하게 보관되었습니다.');
    }
  };

  // 🛡️ 과거 스냅샷 시점으로 즉시 되돌리기 (원클릭 롤백)
  const restoreSnapshot = async (snapshot: CalendarBackupSnapshot) => {
    const timeStr = new Date(snapshot.savedAt).toLocaleString();
    if (confirm(`'${timeStr}' 시점 (${snapshot.summary})으로 데이터를 복원하시겠습니까?`)) {
      setFriends(snapshot.friends);
      setEvents(snapshot.events);
      setIsHistoryModalOpen(false);
      await syncToFirestore(snapshot.friends, snapshot.events, `과거 시점 복원 (${timeStr})`);
      alert('성공적으로 이전 시점 데이터로 복원되었습니다!');
    }
  };

  // 📥 [파일 내보내기] 전체 친구 정보 백업 파일(JSON) 다운로드
  const exportFriendsAsJsonFile = () => {
    const backupData = {
      title: 'JapanFlight Friends Calendar Safe Backup',
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
    a.download = `친구인적사항_일정백업_${getFormattedDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('친구 정보 백업 파일이 다운로드되었습니다. 스마트폰이나 PC에 소장해두시면 언제든 복원할 수 있습니다!');
  };

  // 📤 [파일 불러오기] 백업 파일(JSON)에서 데이터 읽어와 클라우드 복원
  const importFriendsFromJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.friends && Array.isArray(parsed.friends)) {
          if (confirm(`백업 파일에서 친구 ${parsed.friends.length}명의 정보를 복원하시겠습니까?`)) {
            const impFriends: Friend[] = parsed.friends;
            const impEvents: CalendarEvent[] = Array.isArray(parsed.events) ? parsed.events : events;
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
    setCurrentDate(new Date());
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
      }
    }
  };

  // 일정 상태 및 D-day 계산
  const getEventStatusBadge = (startDate: string, endDate?: string) => {
    const todayStr = getFormattedDate(new Date());
    const endStr = endDate || startDate;
    if (todayStr >= startDate && todayStr <= endStr) {
      return { label: '🔥 진행 중', color: 'bg-emerald-600 text-white animate-pulse' };
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

  // 인적사항 만료일 계산
  const getprofileExpiryInfo = (expiryStr?: string) => {
    if (!expiryStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryStr);
    exp.setHours(0, 0, 0, 0);
    if (isNaN(exp.getTime())) return null;
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = diffDays <= 0;
    const isImminent = diffDays > 0 && diffDays <= 180;
    return {
      diffDays,
      isExpired,
      isImminent,
      yearsRemaining: (diffDays / 365).toFixed(1),
    };
  };

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

  // 🤝 약속 참여하기 / 참여 취소 토글 (자기가 원하면 즉시 참여/제외 가능)
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

    const updatedEvents = events.map((ev) =>
      ev.id === eventId
        ? {
            ...ev,
            friendId: newIds[0] || '',
            friendIds: newIds,
          }
        : ev
    );

    setEvents(updatedEvents);

    // 열려 있는 상세 모달 데이터도 실시간 동기화
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent({
        ...selectedEvent,
        friendId: newIds[0] || '',
        friendIds: newIds,
      });
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
      updatedEvents = events.map((ev) =>
        ev.id === editingEventId
          ? {
              ...ev,
              friendId: primaryFriendId,
              friendIds: formFriendIds,
              title: formTitle.trim(),
              startDate: formStartDate,
              endDate: validEndDate,
              time: formTime,
              location: formLocation,
              memo: formMemo,
            }
          : ev
      );
    } else {
      const newEv: CalendarEvent = {
        id: 'ev_' + Date.now(),
        friendId: primaryFriendId,
        friendIds: formFriendIds,
        title: formTitle.trim(),
        startDate: formStartDate,
        endDate: validEndDate,
        time: formTime,
        location: formLocation,
        memo: formMemo,
      };
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

  // 친구 프로필 (인적사항 영문명, 생년월일, 정산 계좌 등) 폼 리셋
  const resetProfileForm = () => {
    setEditingFriendId(null);
    setProfileName('');
    setProfileEnglishName('');
    setProfileBirthDate('');
    setProfileGender('');
    setProfileprofileNumber('');
    setProfileprofileExpiry('');
    setProfileBank('');
    setProfileAccountNumber('');
    setProfileAccountHolder('');
    setProfileColor('#3b82f6');
  };

  // 친구 프로필 수정 모드로 폼에 채우기 및 상단으로 스크롤 이동
  const startEditProfile = (friend: Friend) => {
    setEditingFriendId(friend.id);
    setProfileName(friend.name);
    setProfileEnglishName(friend.englishName || '');
    setProfileBirthDate(friend.birthDate || '');
    setProfileGender(friend.gender || '');
    setProfileprofileNumber(friend.profileNumber || '');
    setProfileprofileExpiry(friend.profileExpiry || '');
    setProfileBank(friend.bank || '');
    setProfileAccountNumber(friend.accountNumber || '');
    setProfileAccountHolder(friend.accountHolder || '');
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
              englishName: profileEnglishName.trim().toUpperCase(),
              birthDate: profileBirthDate,
              gender: profileGender,
              profileNumber: profileprofileNumber.trim().toUpperCase(),
              profileExpiry: profileprofileExpiry,
              bank: profileBank.trim(),
              accountNumber: profileAccountNumber.trim(),
              accountHolder: profileAccountHolder.trim(),
              color: profileColor,
            }
          : f
      );
    } else {
      const newFriend: Friend = {
        id: 'f_' + Date.now(),
        name: trimmedName,
        englishName: profileEnglishName.trim().toUpperCase(),
        birthDate: profileBirthDate,
        gender: profileGender,
        profileNumber: profileprofileNumber.trim().toUpperCase(),
        profileExpiry: profileprofileExpiry,
        bank: profileBank.trim(),
        accountNumber: profileAccountNumber.trim(),
        accountHolder: profileAccountHolder.trim(),
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
      if (f.englishName) parts.push(`인적사항명: ${f.englishName}`);
      if (f.birthDate) {
        const age = calculateAge(f.birthDate);
        parts.push(`생년월일: ${f.birthDate}${age ? ` (${age})` : ''}`);
      }
      if (f.profileNumber) parts.push(`인적사항번호: ${f.profileNumber}`);
      if (f.profileExpiry) parts.push(`인적사항만료: ${f.profileExpiry}`);
      if (f.accountNumber) parts.push(`계좌: ${f.bank ? f.bank + ' ' : ''}${f.accountNumber}${f.accountHolder ? ` (${f.accountHolder})` : ''}`);
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

  interface WeekEventSegment {
    event: CalendarEvent;
    friend: Friend;
    friends: Friend[];
    isUnassigned: boolean;
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
        if (evFriendIds.length > 0) return false;
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
      {/* 💾 이전 로컬스토리지 백업 데이터 복원 배너 */}
      {localBackupData && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
              💾
            </div>
            <div>
              <h4 className="font-bold text-amber-950 text-sm">
                이전 브라우저에 저장된 친구 정보({localBackupData.friends.length}명)가 발견되었습니다!
              </h4>
              <p className="text-xs text-amber-800">
                [{localBackupData.friends.map((f) => f.name).join(', ')}] 정보를 지금 현재 캘린더로 복원할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={restoreLocalBackup}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              지금 복원하기
            </button>
            <button
              onClick={() => setLocalBackupData(null)}
              className="px-2.5 py-2 text-amber-700 hover:text-amber-900 text-xs font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Friends Filter Chips (섹션 상단 배치) */}
      <div
        className="bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto no-scrollbar"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
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

        {/* 🤝 참여자 미정 (오픈 약속) 전용 필터 */}
        <button
          onClick={() => setActiveFilterFriendId(activeFilterFriendId === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')}
          className={`px-3 py-1 text-xs font-bold rounded-full transition shrink-0 flex items-center gap-1.5 ${
            activeFilterFriendId === 'UNASSIGNED'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80'
          }`}
        >
          <span>🤝</span>
          <span>약속</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              activeFilterFriendId === 'UNASSIGNED' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'
            }`}
          >
            {events.filter((e) => getEventFriendIds(e).length === 0).length}
          </span>
        </button>

        {friends.map((f) => {
          const isActive = activeFilterFriendId === f.id;
          const friendEventCount = getEventsForFriend(f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => {
                setActiveFilterFriendId(activeFilterFriendId === f.id ? 'ALL' : f.id);
              }}
              className="px-3 py-1 text-xs font-semibold rounded-full transition shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs hover:shadow-xs"
              style={{
                backgroundColor: isActive ? f.color : `${f.color}15`,
                color: isActive ? '#ffffff' : '#334155',
                border: `1px solid ${isActive ? f.color : `${f.color}40`}`,
              }}
              title={isActive ? `${f.name} 필터 해제 (전체 보기)` : `${f.name} 님의 일정만 보기`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: isActive ? '#ffffff' : f.color }}
              />
              <span>{f.name}</span>
              {friendEventCount > 0 ? (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActive ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                  }`}
                >
                  {friendEventCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    isActive ? 'text-white/80' : 'text-slate-400'
                  }`}
                >
                  0
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 👤 활성화된 친구 필터 및 일정 요약 배너 */}
      {activeFilterFriendId !== 'ALL' && (
        <div className="bg-white rounded-xl px-4 py-3 border border-indigo-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
          {activeFilterFriendId === 'UNASSIGNED' ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-200/60">
                  🤝
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">약속 (오픈 일정) 필터링</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] font-extrabold rounded-full">
                      총 {events.filter((e) => getEventFriendIds(e).length === 0).length}건
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    누구나 자유롭게 참여할 수 있는 열린 약속들입니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddEventModal()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>새 오픈 약속 등록</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterFriendId('ALL')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>전체 보기</span>
                </button>
              </div>
            </>
          ) : (
            (() => {
              const curFriend = friends.find((f) => f.id === activeFilterFriendId);
              if (!curFriend) return null;
              const fEvents = getEventsForFriend(curFriend.id);
              const todayStr = getFormattedDate(new Date());
              const nextUpcoming = fEvents.find((e) => (e.endDate || e.startDate) >= todayStr);

              return (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: curFriend.color }}
                    >
                      {curFriend.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{curFriend.name}</span>
                        {curFriend.englishName && (
                          <span className="text-xs font-mono font-medium text-slate-500">
                            ({curFriend.englishName})
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[11px] font-extrabold rounded-full ${
                            fEvents.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          등록된 일정 {fEvents.length}건
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        {nextUpcoming ? (
                          <>
                            <span className="font-semibold text-indigo-600">
                              다음 일정: {nextUpcoming.title}
                            </span>
                            <span>
                              ({nextUpcoming.startDate} ~ {nextUpcoming.endDate || nextUpcoming.startDate})
                            </span>
                          </>
                        ) : fEvents.length > 0 ? (
                          <span>과거 완료된 일정 {fEvents.length}건이 있습니다.</span>
                        ) : (
                          <span className="text-slate-400">등록된 일정이 없습니다. 새 일정을 추가해보세요!</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFriendForSchedule(curFriend);
                        setIsFriendScheduleModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-2xs active:scale-95"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>전체 일정 보기 ({fEvents.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddEventModal(undefined, curFriend.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-2xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ 일정 등록</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilterFriendId('ALL')}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition"
                      title="필터 해제 (전체 보기)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              );
            })()
          )}
        </div>
      )}

      {/* Calendar Grid Container (상단 컨트롤 바와 달력 그리드가 일체형으로 통합) */}
      <div id="calendar-container" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full min-w-0">
        {/* Calendar Integrated Header Bar */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 flex flex-col gap-3 bg-white">
          {/* Top Row: 보조 컨트롤 및 검색바 */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            {/* 친구 정보 / 안전 보관함 / 실시간 동기화 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 친구 인적사항 정보 / 생년월일 관리 버튼 */}
              <button
                onClick={() => {
                  resetProfileForm();
                  setIsFriendProfileModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                title="친구 영문 이름(인적사항명) 및 생년월일 관리"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">친구 인적사항</span>
                <span className="sm:hidden">인적사항</span>
              </button>

              {/* 💳 친구 정산 계좌 확인 및 원터치 복사 버튼 */}
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                title="친구 정산 계좌 원터치 복사 및 확인"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">친구 정산 계좌</span>
                <span className="sm:hidden">정산 계좌</span>
              </button>

              {/* 🛡️ 데이터 안전 보관함 및 복원 버튼 (관리자/본인 전용) */}
              {isAdmin && (
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                  title="친구 정보 백업 다운로드 및 과거 변경 이력 복원 (관리자 전용)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">안전 보관함 & 이력 복원</span>
                  <span className="sm:hidden">백업·복원</span>
                  {backupHistory.length > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {backupHistory.length}
                    </span>
                  )}
                </button>
              )}


            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-52">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="일정/장소 검색..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Bottom Row: 달력 네비게이션(< 오늘 > & 2026년 10월) 및 새 일정 등록 버튼 */}
          <div className="flex items-center justify-between gap-2 w-full pt-1 sm:pt-2 border-t border-slate-100">
            {/* Navigation & Title (< 오늘 > 및 2026년 10월) */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
                  title="이전달"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToday}
                  className="px-2.5 sm:px-3 h-8 text-xs font-semibold rounded-md hover:bg-white text-slate-700 transition"
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
              <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                {year}년 {month + 1}월
              </h2>
            </div>

            {/* Action Buttons: 새 일정 등록 & 친구 관리 */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Add Event Button */}
              <button
                onClick={() => openAddEventModal()}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>새 일정 등록</span>
              </button>

              {/* Manage Friends (관리자 전용) */}
              {isAdmin && (
                <button
                  onClick={() => setIsFriendModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition shrink-0"
                >
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">친구 관리</span>
                </button>
              )}
            </div>
          </div>
        </div>

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

        {/* Days Matrix (주 단위로 연속 막대 렌더링) */}
        <div className="divide-y divide-slate-100">
          {weeks.map((week, weekIdx) => {
            const slots = getWeekSlots(week);

            return (
              <div
                key={weekIdx}
                className="relative min-h-[115px] sm:min-h-[125px] flex flex-col"
              >
                {/* 1. 배경 날짜 셀 그리드 (7열) */}
                <div className="absolute inset-0 grid grid-cols-7 divide-x divide-slate-100 pointer-events-none">
                  {week.map((cDay, colIdx) => {
                    const holidayName = getHolidayName(cDay.dateStr);
                    const isHoliday = !!holidayName;

                    let dayColorClass = 'text-slate-800';
                    if (cDay.isOtherMonth) {
                      dayColorClass = cDay.dayOfWeek === 0 || isHoliday ? 'text-rose-300' : 'text-slate-300';
                    } else if (cDay.dayOfWeek === 0 || isHoliday) {
                      dayColorClass = 'text-rose-500 font-bold';
                    } else if (cDay.dayOfWeek === 6) {
                      dayColorClass = 'text-sky-600';
                    }

                    return (
                      <div
                        key={colIdx}
                        onClick={() => openAddEventModal(cDay.dateStr)}
                        className={`h-full p-2 flex flex-col justify-between transition hover:bg-slate-50/70 cursor-pointer pointer-events-auto group ${
                          cDay.isOtherMonth
                            ? 'bg-slate-50/40'
                            : isHoliday && cDay.dayOfWeek !== 0
                            ? 'bg-rose-50/30'
                            : 'bg-white'
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
                                    : 'bg-indigo-600 text-white font-bold shadow-xs'
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
                        const isUnassigned = seg.isUnassigned;
                        const barColor = isUnassigned ? '#6366f1' : seg.friend.color;

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
                              backgroundColor: isUnassigned ? '#eef2ff' : `${barColor}18`,
                              borderColor: isUnassigned ? '#818cf8' : `${barColor}55`,
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

                            {/* 인원 미정 약속인 경우와 친구 일정인 경우 구분 */}
                            {isUnassigned ? (
                              <span className="text-[11px] shrink-0 font-bold text-indigo-600 flex items-center gap-0.5">
                                <span>🤝</span>
                                <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700">약속</span>
                              </span>
                            ) : (
                              <>
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: barColor }}
                                />
                                <span
                                  className="font-bold shrink-0 text-slate-800 truncate max-w-[42px] sm:max-w-[120px]"
                                  style={{ color: barColor }}
                                >
                                  {seg.displayTitle}:
                                </span>
                              </>
                            )}

                            {/* 일정 제목 */}
                            <span className="truncate text-slate-800 font-semibold flex-1">
                              {seg.event.title}
                            </span>

                            {/* N박 N일 배지 (다일정인 경우) */}
                            {isMultiDay && seg.durationText && (
                              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/90 text-slate-700 border border-slate-200 shadow-2xs">
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

      {/* --- Modals --- */}

      {/* 1. Add / Edit Event Modal (기간: 몇일부터 몇일까지) */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingEventId ? '일정 수정' : '새 일정 / 약속 등록'}</h3>
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
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold transition"
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
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
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
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                          <span>🤝</span>
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 기간 설정: 몇일부터 ~ 몇일까지 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
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
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  placeholder="항공권 예약번호, 챙길 것, 여행 코스 등"
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

      {/* 2. Friend Management Modal (관리자 전용) */}
      {isAdmin && isFriendModalOpen && (
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
      {isViewModalOpen && selectedEvent && (() => {
        const pFriends = getEventFriends(selectedEvent);
        const pFriendIds = getEventFriendIds(selectedEvent);
        const isUnassigned = pFriends.length === 0;
        const displayInfo = getEventDisplayInfo(selectedEvent);
        // 아직 참여하지 않은 친구들
        const unjoinedFriends = friends.filter((f) => !pFriendIds.includes(f.id));

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div
                className="h-3.5"
                style={{ backgroundColor: displayInfo.color }}
              />
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isUnassigned ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 mb-1.5">
                        <span>🤝</span>
                        <span>오픈 약속 (인원 모집 중)</span>
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span
                          className="inline-block text-xs px-2.5 py-0.5 rounded-full font-bold text-white shadow-2xs"
                          style={{ backgroundColor: displayInfo.color }}
                        >
                          👥 {pFriends.length}명 참여 중
                        </span>
                      </div>
                    )}
                    <h4 className="text-base sm:text-lg font-bold text-slate-900">{selectedEvent.title}</h4>
                  </div>
                  <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Event Metadata (일정 기간, 장소, 메모) */}
                <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">
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

                {/* 🤝 참여자 현황 & 약속 참여 관리 섹션 (약속 잡듯이 참여/등록) */}
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800">
                        약속 참여 현황 ({pFriends.length}명)
                      </span>
                    </div>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      클릭하여 참여/취소
                    </span>
                  </div>

                  {/* 1. 현재 참여 중인 친구 목록 */}
                  {pFriends.length === 0 ? (
                    <div className="py-2.5 px-3 bg-white rounded-lg border border-dashed border-indigo-200 text-center text-xs text-slate-500">
                      아직 참여 인원이 없습니다. 아래 버튼으로 바로 약속에 참여해보세요!
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {pFriends.map((f) => (
                        <div
                          key={f.id}
                          className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsViewModalOpen(false);
                              openFriendSchedule(f);
                            }}
                            className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition"
                            title={`${f.name}의 전체 일정 확인하기`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                            <span className="text-slate-800 hover:text-indigo-600 underline-offset-2 hover:underline">{f.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleEventParticipant(selectedEvent.id, f.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-0.5 ml-0.5"
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
                    <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                      🙋‍♂️ 나/친구 참여 등록하기:
                    </span>
                    {unjoinedFriends.length === 0 && friends.length > 0 ? (
                      <div className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/60 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>등록된 모든 친구({friends.length}명)가 이 약속에 참여 중입니다!</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {unjoinedFriends.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleToggleEventParticipant(selectedEvent.id, f.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-indigo-200 rounded-lg text-xs font-semibold transition group shadow-2xs active:scale-95"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />
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
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition"
                          >
                            <span>+ 새 친구 등록</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg transition flex items-center gap-1"
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
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => setIsViewModalOpen(false)}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition"
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

      {/* 4. Friend Travel Profile (profile English Name & Birth Date) Modal */}
      {isFriendProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    친구 인적사항 & 인적사항 정보
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      항공권 예약용
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    인적사항상 영문 이름과 생년월일을 관리하고 한 번에 복사할 수 있습니다.
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
            <div className="px-6 py-2.5 bg-indigo-50/50 border-b border-indigo-100/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">
                  총 <span className="font-bold text-indigo-600">{friends.length}명</span>의 친구가 등록되어 있습니다.
                </span>
                {copyToastMessage && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-in fade-in">
                    ✓ {copyToastMessage}
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
                      title="친구 전체 정보를 내 PC/스마트폰에 영구 보관용 JSON 파일로 다운로드합니다 (관리자 전용)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">백업 저장</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
                      title="다운로드해둔 백업 JSON 파일에서 친구 정보를 복원합니다 (관리자 전용)"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">파일 복원</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition shadow-2xs active:scale-95"
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
                <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-sm animate-in slide-in-from-top-3 fade-in duration-150">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>{editingFriendId ? `✏️ '${profileName}' 정보 수정` : '➕ 새 친구 정보 등록'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        resetProfileForm();
                        setIsProfileFormOpen(false);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 p-1 hover:bg-white/80 rounded-lg transition flex items-center gap-1"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      {/* 인적사항 영문명 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>인적사항 영문명 (profile Name)</span>
                          <span className="text-[10px] text-indigo-600 font-normal">자동 대문자 변환</span>
                        </label>
                        <input
                          type="text"
                          value={profileEnglishName}
                          onChange={(e) => setProfileEnglishName(e.target.value.toUpperCase())}
                          placeholder="예: KIM MINSU"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                        />
                      </div>

                      {/* 생년월일 */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">생년월일</label>
                        <input
                          type="date"
                          value={profileBirthDate}
                          onChange={(e) => setProfileBirthDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                      {/* 성별 & 라벨 색상 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">성별</label>
                          <select
                            value={profileGender}
                            onChange={(e) => setProfileGender(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
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
                              className="w-full h-9 p-0.5 border border-slate-200 rounded-xl cursor-pointer bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 인적사항번호 & 인적사항 만료일 (선택) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:col-span-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>인적사항번호 (선택사항)</span>
                            <span className="text-[10px] text-slate-400">발권 시 빠른 복사 지원</span>
                          </label>
                          <input
                            type="text"
                            value={profileprofileNumber}
                            onChange={(e) => setProfileprofileNumber(e.target.value.toUpperCase())}
                            placeholder="예: M12345678"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>인적사항 만료일 (선택사항)</span>
                            <span className="text-[10px] text-indigo-600 font-normal">6개월 이상 유효 확인</span>
                          </label>
                          <input
                            type="date"
                            value={profileprofileExpiry}
                            onChange={(e) => setProfileprofileExpiry(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-xs"
                          />
                        </div>
                      </div>

                      {/* 정산 계좌 정보 (선택) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2 pt-2 border-t border-indigo-100">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>정산 은행명</span>
                            <span className="text-[10px] text-emerald-600 font-normal">송금용</span>
                          </label>
                          <input
                            type="text"
                            value={profileBank}
                            onChange={(e) => setProfileBank(e.target.value)}
                            placeholder="예: 카카오뱅크, 토스, 신한"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            계좌번호
                          </label>
                          <input
                            type="text"
                            value={profileAccountNumber}
                            onChange={(e) => setProfileAccountNumber(e.target.value)}
                            placeholder="예: 3333-01-1234567"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            예금주
                          </label>
                          <input
                            type="text"
                            value={profileAccountHolder}
                            onChange={(e) => setProfileAccountHolder(e.target.value)}
                            placeholder="예: 김민수"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-xs"
                          />
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
                        className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-white transition text-xs"
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
                          className={`p-3.5 bg-white rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
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
                              <span className="font-bold text-slate-900 text-sm min-w-[45px]">
                                {f.name}
                              </span>
                            </div>

                            {/* Info Badges */}
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              {/* English Name Badge */}
                              {f.englishName ? (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(f.englishName!, `eng_${f.id}`, `${f.name}의 인적사항 영문명이`)}
                                  className="group flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 rounded-lg text-xs font-mono font-bold transition"
                                  title="클릭하여 영문명 복사"
                                >
                                  <span>{f.englishName}</span>
                                  {copiedId === `eng_${f.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 transition" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">영문명 미입력</span>
                              )}

                              {/* Birth Date Badge */}
                              {f.birthDate ? (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(f.birthDate!, `birth_${f.id}`, `${f.name}의 생년월일이`)}
                                  className="group flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
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

                              {/* profile Number (if exists) */}
                              {f.profileNumber && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(f.profileNumber!, `pass_${f.id}`, `${f.name}의 인적사항번호가`)}
                                  className="group flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-xs font-mono font-semibold transition"
                                  title="클릭하여 인적사항번호 복사"
                                >
                                  <span>인적사항: {f.profileNumber}</span>
                                  {copiedId === `pass_${f.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-amber-500 group-hover:text-amber-700 transition" />
                                  )}
                                </button>
                              )}

                              {/* profile Expiry (if exists) */}
                              {f.profileExpiry && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(f.profileExpiry!, `pass_exp_${f.id}`, `${f.name}의 인적사항 만료일이`)}
                                  className="group flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 rounded-lg text-xs font-mono font-semibold transition"
                                  title="클릭하여 인적사항 만료일 복사"
                                >
                                  <span>만료: {f.profileExpiry}</span>
                                  {copiedId === `pass_exp_${f.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-rose-400 group-hover:text-rose-600 transition" />
                                  )}
                                </button>
                              )}

                              {/* Account Number (if exists) */}
                              {f.accountNumber && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      `${f.bank ? f.bank + ' ' : ''}${f.accountNumber}`,
                                      `acc_${f.id}`,
                                      `${f.name}의 계좌번호가`
                                    )
                                  }
                                  className="group flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-mono font-bold transition shadow-2xs"
                                  title="클릭하여 계좌번호 복사"
                                >
                                  <CreditCard className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>
                                    {f.bank ? `${f.bank} ` : ''}{f.accountNumber}
                                    {f.accountHolder ? ` (${f.accountHolder})` : ''}
                                  </span>
                                  {copiedId === `acc_${f.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-emerald-500 group-hover:text-emerald-700 transition shrink-0" />
                                  )}
                                </button>
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
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title={`${f.name}의 전체 일정 확인`}
                            >
                              <CalendarIcon className="w-3 h-3" />
                              <span>일정 ({getEventsForFriend(f.id).length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditProfile(f)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="정보 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFriend(f.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                입력하신 정보는 Firebase 클라우드에 안전하게 실시간 동기화됩니다.
              </span>
              <button
                type="button"
                onClick={() => setIsFriendProfileModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 친구 정산 계좌 모달 */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/80 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden relative my-auto animate-in zoom-in-95 duration-150">
            {/* Background decorative glows */}
            <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-1/3 -top-12 w-56 h-56 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 px-5 sm:px-6 py-4 sm:py-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/60 backdrop-blur-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                      💳 친구 정산 계좌 <span className="text-emerald-400 font-bold">원터치 복사</span>
                    </h3>
                    <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      토스·카카오뱅크 바로 송금
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                    카드를 터치하면 계좌번호가 즉시 복사되어 은행 앱에 바로 붙여넣기할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition shrink-0 ml-2"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subheader / Status Bar */}
            <div className="relative z-10 px-5 sm:px-6 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span>
                  등록된 친구: <strong className="text-white">{friends.length}명</strong>
                </span>
                {friends.filter((f) => f.accountNumber && f.accountNumber.trim() !== '').length > 0 && (
                  <span className="text-emerald-400 font-bold">
                    (계좌 등록 {friends.filter((f) => f.accountNumber && f.accountNumber.trim() !== '').length}명)
                  </span>
                )}
              </div>
              {copyToastMessage && (
                <span className="text-xs font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-500/50 px-2.5 py-0.5 rounded-full animate-in fade-in flex items-center gap-1 shadow-xs">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{copyToastMessage}</span>
                </span>
              )}
            </div>

            {/* Body Content */}
            <div className="relative z-10 p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {friends.length === 0 ? (
                <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-xs text-slate-400">
                  등록된 친구가 없습니다. 친구 인적사항 관리에서 친구를 추가해주세요.
                </div>
              ) : (
                <>
                  {/* 1. 계좌 등록된 친구들 */}
                  {friends.filter((f) => f.accountNumber && f.accountNumber.trim() !== '').length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-emerald-400 mb-2.5 flex items-center gap-1.5">
                        <span>계좌 등록 완료 ({friends.filter((f) => f.accountNumber && f.accountNumber.trim() !== '').length}명)</span>
                        <span className="text-[10px] text-slate-400 font-normal">카드 클릭 시 복사</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {friends
                          .filter((f) => f.accountNumber && f.accountNumber.trim() !== '')
                          .map((f) => {
                            const copyKey = `acc_modal_${f.id}`;
                            const isCopied = copiedId === copyKey;
                            const copyText = `${f.bank ? f.bank + ' ' : ''}${f.accountNumber}`;
                            return (
                              <div
                                key={f.id}
                                onClick={() => copyToClipboard(copyText, copyKey, `${f.name}의 계좌번호가`)}
                                role="button"
                                tabIndex={0}
                                className={`group p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                                  isCopied
                                    ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg scale-[1.01]'
                                    : 'bg-white/10 hover:bg-white/15 border-white/10 hover:border-white/25 active:scale-[0.98]'
                                }`}
                                title="클릭하여 계좌번호 복사"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-xs"
                                    style={{ backgroundColor: f.color }}
                                  >
                                    {f.name.slice(0, 1)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold text-sm text-white truncate">{f.name}</span>
                                      {f.bank && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/15 text-emerald-300 shrink-0">
                                          {f.bank}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs font-mono font-medium text-slate-200 tracking-tight truncate mt-0.5">
                                      {f.accountNumber}
                                      {f.accountHolder && (
                                        <span className="text-[11px] text-slate-400 ml-1 font-sans">
                                          ({f.accountHolder})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                                      isCopied
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-white/15 text-slate-200 group-hover:bg-white group-hover:text-slate-900'
                                    }`}
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>복사됨!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>복사</span>
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* 2. 계좌 미등록 친구들 */}
                  {friends.filter((f) => !f.accountNumber || f.accountNumber.trim() === '').length > 0 && (
                    <div className={friends.filter((f) => f.accountNumber && f.accountNumber.trim() !== '').length > 0 ? "pt-3 border-t border-white/10" : ""}>
                      <div className="text-xs font-bold text-slate-400 mb-2.5 flex items-center gap-1.5">
                        <span>계좌 미등록 친구 ({friends.filter((f) => !f.accountNumber || f.accountNumber.trim() === '').length}명)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {friends
                          .filter((f) => !f.accountNumber || f.accountNumber.trim() === '')
                          .map((f) => (
                            <div
                              key={f.id}
                              className="p-3 rounded-xl border border-dashed border-white/10 bg-white/5 flex items-center justify-between gap-2.5 text-xs text-slate-400"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] text-white shrink-0 opacity-70"
                                  style={{ backgroundColor: f.color }}
                                >
                                  {f.name.slice(0, 1)}
                                </div>
                                <div className="truncate">
                                  <span className="font-bold text-slate-300">{f.name}</span>
                                  <span className="text-[11px] text-slate-500 ml-1.5">계좌 미등록</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAccountModalOpen(false);
                                  resetProfileForm();
                                  startEditProfile(f);
                                  setIsFriendProfileModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition active:scale-95 shrink-0"
                              >
                                + 계좌 등록
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="relative z-10 px-5 sm:px-6 py-3.5 border-t border-white/10 bg-slate-950/70 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAccountModalOpen(false);
                  resetProfileForm();
                  setIsFriendProfileModalOpen(true);
                }}
                className="text-xs text-indigo-300 hover:text-indigo-200 font-medium underline underline-offset-4 flex items-center gap-1 transition"
              >
                <span>친구 인적사항 관리에서 계좌 수정하기 →</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ 변경 이력 및 데이터 안전 금고 모달 */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
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
                  <p className="text-xs text-slate-500">
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
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-emerald-950 text-xs sm:text-sm">현재 데이터 보관 상태</span>
                  </div>
                  <span className="text-xs text-emerald-800 font-semibold">
                    친구 {friends.length}명 / 일정 {events.length}개
                  </span>
                </div>
                <p className="text-xs text-emerald-900/80 leading-relaxed">
                  친구 정보가 추가되거나 변경될 때마다 브라우저 로컬 안전 금고(LocalStorage)에 즉시 미러링되고, 클라우드(Firestore) 및 변경 이력 스냅샷에 3중으로 영구 보관됩니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={exportFriendsAsJsonFile}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>📥 백업 파일(JSON) 내 PC/폰에 저장</span>
                  </button>
                  <button
                    onClick={() => jsonFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>📤 백업 파일에서 복원</span>
                  </button>
                </div>
              </div>

              {/* History Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>자동 저장된 변경 이력 스냅샷 ({backupHistory.length}/15)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">클릭 시 해당 시점으로 원클릭 복원</span>
                </div>

                {backupHistory.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
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
                          className="p-3.5 bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-200 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{snapshot.summary}</span>
                              <span className="text-[10px] text-indigo-700 bg-indigo-100 font-semibold px-2 py-0.5 rounded-md">
                                친구 {snapshot.friends.length}명
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 truncate">
                              포함된 친구: <span className="font-medium text-slate-700">{friendNames || '(없음)'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              저장 일시: {timeStr}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreSnapshot(snapshot)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition shadow-2xs shrink-0 self-end sm:self-center"
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
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                실수로 친구 정보를 지웠더라도 위 목록에서 언제든 이전 시점으로 되돌릴 수 있습니다.
              </span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 친구 전체 일정 및 여행 프로필 상세 모달 */}
      {isFriendScheduleModalOpen && selectedFriendForSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0"
                  style={{ backgroundColor: selectedFriendForSchedule.color }}
                >
                  {selectedFriendForSchedule.name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedFriendForSchedule.name}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      개인별 일정 브리핑
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedFriendForSchedule.englishName || '영문명 미등록'}
                    {selectedFriendForSchedule.birthDate && ` · ${selectedFriendForSchedule.birthDate}`}
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
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium rounded-xl transition flex items-center gap-1 shadow-2xs"
                  title="친구 정보 수정"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>정보 수정</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFriendScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* 💳 정산 계좌 카드 (상시 확인 및 복사) */}
              {selectedFriendForSchedule.accountNumber ? (
                <div className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-indigo-50/50 border border-emerald-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">정산 계좌</span>
                        {selectedFriendForSchedule.accountHolder && (
                          <span className="text-slate-600 font-medium">예금주: {selectedFriendForSchedule.accountHolder}</span>
                        )}
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tracking-tight truncate mt-0.5">
                        <span className="text-indigo-600 mr-1.5">{selectedFriendForSchedule.bank || '은행'}</span>
                        {selectedFriendForSchedule.accountNumber}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `${selectedFriendForSchedule.bank ? selectedFriendForSchedule.bank + ' ' : ''}${selectedFriendForSchedule.accountNumber}`,
                          `schedule_acc_${selectedFriendForSchedule.id}`,
                          `${selectedFriendForSchedule.name} 님의 계좌번호가`
                        )
                      }
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      {copiedId === `schedule_acc_${selectedFriendForSchedule.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>복사 완료!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>계좌번호 복사</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFriendScheduleModalOpen(false);
                        startEditProfile(selectedFriendForSchedule);
                        setIsFriendProfileModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition"
                      title="계좌 수정"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    <span>등록된 정산 계좌가 없습니다.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFriendScheduleModalOpen(false);
                      startEditProfile(selectedFriendForSchedule);
                      setIsFriendProfileModalOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
                  >
                    + 계좌 등록하기
                  </button>
                </div>
              )}

              {/* Schedules Section Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-800">
                    {selectedFriendForSchedule.name} 님의 등록된 일정
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100">
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
                    <div className="py-12 px-4 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h5 className="text-sm font-bold text-slate-800 mb-1">
                        등록된 일정이 아직 없습니다
                      </h5>
                      <p className="text-xs text-slate-500 max-w-sm mb-4">
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
                          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition space-y-3 group"
                        >
                          {/* Card Header: Dates & D-day */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {ev.startDate}
                                {ev.endDate && ev.endDate !== ev.startDate ? ` ~ ${ev.endDate}` : ''}
                              </span>
                              {durationStr && (
                                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
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
                                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition flex items-center gap-1"
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
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                title="일정 수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          <div className="text-sm sm:text-base font-bold text-slate-900">
                            {ev.title}
                          </div>

                          {/* Details (Location, Time, Memo) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                            {ev.location && (
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                            {ev.time && (
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{ev.time}</span>
                              </div>
                            )}
                            {ev.memo && (
                              <div className="sm:col-span-2 flex items-start gap-1.5 text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span className="whitespace-pre-wrap">{ev.memo}</span>
                              </div>
                            )}
                          </div>

                          {/* Other Participants */}
                          {otherFriends.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-400">함께하는 친구:</span>
                              {otherFriends.map((of) => (
                                <button
                                  key={of.id}
                                  type="button"
                                  onClick={() => openFriendSchedule(of)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700 transition"
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
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveFilterFriendId('ALL');
                  setIsFriendScheduleModalOpen(false);
                }}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
              >
                전체 친구 일정 보기 (필터 해제)
              </button>
              <button
                type="button"
                onClick={() => setIsFriendScheduleModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-2xs"
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

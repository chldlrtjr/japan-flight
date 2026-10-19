'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Copy, Check, Users, Sparkles, Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface Friend {
  id: string;
  name: string;
  color: string;
  bank?: string;
  accountNumber?: string;
  accountHolder?: string;
}

const SAMPLE_NAMES = ['민수', '지은', '태호', '수빈', '동현'];

export const FriendAccountBanner: React.FC = () => {
  // 🛡️ 영구 안전 금고에서 실제 친구 목록을 즉시 로드 (예시 데이터는 원천 차단)
  const [friends, setFriends] = useState<Friend[]>([]);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // 0. 구버전 로컬스토리지 예시 데이터(민수, 지은 등) 영구 삭제
    try {
      ['fc_friends', 'fc_events', 'flypromo_calendar_friends', 'flypromo_calendar_events'].forEach((key) => {
        const item = localStorage.getItem(key);
        if (item && SAMPLE_NAMES.some((name) => item.includes(name))) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    // 1. LocalStorage 안전 금고 재확인
    try {
      const cached = localStorage.getItem('flypromo_safe_friends_vault');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const realFriends = parsed.filter((f: any) => !SAMPLE_NAMES.includes(f.name));
          setFriends(realFriends);
          setHasLoaded(true);
        }
      }
    } catch (e) {
      console.error(e);
    }

    // 2. Firestore 실시간 구독
    const docRef = doc(db, 'calendar_data', 'shared');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      setHasLoaded(true);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.friends && Array.isArray(data.friends)) {
          const list: Friend[] = data.friends
            .filter((f: any) => !SAMPLE_NAMES.includes(f.name))
            .map((f: any) => ({
              id: f.id,
              name: f.name,
              color: f.color || '#3b82f6',
              bank: f.bank || '',
              accountNumber: f.accountNumber || '',
              accountHolder: f.accountHolder || '',
            }));
          setFriends(list);
          if (list.length > 0) {
            try {
              localStorage.setItem('flypromo_safe_friends_vault', JSON.stringify(list));
            } catch (e) {}
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const copyAccount = (friend: Friend) => {
    if (!friend.accountNumber) return;
    const textToCopy = `${friend.bank ? friend.bank + ' ' : ''}${friend.accountNumber}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(friend.id);
      setToastMessage(`${friend.name} 계좌 (${textToCopy}) 복사 완료!`);
      setTimeout(() => {
        setCopiedId(null);
        setToastMessage(null);
      }, 2500);
    });
  };

  const friendsWithAccount = friends.filter((f) => f.accountNumber && f.accountNumber.trim() !== '');
  const friendsWithoutAccount = friends.filter((f) => !f.accountNumber || f.accountNumber.trim() === '');

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl mb-6 relative overflow-hidden border border-slate-800">
      {/* Decorative Glow Background */}
      <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-1/3 -top-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                💳 친구 정산 계좌 <span className="text-emerald-400 font-bold">상시 확인</span>
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                원터치 복사 지원
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              카드를 터치하면 계좌번호가 즉시 복사되어 토스·카카오뱅크로 바로 송금할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Status / Toast */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {toastMessage ? (
            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1.5 rounded-xl animate-in fade-in duration-200 flex items-center gap-1.5 shadow-sm">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{toastMessage}</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              등록된 친구: <strong className="text-white">{friends.length}명</strong>
              {friendsWithAccount.length > 0 && (
                <span className="text-emerald-400 ml-1">
                  (계좌 등록 {friendsWithAccount.length}명)
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Friends Accounts Grid */}
      <div className="relative z-10 pt-4">
        {friends.length === 0 ? (
          !hasLoaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-white/5 rounded-xl border border-dashed border-white/10 text-xs text-slate-400">
              등록된 친구가 없습니다.
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {/* 1. 계좌 등록된 친구들 */}
            {friendsWithAccount.map((f) => {
              const isCopied = copiedId === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => copyAccount(f)}
                  role="button"
                  tabIndex={0}
                  className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                    isCopied
                      ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg'
                      : 'bg-white/10 hover:bg-white/15 border-white/10 hover:border-white/25 active:scale-[0.98]'
                  }`}
                  title="클릭하여 계좌번호 복사"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Friend Color Avatar */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
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

                  {/* Copy Button Icon */}
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

            {/* 2. 계좌 미등록 친구들 */}
            {friendsWithoutAccount.map((f) => (
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
                <span className="text-[10px] text-indigo-300/80 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">
                  아래 관리에서 등록
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

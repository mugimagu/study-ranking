import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { Trophy, User, Plus, BarChart3, Settings, AlertCircle, Clock, Users } from 'lucide-react';

// --- Firebase設定 (そのまま維持) ---
const firebaseConfig = {
  apiKey: "AIzaSyDfwDvMflHMAUsbl2EKLx84TwAw2JEoI98",
  authDomain: "study-ranking-20f4e.firebaseapp.com",
  databaseURL: "https://study-ranking-20f4e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "study-ranking-20f4e",
  storageBucket: "study-ranking-20f4e.firebasestorage.app",
  messagingSenderId: "759825441553",
  appId: "1:759825441553:web:bef97f3708ed03d70322b0",
  measurementId: "G-EH0RQL2K9L"
};

const appId = 'study-ranking';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SUBJECTS = [
  { id: 'math', name: '数学', icon: '📐' },
  { id: 'japanese', name: '国語', icon: '📝' },
  { id: 'english', name: '英語', icon: '🔤' },
  { id: 'science', name: '理科', icon: '🧪' },
  { id: 'social', name: '社会', icon: '🌍' },
  { id: 'other', name: 'その他', icon: '🎨' },
];

const ICONS = ['😊', '😎', '🤓', '🐱', '🐶', '🦊', '🚀', '🔥', '⭐️', '👾', '🐼', '🐯', '🦄', '🦁', '🦉', '⚽️', '🎮', '🍕', '🍦', '💎'];

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ranking'); 
  const [rankingPeriod, setRankingPeriod] = useState('total');
  const [selectedSubject, setSelectedSubject] = useState('total'); 
  
  // 入力用ステート
  const [inputHours, setInputHours] = useState('0');
  const [inputMinutes, setInputMinutes] = useState('');
  const [inputSubject, setInputSubject] = useState(SUBJECTS[0].id);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editTotalMins, setEditTotalMins] = useState(0); // 時間修正用
  
  const [graphMode, setGraphMode] = useState('personal'); // 'personal' or 'global'

  // 1. 匿名ログイン
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // 2. データ取得
  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setEditNickname(data.nickname);
        setEditAvatar(data.avatar);
        setEditTotalMins(data.totals?.total || 0);
      }
      setLoading(false);
    });

    const publicUsersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribeAll = onSnapshot(publicUsersRef, (querySnapshot) => {
      const users = [];
      querySnapshot.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
    });

    return () => { unsubscribeProfile(); unsubscribeAll(); };
  }, [user]);

  // プロフィール保存
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!editNickname || !user) return;

    const isFirstTime = !profile;
    const updatedData = {
      ...profile,
      nickname: editNickname,
      avatar: editAvatar || ICONS[0],
      lastUpdated: Date.now(),
      totals: profile?.totals || { total: 0, math: 0, japanese: 0, english: 0, science: 0, social: 0, other: 0 },
      studyLog: profile?.studyLog || []
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), updatedData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), updatedData);
      setIsEditing(false);
      if (isFirstTime) {
        alert("設定しました！\nうその時間を書かないで下さい。対応に時間がかかってしまいますのでご協力ください。");
      }
    } catch (error) { console.error(error); }
  };

  // 合計時間の直接編集
  const handleManualTimeEdit = async () => {
    if (!window.confirm("合計時間を変更しますか？（ログとの整合性は取れなくなります）")) return;
    const updatedTotals = { ...profile.totals, total: Number(editTotalMins) };
    const updatedData = { ...profile, totals: updatedTotals };
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), updatedData);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), updatedData);
    setIsEditing(false);
  };

  // 勉強時間の追加
  const handleAddStudy = async (e) => {
    e.preventDefault();
    const h = parseInt(inputHours) || 0;
    const m = parseInt(inputMinutes) || 0;

    if (!Number.isInteger(h) || !Number.isInteger(m)) {
      alert("整数で入力してください！");
      return;
    }
    if (h < 0 || h > 23 || m < 0 || m > 59 || (h === 0 && m === 0)) {
      alert("時間は0〜23、分は0〜59の間で入力してください。");
      return;
    }

    const mins = h * 60 + m;
    const timestamp = Date.now();
    const newLog = { subjectId: inputSubject, minutes: mins, timestamp };
    const newTotals = { ...(profile.totals || { total: 0, math: 0, japanese: 0, english: 0, science: 0, social: 0, other: 0 }) };
    newTotals.total += mins;
    newTotals[inputSubject] = (newTotals[inputSubject] || 0) + mins;

    const updatedData = {
      ...profile,
      studyLog: [...(profile.studyLog || []), newLog],
      totals: newTotals,
      lastUpdated: timestamp
    };

    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), updatedData);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), updatedData);
    setInputHours('0');
    setInputMinutes('');
  };

  // ランキング計算（表示制限適用）
  const filteredRankings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const periodThreshold = rankingPeriod === 'today' ? startOfToday : 0;

    const sorted = allUsers.map(u => {
      const logs = u.studyLog || [];
      const periodLogs = logs.filter(l => l.timestamp >= periodThreshold);
      const periodTotals = { total: 0, math: 0, japanese: 0, english: 0, science: 0, social: 0, other: 0 };
      periodLogs.forEach(l => {
        periodTotals.total += l.minutes;
        if (l.subjectId in periodTotals) periodTotals[l.subjectId] += l.minutes;
      });
      return { ...u, periodTotals };
    }).sort((a, b) => (b.periodTotals[selectedSubject] || 0) - (a.periodTotals[selectedSubject] || 0));

    const limit = selectedSubject === 'total' ? 5 : 3;
    return sorted.slice(0, limit).map((u, i) => ({ ...u, rank: i + 1 }));
  }, [allUsers, rankingPeriod, selectedSubject]);

  // 平均時間の計算
  const stats = useMemo(() => {
    const myTotal = profile?.totals?.total || 0;
    const globalTotal = allUsers.reduce((acc, u) => acc + (u.totals?.total || 0), 0);
    const globalAvg = allUsers.length > 0 ? Math.floor(globalTotal / allUsers.length) : 0;
    
    // グラフデータ (直近7日間)
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0,0,0,0);
      return d.getTime();
    });

    const getDayMins = (userList, timestamp) => {
      let total = 0;
      let count = 0;
      userList.forEach(u => {
        const dayLogs = (u.studyLog || []).filter(l => {
          const lDate = new Date(l.timestamp);
          lDate.setHours(0,0,0,0);
          return lDate.getTime() === timestamp;
        });
        const sum = dayLogs.reduce((s, l) => s + l.minutes, 0);
        if (sum > 0) {
          total += sum;
          count++;
        }
      });
      return { total, avg: count > 0 ? Math.floor(total / count) : 0 };
    };

    const graphData = last7Days.map(ts => {
      if (graphMode === 'personal') {
        return getDayMins([profile], ts).total;
      } else {
        return getDayMins(allUsers, ts).avg;
      }
    });

    return { myTotal, globalAvg, graphData };
  }, [profile, allUsers, graphMode]);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold">読み込み中...</div>;

  // 初期プロフィール設定
  if (!profile) {
    return (
      <div className="min-h-screen bg-indigo-600 p-4 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-xl text-center">
          <h1 className="text-2xl font-black mb-2">Study Ranking</h1>
          <p className="text-xs text-gray-400 mb-6 font-bold">なまえとアイコンをきめてね！</p>
          <form onSubmit={handleSaveProfile} className="space-y-4 text-left">
            <div>
              <input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} required className="w-full p-4 bg-gray-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-400" placeholder="なまえを入力" />
              <p className="text-[10px] text-red-500 mt-2 font-bold px-1 flex items-center gap-1">
                <AlertCircle size={10}/> 人が傷つくような名前はおやめください。
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2 h-32 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
              {ICONS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setEditAvatar(emoji)} className={`text-2xl p-2 rounded-lg transition-all ${editAvatar === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110' : 'hover:bg-gray-100'}`}>{emoji}</button>
              ))}
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">はじめる</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
      <header className="bg-white/80 backdrop-blur-md p-4 sticky top-0 z-10 shadow-sm flex items-center gap-3 border-b border-gray-100">
        <span className="text-3xl">{profile.avatar}</span>
        <h2 className="font-black text-lg flex-1 truncate">{profile.nickname}</h2>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {activeTab === 'ranking' ? (
          <>
            {/* 時間記録 */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-black flex items-center gap-2 text-indigo-600 text-sm"><Plus size={16}/> 今日の勉強を記録</h3>
              <div className="flex gap-2">
                <select value={inputSubject} onChange={(e) => setInputSubject(e.target.value)} className="flex-1 p-3 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-200 text-sm">
                  {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="23" value={inputHours} onChange={(e) => setInputHours(e.target.value)} className="w-14 p-3 bg-gray-50 rounded-xl font-black text-center ring-1 ring-gray-200" placeholder="0" />
                  <span className="text-[10px] font-bold">時</span>
                  <input type="number" min="0" max="59" value={inputMinutes} onChange={(e) => setInputMinutes(e.target.value)} className="w-16 p-3 bg-gray-50 rounded-xl font-black text-center ring-1 ring-gray-200" placeholder="分" />
                  <span className="text-[10px] font-bold">分</span>
                </div>
              </div>
              <button onClick={handleAddStudy} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">記録を追加する</button>
            </section>

            {/* 平均・統計セクション */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><User size={10}/> 自分の平均</p>
                <p className="text-lg font-black text-indigo-600">{Math.floor(stats.myTotal / Math.max(1, (profile.studyLog?.length || 1)))}<span className="text-xs ml-0.5">分/回</span></p>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><Users size={10}/> 全体の平均</p>
                <p className="text-lg font-black text-emerald-600">{stats.globalAvg}<span className="text-xs ml-0.5">分/人</span></p>
              </div>
            </section>

            {/* 週間グラフ */}
            <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase flex items-center gap-2"><BarChart3 size={14}/> 週間トレンド</h3>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setGraphMode('personal')} className={`px-2 py-1 text-[9px] font-bold rounded ${graphMode === 'personal' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>個人</button>
                  <button onClick={() => setGraphMode('global')} className={`px-2 py-1 text-[9px] font-bold rounded ${graphMode === 'global' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>全体(平均)</button>
                </div>
              </div>
              <div className="flex items-end justify-between h-24 px-2 gap-1">
                {stats.graphData.map((val, i) => {
                  const max = Math.max(...stats.graphData, 1);
                  const height = (val / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-indigo-100 rounded-t-md relative group" style={{ height: `${height}%` }}>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] py-1 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{val}分</div>
                        <div className={`absolute inset-0 ${graphMode === 'personal' ? 'bg-indigo-500' : 'bg-emerald-500'} rounded-t-md opacity-80`}></div>
                      </div>
                      <span className="text-[8px] font-bold text-gray-300">Day {i+1}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ランキング */}
            <section className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <p className="font-black text-lg">ランキング <span className="text-xs text-gray-400 font-bold ml-2">({selectedSubject === 'total' ? 'TOP 5' : 'TOP 3'})</span></p>
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                  <select value={rankingPeriod} onChange={(e) => setRankingPeriod(e.target.value)} className="text-[10px] font-black bg-transparent text-indigo-600 outline-none px-2">
                    <option value="total">全期間</option>
                    <option value="today">今日</option>
                  </select>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="text-[10px] font-black bg-transparent text-indigo-600 outline-none px-2">
                    <option value="total">全教科</option>
                    {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {filteredRankings.map((u) => (
                  <div key={u.id} className={`flex items-center p-4 rounded-2xl transition-all ${u.id === user.uid ? 'bg-indigo-600 text-white shadow-xl scale-[1.02] z-10 relative' : 'bg-white shadow-sm border border-gray-100'}`}>
                    <div className={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-full ${u.rank === 1 ? 'bg-yellow-400 text-white' : u.rank === 2 ? 'bg-gray-300 text-white' : u.rank === 3 ? 'bg-orange-300 text-white' : 'text-gray-400'}`}>{u.rank}</div>
                    <div className="text-2xl mx-3">{u.avatar}</div>
                    <div className="flex-1 font-black truncate">{u.nickname}</div>
                    <div className="text-right font-black text-sm">{Math.floor(u.periodTotals[selectedSubject]/60)}h {u.periodTotals[selectedSubject]%60}m</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* マイページ */
          <section className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
              <div className="text-7xl mb-4">{profile.avatar}</div>
              <h2 className="text-2xl font-black mb-1">{profile.nickname}</h2>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Total Study</p>
                  <p className="text-xl font-black text-indigo-700">{Math.floor(profile.totals.total/60)}<span className="text-xs">h</span> {profile.totals.total%60}<span className="text-xs">m</span></p>
                </div>
                <button onClick={() => setIsEditing(true)} className="bg-gray-50 p-5 rounded-3xl border border-gray-100 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 transition-colors">
                  <Settings size={18} className="text-gray-400"/>
                  <span className="text-[10px] font-black text-gray-500 uppercase">Edit Profile</span>
                </button>
              </div>
            </div>

            {/* 教科別統計 */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><BarChart3 size={14}/> Subject Stats</h3>
              <div className="space-y-3">
                {SUBJECTS.map(s => {
                  const mins = profile.totals[s.id] || 0;
                  const percent = profile.totals.total > 0 ? (mins / profile.totals.total) * 100 : 0;
                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-black">
                        <span>{s.icon} {s.name}</span>
                        <span>{Math.floor(mins/60)}h {mins%60}m</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* フッターナビ */}
      <nav className="fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-xl px-2 py-2 rounded-[32px] shadow-2xl flex items-center border border-white/50 z-20">
        <button onClick={() => setActiveTab('ranking')} className={`flex-1 py-4 rounded-[24px] flex flex-col items-center gap-1 transition-all ${activeTab === 'ranking' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300'}`}>
          <Trophy size={20} /><span className="text-[8px] font-black uppercase">Ranking</span>
        </button>
        <button onClick={() => setActiveTab('mypage')} className={`flex-1 py-4 rounded-[24px] flex flex-col items-center gap-1 transition-all ${activeTab === 'mypage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300'}`}>
          <User size={20} /><span className="text-[8px] font-black uppercase">My Page</span>
        </button>
      </nav>

      {/* 編集モーダル */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-[40px] w-full max-w-sm shadow-2xl my-auto">
            <h3 className="font-black text-xl mb-6 flex items-center gap-2"><Settings size={20}/> プロフィール編集</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nickname</label>
                <input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-400 outline-none" />
                <p className="text-[9px] text-red-400 font-bold px-1">※人が傷つく名前はおやめください</p>
              </div>
              
              {/* 時間編集機能 */}
              <div className="space-y-2 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <label className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-1"><Clock size={10}/> 合計時間を修正 (分単位)</label>
                <div className="flex gap-2">
                  <input type="number" value={editTotalMins} onChange={(e) => setEditTotalMins(e.target.value)} className="flex-1 p-3 bg-white rounded-xl font-black ring-1 ring-indigo-200 outline-none" />
                  <button onClick={handleManualTimeEdit} className="px-4 bg-indigo-500 text-white rounded-xl text-xs font-black">修正</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Avatar</label>
                <div className="grid grid-cols-5 gap-2 h-32 overflow-y-auto p-2 bg-gray-50 rounded-2xl ring-1 ring-gray-200">
                  {ICONS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => setEditAvatar(emoji)} className={`text-2xl p-2 rounded-xl transition-all ${editAvatar === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110' : 'hover:bg-gray-100'}`}>{emoji}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-4 text-gray-400 font-black text-sm">キャンセル</button>
                <button onClick={handleSaveProfile} className="flex-2 px-8 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

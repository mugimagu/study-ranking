import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { Trophy, BookOpen, User, Plus, X, Users, BarChart3, Copy, Settings } from 'lucide-react';

/**
 * 【重要】Firebaseから取得した自分の設定に書き換えてください
 * Firebase Console > プロジェクトの設定 > マイアプリ > Webアプリの設定 で確認できます
 */
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


// アプリの識別ID
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
  const [inputMinutes, setInputMinutes] = useState('');
  const [inputSubject, setInputSubject] = useState(SUBJECTS[0].id);
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  // 1. 匿名ログインの実行
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (auth) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. データの取得
  useEffect(() => {
    if (!user) return;
    
    // 自分のプロフィール
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setEditNickname(data.nickname);
        setEditAvatar(data.avatar);
      }
      setLoading(false);
    }, (err) => {
      console.error("Profile fetch error:", err);
      setLoading(false);
    });

    // 全ユーザーのデータ（ランキング用）
    const publicUsersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribeAll = onSnapshot(publicUsersRef, (querySnapshot) => {
      const users = [];
      querySnapshot.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
    }, (err) => console.error("Global fetch error:", err));

    return () => {
      unsubscribeProfile();
      unsubscribeAll();
    };
  }, [user]);

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!editNickname || !user) return;

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
      if (!profile) setProfile(updatedData);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleAddStudy = async (e) => {
    e.preventDefault();
    const mins = parseInt(inputMinutes);
    if (isNaN(mins) || mins <= 0 || !user) return;

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

    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), updatedData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), updatedData);
      setInputMinutes('');
    } catch (error) {
      console.error("Log error:", error);
    }
  };

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

    return sorted.map((u, i) => ({ ...u, rank: i + 1 }));
  }, [allUsers, rankingPeriod, selectedSubject]);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold">読み込み中...</div>;

  if (!profile) {
    return (
      <div className="min-h-screen bg-indigo-600 p-4 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-xl text-center">
          <h1 className="text-2xl font-black mb-6">Study Ranking</h1>
          <p className="text-sm text-gray-500 mb-4 font-bold">最初になまえとアイコンをきめてね！</p>
          <form onSubmit={handleSaveProfile} className="space-y-4 text-left">
            <input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} required className="w-full p-4 bg-gray-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-400" placeholder="なまえを入力" />
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
        <span className="text-3xl drop-shadow-sm">{profile.avatar}</span>
        <h2 className="font-black text-lg flex-1 truncate">{profile.nickname}</h2>
        <div className="bg-indigo-50 px-3 py-1.5 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-wider border border-indigo-100">
          Rank: {filteredRankings.find(u => u.id === user.uid)?.rank || '-'}
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {activeTab === 'ranking' ? (
          <>
            {/* 時間記録セクション */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-black flex items-center gap-2 text-indigo-600"><Plus size={18}/> 勉強時間を記録</h3>
              <div className="flex gap-2">
                <select value={inputSubject} onChange={(e) => setInputSubject(e.target.value)} className="flex-1 p-3 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-indigo-400">
                  {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
                <div className="relative">
                  <input type="number" value={inputMinutes} onChange={(e) => setInputMinutes(e.target.value)} className="w-24 p-3 bg-gray-50 rounded-xl font-black border-none ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="分" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">min</span>
                </div>
              </div>
              <button onClick={handleAddStudy} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">記録を追加する</button>
            </section>

            {/* ランキングセクション */}
            <section className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <div>
                  <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-1 flex items-center gap-2">Study Ranking</h3>
                  <p className="font-black text-xl">みんなの記録</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                  <select value={rankingPeriod} onChange={(e) => setRankingPeriod(e.target.value)} className="text-[10px] font-black bg-transparent text-indigo-600 outline-none px-2 cursor-pointer">
                    <option value="total">全期間</option>
                    <option value="today">今日</option>
                  </select>
                  <div className="w-[1px] h-3 bg-gray-200 my-auto"></div>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="text-[10px] font-black bg-transparent text-indigo-600 outline-none px-2 cursor-pointer">
                    <option value="total">全教科</option>
                    {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {filteredRankings.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 font-bold">まだデータがありません</div>
                ) : (
                  filteredRankings.map((u) => (
                    <div key={u.id} className={`flex items-center p-4 rounded-2xl transition-all ${u.id === user.uid ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-[1.02] z-10 relative' : 'bg-white shadow-sm border border-gray-100'}`}>
                      <div className={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-full ${u.rank === 1 ? 'bg-yellow-400 text-white' : u.rank === 2 ? 'bg-gray-300 text-white' : u.rank === 3 ? 'bg-orange-300 text-white' : 'text-gray-400'}`}>
                        {u.rank}
                      </div>
                      <div className="text-2xl mx-3 drop-shadow-sm">{u.avatar}</div>
                      <div className="flex-1 font-black truncate mr-2">{u.nickname}</div>
                      <div className="text-right">
                        <div className="font-black text-sm">{Math.floor(u.periodTotals[selectedSubject]/60)}h {u.periodTotals[selectedSubject]%60}m</div>
                        <div className={`text-[9px] font-bold ${u.id === user.uid ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {u.studyLog?.length || 0} sessions
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="space-y-4 animate-in fade-in duration-300">
            {/* マイページカード */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
              <div className="text-7xl mb-4 drop-shadow-md">{profile.avatar}</div>
              <h2 className="text-2xl font-black mb-1">{profile.nickname}</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Personal Statistics</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
                  <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Total Study</p>
                  <p className="text-xl font-black text-indigo-700">{Math.floor(profile.totals.total/60)}<span className="text-xs ml-0.5">h</span> {profile.totals.total%60}<span className="text-xs ml-0.5">m</span></p>
                </div>
                <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100">
                  <p className="text-[9px] font-black text-orange-400 uppercase mb-1">Sessions</p>
                  <p className="text-xl font-black text-orange-700">{profile.studyLog?.length || 0}<span className="text-xs ml-0.5">回</span></p>
                </div>
              </div>

              <div className="mt-8 space-y-2">
                <button onClick={() => setIsEditing(true)} className="w-full py-3 rounded-xl bg-gray-50 text-gray-500 font-black text-xs flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
                  <Settings size={14}/> プロフィールを編集
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
        <button onClick={() => setActiveTab('ranking')} className={`flex-1 py-4 rounded-[24px] flex flex-col items-center gap-1 transition-all ${activeTab === 'ranking' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-300 hover:text-gray-400'}`}>
          <Trophy size={20} />
          <span className="text-[8px] font-black uppercase">Ranking</span>
        </button>
        <button onClick={() => setActiveTab('mypage')} className={`flex-1 py-4 rounded-[24px] flex flex-col items-center gap-1 transition-all ${activeTab === 'mypage' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-300 hover:text-gray-400'}`}>
          <User size={20} />
          <span className="text-[8px] font-black uppercase">My Page</span>
        </button>
      </nav>

      {/* 編集モーダル */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[40px] w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-black text-xl mb-6 flex items-center gap-2"><Settings size={20}/> プロフィール編集</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nickname</label>
                <input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-black border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Avatar</label>
                <div className="grid grid-cols-5 gap-2 h-32 overflow-y-auto p-2 bg-gray-50 rounded-2xl ring-1 ring-gray-200">
                  {ICONS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => setEditAvatar(emoji)} className={`text-2xl p-2 rounded-xl transition-all ${editAvatar === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110' : 'hover:bg-gray-200'}`}>{emoji}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-4 text-gray-400 font-black text-sm">キャンセル</button>
                <button onClick={handleSaveProfile} className="flex-2 px-8 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
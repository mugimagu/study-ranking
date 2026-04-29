import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { Trophy, Clock, User, PieChart, Zap, ChevronRight, Trash2, Edit3, X, Star, Users } from 'lucide-react';

// --- Firebase Configuration ---
// ★重要：Webに公開する際は、ここを自分のFirebase設定に書き換えてください
// Firebaseコンソール > プロジェクト設定 > 全般 > マイアプリ の下の方にあります
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

// プレビュー環境用のフォールバック（自分のサイトでは不要ですが、エラー防止のため残します）
const finalConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : firebaseConfig;

const app = initializeApp(finalConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ★重要：ここも自分の好きなID（例: 'my-study-app'）に書き換えてください
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-unique-study-app-id';

const SUBJECTS = [
  { id: 'math', name: '数学', color: '#60A5FA', bg: 'bg-blue-400', text: 'text-blue-400', icon: '📐' },
  { id: 'japanese', name: '国語', color: '#F472B6', bg: 'bg-pink-400', text: 'text-pink-400', icon: '📝' },
  { id: 'english', name: '英語', color: '#818CF8', bg: 'bg-indigo-400', text: 'text-indigo-400', icon: '🔤' },
  { id: 'science', name: '理科', color: '#34D399', bg: 'bg-emerald-400', text: 'text-emerald-400', icon: '🧪' },
  { id: 'social', name: '社会', color: '#FB923C', bg: 'bg-orange-400', text: 'text-orange-400', icon: '🌍' },
  { id: 'other', name: 'その他', color: '#94A3B8', bg: 'bg-slate-400', text: 'text-slate-400', icon: '🎨' },
];

const ICONS = ['⚡️', '✨', '☁️', '🍬', '🎀', '🧸', '🐱', '🌙', '🍦', '💎', '🎨', '🌸', '🌈', '🐣', '🍓'];

// 可愛いキラキラ雷背景コンポーネント
const CuteLightningBackground = () => {
  const [sparks, setSparks] = useState([]);

  useEffect(() => {
    const createSpark = () => {
      const id = Math.random();
      const newSpark = {
        id,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 20 + 10
      };
      setSparks(prev => [...prev, newSpark]);
      setTimeout(() => {
        setSparks(prev => prev.filter(s => s.id !== id));
      }, 1000);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.5) createSpark();
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-blue-50">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 via-white to-blue-50" />
      {sparks.map(s => (
        <div 
          key={s.id}
          className="absolute animate-ping text-yellow-300 opacity-60"
          style={{ left: `${s.left}%`, top: `${s.top}%` }}
        >
          <Zap size={s.size} fill="currentColor" />
        </div>
      ))}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#60A5FA 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ranking'); 
  
  const [inputHours, setInputHours] = useState('0');
  const [inputMinutes, setInputMinutes] = useState('0');
  const [inputSubject, setInputSubject] = useState(SUBJECTS[0].id);
  
  const [editingLogId, setEditingLogId] = useState(null);
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');

  const [alertConfig, setAlertConfig] = useState({ open: false, message: '' });
  const [showSetup, setShowSetup] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatar, setEditAvatar] = useState(ICONS[0]);
  const [hasAgreed, setHasAgreed] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
        setShowSetup(false);
      } else {
        setShowSetup(true);
      }
      setLoading(false);
    }, (err) => console.error(err));

    const publicUsersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribeAll = onSnapshot(publicUsersRef, (querySnapshot) => {
      const users = [];
      querySnapshot.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
    }, (err) => console.error(err));

    return () => {
      unsubscribeProfile();
      unsubscribeAll();
    };
  }, [user]);

  const calculateTotals = (logs = []) => {
    const t = { total: 0, math: 0, japanese: 0, english: 0, science: 0, social: 0, other: 0 };
    logs.forEach(l => {
      const mins = parseInt(l.minutes) || 0;
      t.total += mins;
      if (l.subjectId in t) t[l.subjectId] += mins;
    });
    return t;
  };

  // 今日の統計データを計算
  const statsData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // 自分の今日の合計
    const myTodayLogs = (profile?.studyLog || []).filter(l => l.timestamp >= startOfToday);
    const myTodayMins = myTodayLogs.reduce((acc, curr) => acc + (parseInt(curr.minutes) || 0), 0);

    // 全ユーザーの今日の合計から平均を算出
    let totalMinsAllUsers = 0;
    let activeUsersCount = 0;

    allUsers.forEach(u => {
      const userTodayLogs = (u.studyLog || []).filter(l => l.timestamp >= startOfToday);
      const userTodayMins = userTodayLogs.reduce((acc, curr) => acc + (parseInt(curr.minutes) || 0), 0);
      if (userTodayMins > 0) {
        totalMinsAllUsers += userTodayMins;
        activeUsersCount++;
      }
    });

    const averageMins = activeUsersCount > 0 ? Math.floor(totalMinsAllUsers / activeUsersCount) : 0;

    return {
      myToday: myTodayMins,
      averageToday: averageMins,
      userCount: activeUsersCount
    };
  }, [profile, allUsers]);

  const syncData = async (updatedProfile) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), updatedProfile);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), updatedProfile);
  };

  const handleSaveProfile = async () => {
    if (!editNickname.trim() || !hasAgreed) return;
    const initialData = {
      nickname: editNickname,
      avatar: editAvatar,
      lastUpdated: Date.now(),
      studyLog: [],
      totals: calculateTotals([])
    };
    await syncData(initialData);
  };

  const handleAddStudy = async (e) => {
    e.preventDefault();
    const h = Math.max(0, parseInt(inputHours) || 0);
    const m = Math.max(0, parseInt(inputMinutes) || 0);
    const newMins = h * 60 + m;
    
    if (newMins <= 0) {
      setAlertConfig({ open: true, message: "時間を入力してね！⚡️" });
      return;
    }

    const newLog = { 
      subjectId: inputSubject, 
      minutes: newMins, 
      timestamp: Date.now(), 
      id: crypto.randomUUID() 
    };
    const newLogs = [...(profile.studyLog || []), newLog];
    const newTotals = calculateTotals(newLogs);

    await syncData({ ...profile, studyLog: newLogs, totals: newTotals, lastUpdated: Date.now() });
    
    setInputHours('0');
    setInputMinutes('0');
    setAlertConfig({ open: true, message: "記録完了✨" });
  };

  const handleDeleteLog = async (logId) => {
    const newLogs = profile.studyLog.filter(l => l.id !== logId);
    const newTotals = calculateTotals(newLogs);
    await syncData({ ...profile, studyLog: newLogs, totals: newTotals });
  };

  const startEdit = (log) => {
    setEditingLogId(log.id);
    setEditHours(Math.floor(log.minutes / 60).toString());
    setEditMinutes((log.minutes % 60).toString());
  };

  const handleUpdateLog = async () => {
    const h = Math.max(0, parseInt(editHours) || 0);
    const m = Math.max(0, parseInt(editMinutes) || 0);
    const newTotalMins = h * 60 + m;
    const newLogs = profile.studyLog.map(l => 
      l.id === editingLogId ? { ...l, minutes: newTotalMins } : l
    );
    const newTotals = calculateTotals(newLogs);
    await syncData({ ...profile, studyLog: newLogs, totals: newTotals });
    setEditingLogId(null);
  };

  const filteredRankings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return allUsers.map(u => {
      const todayLogs = (u.studyLog || []).filter(l => l.timestamp >= startOfToday);
      return { ...u, todayTotals: calculateTotals(todayLogs) };
    }).sort((a, b) => (b.todayTotals.total || 0) - (a.todayTotals.total || 0)).slice(0, 10);
  }, [allUsers]);

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  if (loading) return <div className="flex flex-col items-center justify-center h-screen font-bold text-blue-400 bg-blue-50"><Zap className="animate-bounce mb-2" /> 読み込み中...</div>;

  if (showSetup) {
    return (
      <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-6 text-center">
        <CuteLightningBackground />
        <div className="max-w-sm w-full space-y-6 relative z-10">
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-[3rem] border-4 border-blue-200 shadow-xl space-y-6">
            <h1 className="text-3xl font-black text-blue-500 tracking-tight flex items-center justify-center gap-2">
              <Zap className="fill-yellow-300 text-yellow-400" /> Start Study!
            </h1>
            <div className="text-7xl p-6 bg-blue-50 rounded-full inline-block">{editAvatar}</div>
            <div className="grid grid-cols-5 gap-2">
              {ICONS.map(e => (
                <button key={e} onClick={() => setEditAvatar(e)} className={`text-xl p-2 rounded-xl transition-all ${editAvatar === e ? 'bg-blue-400 scale-110 text-white shadow-md' : 'bg-gray-100 hover:bg-blue-100'}`}>{e}</button>
              ))}
            </div>
            <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder="なまえを入力" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-center outline-none border-2 border-blue-100 focus:border-blue-400 text-blue-600" maxLength={10} />
            <label className="flex items-center gap-3 cursor-pointer justify-center text-sm font-bold text-gray-400">
              <input type="checkbox" checked={hasAgreed} onChange={(e) => setHasAgreed(e.target.checked)} className="hidden peer" />
              <div className="w-5 h-5 border-2 border-blue-200 rounded-md peer-checked:bg-blue-400 peer-checked:border-blue-400 flex items-center justify-center text-white transition-colors">{hasAgreed && "✓"}</div>
              <span>不適切な名前や、人を傷つける名前はおやめください。また悪意のある時間の記録はおやめください。</span>
            </label>
            <button onClick={handleSaveProfile} disabled={!hasAgreed} className={`w-full py-4 rounded-2xl font-black transition-all transform active:scale-95 ${hasAgreed ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-gray-200 text-gray-400'}`}>登録する</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 text-slate-700 pb-28 font-sans">
      <CuteLightningBackground />

      {/* --- Modals --- */}
      {alertConfig.open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-blue-900/20 backdrop-blur-sm p-4">
          <div className="bg-white border-2 border-blue-100 p-8 rounded-[2.5rem] shadow-2xl max-w-xs w-full text-center space-y-4">
            <Zap className="mx-auto text-yellow-400 fill-yellow-300 w-10 h-10" />
            <p className="font-bold text-slate-600">{alertConfig.message}</p>
            <button onClick={() => setAlertConfig({ ...alertConfig, open: false })} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all">OK!</button>
          </div>
        </div>
      )}

      {editingLogId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-blue-900/20 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm space-y-6 border-2 border-blue-100 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-blue-500">きろくを編集</h3>
              <button onClick={() => setEditingLogId(null)} className="text-gray-300 hover:text-gray-500"><X size={24}/></button>
            </div>
            <div className="flex gap-4 items-center justify-center">
              <div className="text-center">
                <input type="number" value={editHours} onChange={(e) => setEditHours(e.target.value)} className="w-20 bg-gray-50 border-2 border-blue-50 p-4 rounded-xl text-center font-bold text-xl text-blue-500 focus:border-blue-400 outline-none" />
                <p className="text-[10px] text-gray-400 mt-1 font-bold">Hours</p>
              </div>
              <span className="font-bold text-blue-200">:</span>
              <div className="text-center">
                <input type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} className="w-20 bg-gray-50 border-2 border-blue-50 p-4 rounded-xl text-center font-bold text-xl text-blue-500 focus:border-blue-400 outline-none" />
                <p className="text-[10px] text-gray-400 mt-1 font-bold">Mins</p>
              </div>
            </div>
            <button onClick={handleUpdateLog} className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold">更新する</button>
          </div>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md p-5 flex justify-between items-center border-b border-blue-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-3xl shadow-md border-b-4 border-blue-700">{profile?.avatar}</div>
          <div>
            <h2 className="font-bold text-slate-800 leading-none">{profile?.nickname}</h2>
            <div className="flex items-center gap-1 mt-1">
              <Zap size={10} className="text-yellow-400 fill-yellow-400" />
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Level {Math.floor((profile?.totals?.total || 0) / 300) + 1}</p>
            </div>
          </div>
        </div>
        <button onClick={() => setActiveTab('mypage')} className="p-3 bg-blue-50 text-blue-500 rounded-2xl border border-blue-100">
          <User size={20} />
        </button>
      </header>

      <main className="p-5 max-w-md mx-auto relative z-10">
        {activeTab === 'ranking' && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-[2.5rem] border border-blue-100 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <Zap size={60} className="text-blue-500" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4 flex items-center gap-2">
                <Star size={14} className="fill-yellow-300 text-yellow-300" /> Study Charge
              </h3>
              <form onSubmit={handleAddStudy} className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {SUBJECTS.map(s => (
                    <button 
                      key={s.id} 
                      type="button"
                      onClick={() => setInputSubject(s.id)}
                      className={`flex-none px-4 py-2 rounded-full text-xs font-bold transition-all border ${inputSubject === s.id ? `${s.bg} text-white border-transparent scale-105 shadow-md` : 'bg-gray-50 text-slate-400 border-gray-100'}`}
                    >
                      {s.icon} {s.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-blue-50">
                  <input type="number" min="0" value={inputHours} onChange={(e) => setInputHours(e.target.value)} className="w-full text-center font-bold text-2xl text-blue-500 bg-transparent outline-none" />
                  <span className="text-[10px] font-bold text-slate-400">時</span>
                  <div className="w-px h-6 bg-blue-100 mx-2" />
                  <input type="number" min="0" value={inputMinutes} onChange={(e) => setInputMinutes(e.target.value)} className="w-full text-center font-bold text-2xl text-blue-500 bg-transparent outline-none" />
                  <span className="text-[10px] font-bold text-slate-400">分</span>
                </div>
                <button type="submit" className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 transition-all">
                  きろくする <Zap size={18} fill="currentColor" className="text-yellow-300" />
                </button>
              </form>
            </section>

            <section className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-blue-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-blue-50 bg-blue-50/30 flex justify-between items-center">
                <h3 className="font-bold text-xs text-blue-400 tracking-widest uppercase italic">⚡️ Today's Ranking</h3>
                <Trophy size={16} className="text-yellow-400" />
              </div>
              <div className="divide-y divide-blue-50">
                {filteredRankings.map((u, i) => (
                  <div key={u.id} className={`flex items-center p-5 transition-all ${u.id === user?.uid ? 'bg-blue-50/50' : ''}`}>
                    <div className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${i === 0 ? 'bg-yellow-300 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'text-slate-300 bg-slate-50'}`}>{i + 1}</div>
                    <span className="text-2xl mx-4">{u.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-slate-700">{u.nickname}</p>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${Math.min(100, ((u.todayTotals?.total || 0) / (filteredRankings[0]?.todayTotals?.total || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="font-bold text-sm text-blue-500">
                        {Math.floor((u.todayTotals?.total || 0) / 60)}h {u.todayTotals?.total % 60}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* 今日の比較セクション */}
            <section className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Users size={80} className="text-blue-500" />
              </div>
              <h3 className="font-bold text-xs text-blue-300 tracking-widest uppercase italic mb-6">⚡️ Today's Analytics</h3>
              
              <div className="grid grid-cols-2 gap-6 relative z-10">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">自分</p>
                  <p className="text-2xl font-black text-blue-500">{formatTime(statsData.myToday)}</p>
                  <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (statsData.myToday / (statsData.averageToday || 1)) * 100)}%` }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">みんなの平均</p>
                  <p className="text-2xl font-black text-slate-400">{formatTime(statsData.averageToday)}</p>
                  <div className="h-1 w-full bg-slate-100 rounded-full"></div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-400" />
                  <span className="text-xs font-bold text-blue-400">今日の参加人数</span>
                </div>
                <span className="font-bold text-blue-600">{statsData.userCount}人</span>
              </div>
              
              <p className="text-[10px] text-center text-slate-300 mt-4 font-medium italic">
                {statsData.myToday >= statsData.averageToday 
                  ? "すごい！平均を超えて頑張ってるね✨" 
                  : "あと少し！自分のペースでチャージしよう⚡️"}
              </p>
            </section>

            {/* 科目別分析 */}
            <section className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm">
              <h3 className="font-bold text-center text-slate-800 mb-8 flex items-center justify-center gap-2 text-sm">
                <PieChart size={18} className="text-blue-500" /> 科目別データの分析
              </h3>
              <div className="space-y-6">
                {SUBJECTS.map(s => {
                  const total = profile?.totals?.total || 1;
                  const mins = profile?.totals?.[s.id] || 0;
                  const percent = Math.floor((mins / total) * 100);
                  return (
                    <div key={s.id}>
                      <div className="flex justify-between text-[11px] font-bold mb-2">
                        <span className="flex items-center gap-2 text-slate-500"><span>{s.icon}</span> {s.name}</span>
                        <span className="text-slate-400">{Math.floor(mins / 60)}h {mins % 60}m ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden border border-blue-50">
                        <div className={`h-full ${s.bg} rounded-full`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'mypage' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section className="bg-white p-8 rounded-[3rem] border border-blue-100 text-center space-y-6 shadow-sm">
              <div className="relative inline-block">
                <div className="text-7xl bg-blue-50 w-40 h-40 flex items-center justify-center rounded-[3rem] border border-blue-100 mx-auto shadow-inner">
                  {profile?.avatar}
                </div>
                <button onClick={() => setShowSetup(true)} className="absolute bottom-0 right-0 bg-white text-blue-500 p-3 rounded-2xl shadow-lg border border-blue-50 hover:scale-110 transition-all">
                  <Edit3 size={18} />
                </button>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{profile?.nickname}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1">Total Time</p>
                  <p className="text-xl font-bold text-blue-600">
                    {Math.floor((profile?.totals?.total || 0) / 60)}<span className="text-xs ml-0.5 text-blue-300">H</span> {profile?.totals?.total % 60}<span className="text-xs ml-0.5 text-blue-300">M</span>
                  </p>
                </div>
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1">Sparks</p>
                  <p className="text-xl font-bold text-blue-600">
                    {profile?.studyLog?.length || 0}<span className="text-xs ml-1 text-blue-300">回</span>
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[2.5rem] border border-blue-100 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-blue-50 bg-blue-50/20 flex items-center gap-2">
                <Clock className="text-blue-400" size={18} />
                <h3 className="font-bold text-xs text-blue-400 tracking-widest uppercase">Log History</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-blue-50 scrollbar-hide">
                {[...(profile?.studyLog || [])].reverse().map(log => {
                  const subject = SUBJECTS.find(s => s.id === log.subjectId);
                  return (
                    <div key={log.id} className="p-4 flex items-center justify-between hover:bg-blue-50/30 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${subject?.bg} rounded-xl flex items-center justify-center text-xl text-white shadow-sm`}>
                          {subject?.icon}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">{Math.floor(log.minutes / 60)}h {log.minutes % 60}m</p>
                          <p className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleDateString()} // {subject?.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => startEdit(log)} className="p-2 text-slate-300 hover:text-blue-500"><Edit3 size={16} /></button>
                        <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-slate-300 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-xl p-3 rounded-[2.5rem] shadow-xl flex border border-blue-100 max-w-md mx-auto z-40">
        <button onClick={() => setActiveTab('ranking')} className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${activeTab === 'ranking' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-blue-400'}`}>
          <Trophy size={18} /><span className="text-[9px] font-bold uppercase tracking-tighter">Ranking</span>
        </button>
        <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-blue-400'}`}>
          <PieChart size={18} /><span className="text-[9px] font-bold uppercase tracking-tighter">Stats</span>
        </button>
        <button onClick={() => setActiveTab('mypage')} className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${activeTab === 'mypage' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-blue-400'}`}>
          <User size={18} /><span className="text-[9px] font-bold uppercase tracking-tighter">My Page</span>
        </button>
      </nav>
    </div>
  );
}

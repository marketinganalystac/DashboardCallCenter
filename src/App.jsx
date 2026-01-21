import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// --- CONFIGURACIÓN FIREBASE ---
const userFirebaseConfig = {
  apiKey: "AIzaSyAY5PNoQqvkMVOgInqpn4tkIAdFFcKQZx0",
  authDomain: "dashboardcallcenter-6d8cf.firebaseapp.com",
  projectId: "dashboardcallcenter-6d8cf",
  storageBucket: "dashboardcallcenter-6d8cf.firebasestorage.app",
  messagingSenderId: "418436578818",
  appId: "1:418436578818:web:3ddabc1b56e2a1eeacf11b",
  measurementId: "G-DQT1X9X1C4"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.log("Analytics not supported in this environment");
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- UTILIDADES ---
const getHolidays = (year) => {
  const fixedHolidays = [
    `${year}-01-01`, `${year}-01-09`, `${year}-05-01`, `${year}-11-03`,
    `${year}-11-04`, `${year}-11-05`, `${year}-11-10`, `${year}-11-28`,
    `${year}-12-08`, `${year}-12-25`,
  ];
  let variableHolidays = [];
  if (year === 2024) variableHolidays = ['2024-02-13', '2024-03-29'];
  if (year === 2025) variableHolidays = ['2025-03-04', '2025-04-18'];
  if (year === 2026) variableHolidays = ['2026-02-17', '2026-04-03'];
  return [...fixedHolidays, ...variableHolidays];
};

const getPanamaBusinessDays = (targetDate = new Date()) => {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const todayDate = targetDate.getDate();
  const holidays = getHolidays(year);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalBusinessDays = 0;
  let elapsedBusinessDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const current = new Date(year, month, day);
    const dayOfWeek = current.getDay();
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateString = `${year}-${mStr}-${dStr}`;
    const isHoliday = holidays.includes(dateString);
    const isSunday = dayOfWeek === 0;
    if (!isSunday && !isHoliday) {
      totalBusinessDays++;
      if (day <= todayDate) elapsedBusinessDays++;
    }
  }
  return { totalBusinessDays, elapsedBusinessDays };
};

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// --- COMPONENTES ---
const AnimatedCounter = ({ value, duration = 1500, prefix = '' }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let startTime;
        let animationFrame;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const ease = (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
            setCount(Math.floor(value * ease(percentage)));
            if (progress < duration) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(value);
            }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);
    return <span>{prefix}{count.toLocaleString('es-PA')}</span>;
};

const CircularProgress = ({ value, max, color = "text-amber-500", size = 70, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const [offset, setOffset] = useState(circumference);
    useEffect(() => {
        const progress = Math.min(Math.max(value / max, 0), 1);
        const dashoffset = circumference - progress * circumference;
        const timer = setTimeout(() => setOffset(dashoffset), 300);
        return () => clearTimeout(timer);
    }, [value, max, circumference]);
    return (
        <div className="relative flex items-center justify-center drop-shadow-md" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle className="text-slate-200/50" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
                <circle className={`${color} transition-all duration-[1500ms] ease-out`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
            </svg>
            <div className="absolute text-[10px] font-black text-slate-700">
                {Math.round((value / max) * 100)}%
            </div>
        </div>
    );
};

const Podium = ({ agents }) => {
    const top3 = [
        agents[1] || { name: 'Vacante', sales: 0 },
        agents[0] || { name: 'Vacante', sales: 0 },
        agents[2] || { name: 'Vacante', sales: 0 }
    ];
    const maxSales = Math.max(...top3.map(a => a.sales), 1);

    return (
        <div className="flex items-end justify-center gap-2 md:gap-4 h-64 w-full pt-14 pb-0">
            {top3.map((agent, index) => {
                let rank = 0;
                let colorClass = '';
                let icon = '';
                let delay = '';
                if (index === 1) { 
                    rank = 1; 
                    colorClass = 'from-amber-300 to-amber-500 shadow-amber-500/50'; 
                    icon = 'ph-crown'; 
                    delay = 'delay-300'; 
                } else if (index === 0) { 
                    rank = 2; 
                    colorClass = 'from-slate-300 to-slate-400 shadow-slate-400/50'; 
                    icon = 'ph-medal'; 
                    delay = 'delay-500'; 
                } else { 
                    rank = 3; 
                    colorClass = 'from-orange-300 to-orange-400 shadow-orange-400/50'; 
                    icon = 'ph-medal'; 
                    delay = 'delay-700'; 
                }
                
                const visualHeight = index === 1 ? 'h-[90%]' : (index === 0 ? 'h-[75%]' : 'h-[60%]');

                return (
                    <div key={index} className={`flex flex-col items-center justify-end w-24 md:w-32 group ${visualHeight} transition-transform hover:scale-105 duration-300`}>
                        <div className={`mb-2 flex flex-col items-center transition-all duration-700 opacity-0 animate-fade-in-down ${delay} fill-mode-forwards`}>
                            <div className="font-bold text-slate-700 text-xs md:text-sm text-center line-clamp-1 mb-1">{agent.name.split(' ')[0]}</div>
                            <div className="font-black text-slate-900 text-sm md:text-base"><AnimatedCounter value={agent.sales} prefix="$" /></div>
                        </div>

                        <div className={`w-full h-full rounded-t-2xl bg-gradient-to-t ${colorClass} shadow-lg relative flex items-end justify-center pb-4 transition-all duration-1000 transform scale-y-0 animate-grow-up origin-bottom podium-bar overflow-visible`}>
                            {/* Badge elevado con -top-12 */}
                            <div className="absolute -top-12 w-11 h-11 md:w-14 md:h-14 rounded-full bg-white border-[4px] border-slate-50 shadow-2xl flex items-center justify-center z-20">
                                <span className={`font-black text-3xl md:text-4xl drop-shadow-md tracking-[-0.05em] ${index === 1 ? 'text-amber-600' : (index === 0 ? 'text-slate-700' : 'text-orange-600')}`}>
                                    #{rank}
                                </span>
                            </div>
                            
                            <i className={`ph-fill ${icon} text-white/30 text-4xl absolute bottom-2`}></i>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const Notification = ({ message, type, onClose }) => {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in-down transition-all transform ${isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
      <i className={`ph-fill text-xl ${isError ? 'ph-warning-circle' : 'ph-check-circle'}`}></i>
      <span className="font-bold text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100"><i className="ph-bold ph-x"></i></button>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-scale-in">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 text-2xl">
          <i className="ph-fill ph-warning"></i>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-lg text-sm transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm shadow-lg shadow-amber-500/20 transition-all">Sí, actualizar</button>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = ({ onLoginGuest, onLoginEmail }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLoginEmail(email, password, isRegistering);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 z-0"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="glass-card w-full max-w-md p-8 relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-black/20">
             <i className="ph-fill ph-chart-polar text-amber-500 text-3xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Bienvenido</h1>
          <p className="text-slate-400 text-sm">Acceso al Tablero Directivo</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs text-center">{error}</div>}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Correo Electrónico</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800/50 border border-slate-600 text-white text-sm rounded-xl py-2.5 px-4 focus:outline-none focus:border-amber-500" placeholder="usuario@empresa.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-600 text-white text-sm rounded-xl py-2.5 px-4 focus:outline-none focus:border-amber-500" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all">{loading ? '...' : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}</button>
        </form>
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-4">
           <button onClick={onLoginGuest} className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm transition-all flex items-center justify-center gap-2">Acceso Invitado</button>
           <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-xs text-slate-500 hover:text-amber-400 text-center">{isRegistering ? 'Iniciar sesión' : 'Registrarse'}</button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [metrics, setMetrics] = useState({ agents: [], annual: [], daily: [], categories: [], currentYear: 0, currentMonthName: '', rawData: [] });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [view, setView] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [notification, setNotification] = useState(null);
  const [hoveredAgent, setHoveredAgent] = useState(null);
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const pieInstance = useRef(null);
  const barInstance = useRef(null);
  const lineInstance = useRef(null);
  const fileInputRef = useRef(null);
  const [businessDays, setBusinessDays] = useState({ total: 25, elapsed: 10 });

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    const days = getPanamaBusinessDays();
    setBusinessDays({ total: days.totalBusinessDays, elapsed: days.elapsedBusinessDays });
    return () => unsubscribe();
  }, []);

  const handleLoginGuest = async () => {
    setLoading(true);
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) {
      showNotification("Error: " + error.message, 'error');
      setLoading(false);
    }
  };

  const handleLoginEmail = async (email, password, isRegistering) => {
    if (isRegistering) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMetrics({ agents: [], annual: [], daily: [], categories: [], currentYear: 0, currentMonthName: '', rawData: [] });
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');
    const unsubscribe = onSnapshot(dataRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetrics({
            agents: data.agents || [],
            annual: data.annual || [],
            daily: data.daily || [],
            categories: data.categories || [],
            currentYear: data.currentYear || new Date().getFullYear(),
            currentMonthName: data.currentMonthName || '',
            rawData: data.rawData || []
        });
      } else {
        setMetrics({ agents: [], annual: [], daily: [], categories: [], currentYear: new Date().getFullYear(), currentMonthName: '', rawData: [] });
      }
      setDataLoading(false);
    }, (error) => setDataLoading(false));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const tailwindConfigScript = document.createElement('script');
    tailwindConfigScript.text = `
      tailwind.config = {
        theme: {
          extend: {
            colors: { navy: { 800: '#1e3a8a', 900: '#0f172a' }, amber: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' } },
            animation: {
              'fade-in': 'fadeIn 0.5s ease-out',
              'fade-in-down': 'fadeInDown 0.6s ease-out',
              'grow-up': 'growUp 1s ease-out forwards',
              'scale-in': 'scaleIn 0.3s ease-out',
              'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              fadeInDown: { '0%': { opacity: '0', transform: 'translateY(-20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
              growUp: { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
              scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
              shine: { '0%': { transform: 'translateX(-100%) skewX(-30deg)' }, '100%': { transform: 'translateX(400%) skewX(-30deg)' } }
            }
          }
        }
      }
    `;
    document.head.appendChild(tailwindConfigScript);
    const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src; script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
    });
    Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/chart.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"),
      loadScript("https://unpkg.com/@phosphor-icons/web")
    ]).then(() => updateCharts());
  }, []);

  useEffect(() => {
    if (typeof Chart === 'undefined') return;
    if (view === 'dashboard') updateCharts();
  }, [metrics, view]);

  const updateCharts = () => {
    if (typeof Chart === 'undefined') return;
    if (metrics.annual.length === 0) return;

    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = "#64748b";

    const processedAgents = [...metrics.agents].sort((a, b) => b.sales - a.sales);

    // Pie Chart
    if (pieChartRef.current) {
      if (pieInstance.current) pieInstance.current.destroy();
      const ctxPie = pieChartRef.current.getContext('2d');
      pieInstance.current = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: processedAgents.map(a => a.name.split(' ')[0]),
          datasets: [{
            data: processedAgents.map(a => a.sales),
            backgroundColor: ['#0f172a', '#f59e0b', '#334155', '#fbbf24', '#94a3b8'],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 15,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
          layout: { padding: 10 },
          onHover: (event, elements) => {
             if (elements && elements.length > 0) {
                 const index = elements[0].index;
                 setHoveredAgent({
                     name: processedAgents[index].name.split(' ')[0],
                     sales: processedAgents[index].sales
                 });
             } else {
                 setHoveredAgent(null);
             }
          },
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }

    // Bar Chart - Evolución Histórica (agrupadas, últimos 3 años, variación por agente en tooltip)
    if (barChartRef.current) {
      if (barInstance.current) barInstance.current.destroy();
      let sortedYears = [...metrics.annual].sort((a, b) => a.year - b.year);
      if (sortedYears.length > 3) sortedYears = sortedYears.slice(-3);
      const yearsLabels = sortedYears.map(y => y.year);
      const allAgentsSet = new Set();
      sortedYears.forEach(yearData => {
          if (yearData.agents) Object.keys(yearData.agents).forEach(agent => allAgentsSet.add(agent));
      });
      const allAgents = Array.from(allAgentsSet);
      const colors = ['#0f172a', '#f59e0b', '#334155', '#fbbf24', '#94a3b8', '#64748b', '#d97706', '#475569'];
      const datasets = [];
      allAgents.forEach((agent, index) => {
          const data = sortedYears.map(yearData => yearData.agents ? (yearData.agents[agent] || 0) : 0);
          datasets.push({
              label: agent.split(' ')[0],
              data: data,
              backgroundColor: colors[index % colors.length],
              borderRadius: 4,
              barThickness: 28,
          });
      });
      const unknownData = sortedYears.map(yearData => !yearData.agents ? yearData.total : 0);
      if (unknownData.some(v => v > 0)) {
           datasets.push({ label: 'Sin Desglose', data: unknownData, backgroundColor: '#cbd5e1', borderRadius: 4, barThickness: 28 });
      }
      const annualGoal = 15000 * 3 * 12;
      datasets.push({
          label: 'Meta Anual',
          data: sortedYears.map(() => annualGoal),
          type: 'line',
          borderColor: '#e11d48',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 0
      });
      const ctxBar = barChartRef.current.getContext('2d');
      barInstance.current = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: yearsLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, stacked: false, grid: { color: '#f1f5f9', drawBorder: false }, ticks: { callback: v => '$' + v/1000 + 'k', font: {size: 10} }, border: { display: false } },
            x: { stacked: false, grid: { display: false }, ticks: { font: {weight: 'bold'} } }
          },
          plugins: { 
              legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: {size: 10} } },
              tooltip: {
                  callbacks: {
                      label: (context) => {
                          let label = context.dataset.label || '';
                          if (label) label += ': ';
                          const currentVal = context.parsed.y;
                          label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(currentVal);
                          if (context.dataIndex > 0 && context.dataset.type !== 'line') {
                              const prevVal = context.dataset.data[context.dataIndex - 1];
                              if (prevVal > 0) {
                                  const diffPct = ((currentVal - prevVal) / prevVal) * 100;
                                  const sign = diffPct >= 0 ? '+' : '';
                                  label += ` (${sign}${diffPct.toFixed(1)}% vs ${yearsLabels[context.dataIndex-1]})`;
                              }
                          }
                          return label;
                      }
                  }
              }
          }
        }
      });
    }

    // Line Chart - Ventas Diarias (Density Style + Triángulos dinámicos)
    if (lineChartRef.current) {
        if (lineInstance.current) lineInstance.current.destroy();
        const dailyDataPoints = metrics.daily; 
        const labels = dailyDataPoints.map(d => parseInt(d.date.split('-')[2]));
        const dataValues = dailyDataPoints.map(d => d.total);
        const growthRates = dataValues.map((val, i) => {
            if (i === 0) return 0;
            const prev = dataValues[i-1];
            return prev === 0 ? 0 : ((val - prev) / prev) * 100;
        });
        const ctxLine = lineChartRef.current.getContext('2d');
        const areaGradient = ctxLine.createLinearGradient(0, 0, 0, 320);
        areaGradient.addColorStop(0, 'rgba(245, 158, 11, 0.65)');
        areaGradient.addColorStop(1, 'rgba(245, 158, 11, 0.05)');
        lineInstance.current = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas Diarias (Densidad)',
                    data: dataValues,
                    borderColor: '#f59e0b',
                    backgroundColor: areaGradient,
                    borderWidth: 3,
                    tension: 0.45,
                    fill: true,
                    pointStyle: 'triangle',
                    pointRadius: 7,
                    pointHoverRadius: 10,
                    pointRotation: (ctx) => growthRates[ctx.dataIndex] >= 0 ? 0 : 180,
                    pointBackgroundColor: (ctx) => {
                        const g = growthRates[ctx.dataIndex];
                        return g >= 0 ? '#10b981' : '#f43f5e';
                    },
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2.5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => '$' + (v/1000) + 'k' } },
                    x: { grid: { display: false }, ticks: { font: {size: 10} } }
                },
                plugins: { 
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = 'Venta: ';
                                label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                const idx = context.dataIndex;
                                if (idx > 0) {
                                    const growth = growthRates[idx];
                                    const icon = growth >= 0 ? '▲' : '▼';
                                    const sign = growth >= 0 ? '+' : '';
                                    label += `  ${icon} ${sign}${growth.toFixed(1)}% vs ayer`;
                                }
                                return label;
                            }
                        }
                    }
                },
                animation: { duration: 1400, easing: 'easeOutQuart' }
            }
        });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (metrics.agents.length > 0) {
      setPendingFile(file);
      setShowConfirmModal(true);
      e.target.value = ''; 
    } else {
      processFile(file);
      e.target.value = ''; 
    }
  };

  const deleteYear = async (yearToDelete) => {
    if (!user) return;
    try {
        const updatedAnnual = metrics.annual.filter(item => item.year !== yearToDelete);
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');
        await updateDoc(docRef, { annual: updatedAnnual });
        showNotification(`Año ${yearToDelete} eliminado del histórico`, 'success');
    } catch (err) {
        showNotification("Error al eliminar año: " + err.message, 'error');
    }
  };

  const processFile = (file) => {
    if (typeof XLSX === 'undefined') { showNotification("Librería Excel no lista", 'error'); return; }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array', cellDates: true});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: false, dateNF: 'yyyy-mm-dd'});
        let colIndices = { name: -1, sales: -1, date: -1, category: -1, quantity: -1 }; 
        const headers = jsonData[0]; 
        if (headers && Array.isArray(headers)) {
          headers.forEach((h, idx) => {
            const txt = String(h).toLowerCase();
            if (colIndices.name === -1 && (txt.includes('asesor') || txt.includes('nombre') || txt.includes('agente'))) colIndices.name = idx;
            if (colIndices.sales === -1 && (txt.includes('venta') || txt.includes('total') || txt.includes('monto'))) colIndices.sales = idx;
            if (colIndices.date === -1 && (txt.includes('fecha') || txt.includes('date'))) colIndices.date = idx;
            if (colIndices.category === -1 && (txt.includes('categoria') || txt.includes('category'))) colIndices.category = idx;
            if (colIndices.quantity === -1 && (txt.includes('cantidad') || txt.includes('cant'))) colIndices.quantity = idx;
          });
        }
        if (colIndices.name === -1 || colIndices.sales === -1 || colIndices.date === -1) throw new Error("Faltan columnas requeridas");
        const annualMap = new Map();
        if (metrics.annual && Array.isArray(metrics.annual)) {
            metrics.annual.forEach(item => {
                annualMap.set(item.year, { total: item.total, agents: item.agents || {} });
            });
        }
        const dailyMap = new Map();
        const agentsMap = new Map();
        const categoryMap = new Map();
        const dailyAgentSalesMap = new Map();
        let rawDataArray = [];
        let maxDateTimestamp = 0;
        const yearsInFile = new Set();
        for(let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row) continue;
            const rawDate = row[colIndices.date];
            if (rawDate) {
                 let dateObj = null;
                 if (rawDate instanceof Date) dateObj = rawDate;
                 else if (typeof rawDate === 'string') dateObj = new Date(rawDate);
                 if (dateObj && !isNaN(dateObj.getTime())) {
                     yearsInFile.add(dateObj.getFullYear());
                     if (dateObj.getTime() > maxDateTimestamp) maxDateTimestamp = dateObj.getTime();
                 }
            }
        }
        yearsInFile.forEach(y => annualMap.set(y, { total: 0, agents: {} }));
        const maxDate = maxDateTimestamp > 0 ? new Date(maxDateTimestamp) : new Date();
        const currentYear = maxDate.getFullYear();
        const currentMonth = maxDate.getMonth();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const currentMonthName = monthNames[currentMonth];
        for(let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[colIndices.name]) continue;
          let salesVal = 0;
          const rawSales = row[colIndices.sales];
          if (typeof rawSales === 'number') salesVal = rawSales;
          else if (typeof rawSales === 'string') salesVal = parseFloat(rawSales.replace(/[^0-9.-]+/g,"")) || 0;
          const rawDate = row[colIndices.date];
          let dateObj = null;
          if (rawDate instanceof Date) dateObj = rawDate;
          else if (typeof rawDate === 'string') dateObj = new Date(rawDate);
          if (!dateObj || isNaN(dateObj.getTime())) continue;
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth();
          const day = dateObj.getDate();
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const rawName = String(row[colIndices.name]).trim();
          if (rawDataArray.length < 2000) {
              const rawCat = colIndices.category !== -1 ? String(row[colIndices.category] || "-").trim() : "-";
              const rawQty = colIndices.quantity !== -1 ? (row[colIndices.quantity] || 0) : 0;
              rawDataArray.push({ date: dateStr, agent: rawName, sales: salesVal, category: rawCat, quantity: rawQty });
          }
          const annualEntry = annualMap.get(year);
          if (annualEntry) {
              annualEntry.total += salesVal;
              const agentKey = rawName; 
              annualEntry.agents[agentKey] = (annualEntry.agents[agentKey] || 0) + salesVal;
              annualMap.set(year, annualEntry);
          }
          if (year === currentYear) {
              const nameKey = rawName.toLowerCase();
              if (agentsMap.has(nameKey)) {
                const existing = agentsMap.get(nameKey);
                existing.sales += salesVal;
                agentsMap.set(nameKey, existing);
              } else {
                agentsMap.set(nameKey, { name: rawName, sales: salesVal });
              }
              if (colIndices.category !== -1) {
                  const rawCat = String(row[colIndices.category] || "Sin Categoría").trim();
                  let qtyVal = 0;
                  const rawQty = row[colIndices.quantity];
                  if (typeof rawQty === 'number') qtyVal = rawQty;
                  else if (typeof rawQty === 'string') qtyVal = parseFloat(rawQty.replace(/[^0-9.-]+/g,"")) || 0;
                  if (categoryMap.has(rawCat)) {
                      const existing = categoryMap.get(rawCat);
                      existing.sales += salesVal;
                      existing.quantity += qtyVal;
                      categoryMap.set(rawCat, existing);
                  } else {
                      categoryMap.set(rawCat, { name: rawCat, sales: salesVal, quantity: qtyVal });
                  }
              }
              if (month === currentMonth) {
                  dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + salesVal);
                  if (!dailyAgentSalesMap.has(dateStr)) dailyAgentSalesMap.set(dateStr, new Map());
                  const dayAgentMap = dailyAgentSalesMap.get(dateStr);
                  dayAgentMap.set(nameKey, (dayAgentMap.get(nameKey) || 0) + salesVal);
              }
          }
        }
        const annualArray = Array.from(annualMap, ([year, data]) => ({ year, total: data.total, agents: data.agents }));
        const agentsArray = Array.from(agentsMap.values());
        const categoriesArray = Array.from(categoryMap.values());
        let dailyArray = [];
        if (dailyMap.size > 0) {
            const sortedDates = Array.from(dailyMap.keys()).sort();
            if (sortedDates.length > 0) {
                 const startDate = new Date(sortedDates[0] + 'T00:00:00');
                 const endDate = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00');
                 for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dStr = `${y}-${m}-${day}`;
                    let bestAgentInfo = { name: '-', sales: 0 };
                    if (dailyAgentSalesMap.has(dStr)) {
                        const dayAgentMap = dailyAgentSalesMap.get(dStr);
                        let maxSales = -1;
                        for (const [agentKey, val] of dayAgentMap.entries()) {
                            if (val > maxSales) {
                                maxSales = val;
                                const storedName = agentsMap.get(agentKey)?.name || "Agente";
                                bestAgentInfo = { name: storedName, sales: val };
                            }
                        }
                    }
                    dailyArray.push({ date: dStr, total: dailyMap.get(dStr) || 0, bestAgent: bestAgentInfo });
                 }
            }
        }
        const days = getPanamaBusinessDays(maxDate);
        setBusinessDays({ total: days.totalBusinessDays, elapsed: days.elapsedBusinessDays });
        rawDataArray.sort((a, b) => new Date(b.date) - new Date(a.date));
        if(annualArray.length > 0 && user) {
            const payload = { 
                agents: agentsArray, 
                annual: annualArray, 
                daily: dailyArray, 
                categories: categoriesArray,
                currentYear: currentYear,
                currentMonthName: currentMonthName,
                rawData: rawDataArray
            };
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period'), payload);
            showNotification(`✅ Datos actualizados. Año: ${currentYear}, Mes: ${currentMonthName}`);
        }
      } catch (err) { showNotification("Error: " + err.message, 'error'); } 
      finally { setIsUploading(false); setPendingFile(null); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmReplace = () => { setShowConfirmModal(false); if (pendingFile) processFile(pendingFile); };
  const cancelReplace = () => { setShowConfirmModal(false); setPendingFile(null); };

  const { total: daysTotal, elapsed: daysElapsed } = businessDays;
  const goalMonthAgent = 15000;
  const goalDailyAgent = daysTotal > 0 ? goalMonthAgent / daysTotal : 0;
  const goalMonthCC = goalMonthAgent * 3; 
  const goalDailyCC = goalDailyAgent * 3; 
  const paceRatio = daysTotal > 0 ? (daysElapsed / daysTotal) : 0;
  const targetPercentToday = 1 - paceRatio; 
  const processedAgents = metrics.agents.map(a => ({ ...a, diff: a.sales - goalMonthAgent, percent: a.sales / goalMonthAgent })).sort((a, b) => b.sales - a.sales);
  const totalSales = processedAgents.reduce((acc, curr) => acc + curr.sales, 0);
  const goalCCToday = goalDailyCC * daysElapsed;
  const isCCAhead = totalSales >= goalCCToday;
  const top3Categories = [...metrics.categories].sort((a, b) => b.sales - a.sales).slice(0, 3);
  const bottom3Categories = [...metrics.categories].filter(c => c.sales > 0).sort((a, b) => a.sales - b.sales).slice(0, 3);

  let lastDaySales = 0, prevDaySales = 0, growthPct = 0, bestAgentToday = { name: 'N/A', sales: 0 };
  if (metrics.daily.length > 0) {
      const nonEmpty = metrics.daily.filter(d => d.total > 0);
      if (nonEmpty.length > 0) {
          const last = nonEmpty[nonEmpty.length - 1];
          lastDaySales = last.total;
          bestAgentToday = last.bestAgent || { name: 'N/A', sales: 0 };
          if (nonEmpty.length > 1) {
              prevDaySales = nonEmpty[nonEmpty.length - 2].total;
              if (prevDaySales > 0) growthPct = ((lastDaySales - prevDaySales) / prevDaySales) * 100;
          }
      }
  }

  const customStyles = `
    :root { --glass: rgba(255, 255, 255, 0.85); }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%); color: #1e293b; min-height: 100vh; }
    .glass-card { background: var(--glass); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 24px; box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05); transition: all 0.4s ease; }
    .glass-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.05); }
    .metric-mini-exec { background: rgba(255, 255, 255, 0.5); border: 1px solid rgba(255,255,255,0.6); border-radius: 16px; padding: 1rem; text-align: center; transition: all 0.3s; }
    .metric-mini-exec:hover { background: #fff; transform: scale(1.02); border-color: #f59e0b; }
    .fill-mode-forwards { animation-fill-mode: forwards; }
    .custom-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .custom-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    .podium-bar { position: relative; overflow: hidden; }
    .podium-bar::after {
      content: '';
      position: absolute;
      top: -100%;
      left: -50%;
      width: 40%;
      height: 200%;
      background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%);
      transform: skewX(-30deg);
      animation: shine 4s linear infinite;
    }
    @keyframes shine { 0% { transform: translateX(-100%) skewX(-30deg); } 100% { transform: translateX(400%) skewX(-30deg); } }
  `;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><i className="ph ph-spinner animate-spin text-amber-500 text-4xl"></i></div>;
  if (!user) return <><style>{customStyles}</style><Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} /><LoginScreen onLoginGuest={handleLoginGuest} onLoginEmail={handleLoginEmail} /></>;

  return (
    <>
      <style>{customStyles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      {isUploading && <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center"><i className="ph ph-spinner animate-spin text-white text-4xl mb-4"></i><p className="text-white font-bold">Procesando...</p></div>}
      <ConfirmModal isOpen={showConfirmModal} title="Actualizar Datos" message="Se detectaron datos nuevos. ¿Deseas fusionarlos con el historial existente?" onCancel={cancelReplace} onConfirm={confirmReplace} />
      <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="p-4 lg:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl shadow-lg shadow-slate-900/20">
                  <i className="ph-fill ph-chart-line-up text-amber-500 text-2xl"></i>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tablero Directivo <span className="text-amber-600 ml-2 text-xl">{metrics.currentYear}</span></h1>
              </div>
              <p className="text-slate-500 font-medium ml-12">Analítica de Rendimiento y Control de Metas</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="bg-white/80 backdrop-blur p-1 rounded-xl border border-slate-200 flex shadow-sm">
                    <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${view === 'dashboard' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><i className="ph-bold ph-squares-four"></i> Tablero</button>
                    <button onClick={() => setView('data')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${view === 'data' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><i className="ph-bold ph-table"></i> Base de Datos</button>
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-md p-2 rounded-2xl border border-white/50">
                <label className="group cursor-pointer px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20 hover:shadow-slate-900/40 transform hover:-translate-y-0.5">
                    <i className="ph ph-file-xls font-bold text-amber-500"></i><span>Importar</span>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls, .csv" className="hidden" />
                </label>
                <button onClick={handleLogout} className="px-4 py-2.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 rounded-xl text-sm font-bold transition-all"><i className="ph-bold ph-sign-out"></i></button>
                </div>
            </div>
          </header>

          {metrics.agents.length === 0 ? (
             <div className="min-h-[60vh] flex flex-col justify-center items-center text-center bg-white/40 rounded-3xl border-2 border-dashed border-slate-300">
                <div className="p-6 bg-white rounded-full text-amber-500 shadow-xl mb-6"><i className="ph-duotone ph-upload-simple text-5xl"></i></div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Tablero Vacío</h2>
                <p className="text-slate-500 max-w-sm mb-6">Importa tu archivo Excel de ventas para generar las visualizaciones.</p>
                <label className="cursor-pointer px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex gap-2"><i className="ph-bold ph-file-plus"></i> Cargar Datos<input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" /></label>
             </div>
          ) : view === 'data' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="glass-card p-6 bg-slate-900 text-white border-slate-800">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                              <i className="ph-fill ph-archive"></i> Histórico en Firebase
                          </h3>
                          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                              Estos son los años almacenados actualmente en la base de datos. Puedes eliminar años específicos si deseas limpiar el histórico.
                          </p>
                          <div className="space-y-2">
                              {metrics.annual.sort((a,b) => b.year - a.year).map((item) => (
                                  <div key={item.year} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center text-xs shadow-lg shadow-amber-500/20">
                                              {item.year}
                                          </div>
                                          <div>
                                              <div className="text-sm font-bold text-white">{formatCurrency(item.total)}</div>
                                              <div className="text-[10px] text-slate-400 uppercase">Venta Total</div>
                                          </div>
                                      </div>
                                      <button onClick={() => { if(window.confirm(`¿Estás seguro de eliminar el año ${item.year} del histórico?`)) { deleteYear(item.year); } }} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors" title="Eliminar año">
                                          <i className="ph-bold ph-trash"></i>
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-3">
                    <div className="glass-card p-6 h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <i className="ph-fill ph-database text-amber-500"></i> Última Carga (Raw Data)
                            </h3>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                {metrics.rawData.length} registros (últimos 2000)
                            </span>
                        </div>
                        <div className="overflow-x-auto custom-scroll max-h-[70vh]">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-slate-600 border-b">Fecha</th>
                                        <th className="px-4 py-3 font-bold text-slate-600 border-b">Asesor</th>
                                        <th className="px-4 py-3 font-bold text-slate-600 border-b text-right">Venta</th>
                                        <th className="px-4 py-3 font-bold text-slate-600 border-b">Categoría</th>
                                        <th className="px-4 py-3 font-bold text-slate-600 border-b text-right">Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {metrics.rawData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{row.date}</td>
                                            <td className="px-4 py-2 font-medium text-slate-800">{row.agent}</td>
                                            <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(row.sales)}</td>
                                            <td className="px-4 py-2 text-slate-500">{row.category}</td>
                                            <td className="px-4 py-2 text-right text-slate-500">{row.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {metrics.rawData.length === 0 && <div className="p-8 text-center text-slate-400">No hay datos crudos disponibles. Carga un archivo nuevamente.</div>}
                        </div>
                    </div>
                  </div>
              </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`glass-card p-5 border-l-4 ${isCCAhead ? 'border-l-emerald-500' : 'border-l-rose-500'} flex items-center gap-5 relative overflow-hidden`}>
                            <CircularProgress value={totalSales} max={goalCCToday} color={isCCAhead ? 'text-emerald-500' : 'text-rose-500'} size={76} />
                            <div className="flex-1 z-10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ventas vs Meta Hoy ({metrics.currentYear})</p>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-slate-900"><AnimatedCounter value={totalSales} prefix="$" /></span>
                                    <span className="text-[10px] font-bold text-slate-400 mt-1">Meta: {formatCurrency(goalCCToday)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="glass-card p-5 border-l-4 border-l-blue-600 flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
                            <div className="flex justify-between items-center mb-2 z-10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyección de Cierre</p>
                                <i className="ph-fill ph-chart-line-up text-blue-600 text-lg"></i>
                            </div>
                            <span className="text-2xl font-black text-slate-900 mb-2 z-10"><AnimatedCounter value={daysElapsed > 0 ? (totalSales / daysElapsed * daysTotal) : 0} prefix="$" /></span>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex z-10">
                                <div className="bg-blue-600 h-full rounded-full animate-grow-up origin-left" style={{width: '70%'}}></div>
                                <div className="bg-blue-300 h-full" style={{width: '30%'}}></div>
                            </div>
                        </div>
                        <div className="glass-card p-5 border-l-4 border-l-slate-800 flex flex-col justify-center relative overflow-hidden">
                             <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pendiente</p>
                                <i className="ph-fill ph-hourglass-high text-slate-800 text-lg"></i>
                            </div>
                            <span className="text-2xl font-black text-slate-900 mb-2"><AnimatedCounter value={Math.max(0, goalMonthCC - totalSales)} prefix="$" /></span>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-slate-800 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (Math.max(0, goalMonthCC - totalSales) / goalMonthCC) * 100)}%` }}></div>
                            </div>
                             <div className="mt-2 text-[10px] font-bold text-slate-500 text-right">
                                Faltan <span className="text-slate-800">{daysTotal - daysElapsed}</span> días hábiles
                            </div>
                        </div>
                    </div>
                    <section className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-6 h-[3px] bg-amber-500 rounded-full"></span> Métricas de Control
                            </h3>
                            <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">
                                Días: {daysElapsed} / {daysTotal}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="metric-mini-exec bg-amber-50/50 border-amber-200/50">
                                <div className="text-[9px] font-extrabold text-amber-700 uppercase mb-1">Ritmo Esperado</div>
                                <div className="text-xl font-black text-amber-600">{(targetPercentToday * 100).toFixed(0)}%</div>
                            </div>
                            <div className="metric-mini-exec">
                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Meta Mes Agente</div>
                                <div className="text-lg font-bold text-slate-800">{formatCurrency(goalMonthAgent)}</div>
                            </div>
                            <div className="metric-mini-exec">
                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Meta Día Agente</div>
                                <div className="text-lg font-bold text-slate-800">{formatCurrency(goalDailyAgent)}</div>
                            </div>
                            <div className="metric-mini-exec">
                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Meta Mes CC</div>
                                <div className="text-lg font-bold text-slate-800">{formatCurrency(goalMonthCC)}</div>
                            </div>
                            <div className="metric-mini-exec">
                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Meta Día CC</div>
                                <div className="text-lg font-bold text-slate-800">{formatCurrency(goalDailyCC)}</div>
                            </div>
                        </div>
                    </section>
                </div>
                <div className="lg:col-span-1">
                     <div className="glass-card p-6 h-full flex flex-col items-center justify-center relative overflow-hidden group hover:bg-white/90 transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-amber-500/20 transition-all"></div>
                        <div className="w-full text-center mb-4 relative z-10">
                            <h3 className="font-extrabold text-slate-800 flex items-center justify-center gap-2 text-sm">
                                <i className="ph-fill ph-chart-pie-slice text-amber-500 text-lg"></i>
                                Cuota de Mercado
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{metrics.currentYear}</p>
                        </div>
                        <div className="relative w-full aspect-square max-w-[200px] transition-transform duration-500 hover:scale-105 cursor-pointer">
                            <canvas ref={pieChartRef}></canvas>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center transition-all duration-300">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                        {hoveredAgent ? hoveredAgent.name : 'TOTAL'}
                                    </span>
                                    <span className={`block font-black text-slate-800 ${hoveredAgent ? 'text-xl text-amber-600 scale-110' : 'text-lg'}`}>
                                        {hoveredAgent ? formatCurrency(hoveredAgent.sales) : formatCurrency(totalSales)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
              
              <div className="glass-card overflow-hidden pb-6 mt-6">
                  <div className="p-6 bg-gradient-to-r from-white via-slate-50 to-white border-b border-slate-100">
                    <h2 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg justify-center md:justify-start">
                      <i className="ph-fill ph-medal text-amber-500 text-2xl"></i>
                      Ranking de Campeones ({metrics.currentYear})
                    </h2>
                  </div>
                  <div className="bg-slate-50/50 border-b border-slate-100 mb-4">
                      <Podium agents={processedAgents} />
                  </div>
                  <div className="overflow-x-auto px-6">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 py-4 font-black">Asesor</th>
                          <th className="px-4 py-4 font-black text-right">Venta Real</th>
                          <th className="px-4 py-4 font-black text-right">Brecha</th>
                          <th className="px-4 py-4 font-black text-center">Progreso</th>
                          <th className="px-4 py-4 font-black text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {processedAgents.map((agent, index) => {
                          const percentage = agent.percent * 100;
                          const standardPace = daysTotal > 0 ? (daysElapsed/daysTotal) : 0;
                          const isAhead = agent.percent >= standardPace;
                          const initials = getInitials(agent.name);
                          return (
                            <tr key={index} className="group transition-all hover:bg-slate-50">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-black text-xs flex items-center justify-center ring-2 ring-white shadow-sm">
                                    {initials}
                                  </div>
                                  <div>
                                     <span className="font-bold text-slate-700 block">{agent.name}</span>
                                     <span className="text-[10px] text-slate-400 font-bold uppercase">Puesto #{index+1}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right font-black text-slate-800 text-base">{formatCurrency(agent.sales)}</td>
                              <td className={`px-4 py-4 text-right font-bold ${agent.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {agent.diff >= 0 ? '+' : ''}{Math.round(agent.diff).toLocaleString('es-PA')}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                                    <div className={`h-2 rounded-full transition-all duration-1000 ${isAhead ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{width: `${Math.min(percentage, 100)}%`}}></div>
                                  </div>
                                  <span className="text-[9px] font-black text-slate-400">{percentage.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${isAhead ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                  <i className={`ph-fill ${isAhead ? 'ph-check-circle' : 'ph-warning-circle'}`}></i>
                                  {isAhead ? 'En Meta' : 'Fuera de Meta'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              <section className="glass-card p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                             <i className="ph-bold ph-chart-line-up text-2xl"></i>
                         </div>
                         <div>
                             <h3 className="text-lg font-extrabold text-slate-800">Ventas Diarias</h3>
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seguimiento Diario - <span className="text-amber-600">{metrics.currentMonthName}</span></p>
                         </div>
                    </div>
                    <div className="flex gap-4">
                        <div className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 ${growthPct >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                            <div className={`text-2xl ${growthPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <i className={`ph-fill ${growthPct >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`}></i>
                            </div>
                            <div>
                                <div className={`text-lg font-black ${growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {growthPct > 0 ? '+' : ''}{growthPct.toFixed(1)}%
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">vs Día Anterior</div>
                            </div>
                        </div>
                        <div className="px-5 py-2.5 rounded-2xl bg-white border border-slate-100 flex items-center gap-3 shadow-sm">
                             <div className="text-2xl text-amber-500 animate-pulse-slow">
                                <i className="ph-fill ph-trophy"></i>
                            </div>
                            <div>
                                <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                    {bestAgentToday.name.split(' ')[0]}
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500 font-bold">{formatCurrency(bestAgentToday.sales)}</span>
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">MVP del Día</div>
                            </div>
                        </div>
                    </div>
                  </div>
                  <div className="h-72 w-full relative"><canvas ref={lineChartRef}></canvas></div>
              </section>

              <div className="space-y-8 mt-8">
                {top3Categories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card overflow-hidden border-t-4 border-t-emerald-500">
                        <div className="p-4 border-b border-slate-100 bg-emerald-50/30 flex justify-between items-center">
                             <h3 className="font-bold text-emerald-900 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <i className="ph-fill ph-trophy text-emerald-500 text-lg"></i> Top Ventas (N2)
                             </h3>
                        </div>
                        <div className="p-2">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-50">
                                    {top3Categories.map((cat, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50/20">
                                            <td className="px-4 py-3 font-bold text-slate-700 text-xs">{cat.name}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{cat.quantity} und</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(cat.sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="glass-card overflow-hidden border-t-4 border-t-rose-500">
                        <div className="p-4 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center">
                             <h3 className="font-bold text-rose-900 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <i className="ph-fill ph-trend-down text-rose-500 text-lg"></i> Bajo Volumen (N2)
                             </h3>
                        </div>
                        <div className="p-2">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-50">
                                    {bottom3Categories.map((cat, idx) => (
                                        <tr key={idx} className="hover:bg-rose-50/20">
                                            <td className="px-4 py-3 font-bold text-slate-700 text-xs">{cat.name}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{cat.quantity} und</td>
                                            <td className="px-4 py-3 text-right font-bold text-rose-700">{formatCurrency(cat.sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                )}
                <div className="glass-card p-8 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400"></div>
                   <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-6 text-sm uppercase tracking-widest">
                      <i className="ph-fill ph-clock-counter-clockwise text-slate-400 text-lg"></i> Evolución Histórica
                   </h3>
                   <div className="h-48 w-full relative"><canvas ref={barChartRef}></canvas></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

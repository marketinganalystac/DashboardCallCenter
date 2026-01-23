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

const CircularProgress = ({ value, max, color = "text-amber-500", size = 80, strokeWidth = 8 }) => {
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
                <circle className="text-slate-100" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
                <circle className={`${color} transition-all duration-[1500ms] ease-out`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
            </svg>
            <div className="absolute text-xs font-black text-slate-700">
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
    
    return (
        <div className="flex items-end justify-center gap-2 md:gap-4 h-64 w-full pt-4">
            {top3.map((agent, index) => {
                let rank = 0;
                let colorClass = '';
                let icon = '';
                let delay = '';
                if (index === 1) { rank = 2; colorClass = 'from-indigo-400 to-indigo-600 shadow-indigo-500/30'; icon = 'ph-medal'; delay = 'delay-300'; }
                else if (index === 0) { rank = 1; colorClass = 'from-amber-400 to-amber-500 shadow-amber-500/40'; icon = 'ph-crown'; delay = 'delay-500'; }
                else { rank = 3; colorClass = 'from-slate-400 to-slate-500 shadow-slate-400/30'; icon = 'ph-medal'; delay = 'delay-700'; }
                
                const heightClass = index === 1 ? 'h-[75%]' : (index === 0 ? 'h-[90%]' : 'h-[60%]');
                const initials = getInitials(agent.name);

                return (
                    <div key={index} className={`flex flex-col items-center justify-end w-24 md:w-32 group ${heightClass} transition-transform hover:scale-105 duration-300`}>
                        <div className={`mb-3 flex flex-col items-center transition-all duration-700 opacity-0 animate-fade-in-down ${delay} fill-mode-forwards z-10`}>
                             <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 shadow-md flex items-center justify-center text-xs font-bold text-slate-600 mb-2">
                                {initials}
                             </div>
                            <div className="font-bold text-slate-700 text-xs md:text-sm text-center line-clamp-1 w-24">{agent.name.split(' ')[0]}</div>
                            <div className="font-black text-slate-900 text-xs md:text-sm bg-white/50 px-2 py-0.5 rounded-full backdrop-blur-sm mt-1 border border-white/40">
                                <AnimatedCounter value={agent.sales} prefix="$" />
                            </div>
                        </div>
                        <div className={`w-full h-full rounded-t-2xl bg-gradient-to-t ${colorClass} shadow-lg relative flex items-end justify-center pb-4 transition-all duration-1000 transform scale-y-0 animate-grow-up origin-bottom podium-bar`}>
                            <div className="absolute top-0 -mt-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center font-black text-slate-800 text-sm border-2 border-slate-50">
                                #{rank}
                            </div>
                            <i className={`ph-fill ${icon} text-white/30 text-4xl absolute bottom-3`}></i>
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
    <div className={`fixed top-6 right-6 z-[200] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in-down transition-all transform ${isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
      <i className={`ph-fill text-xl ${isError ? 'ph-warning-circle' : 'ph-check-circle'}`}></i>
      <span className="font-bold text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100"><i className="ph-bold ph-x"></i></button>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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

// Login simplificado y elegante
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
       <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[100px]"></div>
       </div>
      
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30 transform rotate-3">
             <i className="ph-bold ph-chart-polar text-white text-3xl transform -rotate-3"></i>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Tablero Directivo</h1>
          <p className="text-slate-400 text-sm">Inicia sesión para acceder a las métricas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-200 text-xs text-center">{error}</div>}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1">USUARIO</label>
            <div className="relative">
                <i className="ph-fill ph-user absolute left-3 top-3 text-slate-500"></i>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-amber-500 transition-colors" placeholder="ejemplo@empresa.com" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1">CONTRASEÑA</label>
             <div className="relative">
                <i className="ph-fill ph-lock-key absolute left-3 top-3 text-slate-500"></i>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-amber-500 transition-colors" placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]">{loading ? 'Cargando...' : (isRegistering ? 'Crear Cuenta' : 'Entrar al Tablero')}</button>
        </form>

        <div className="mt-8 flex flex-col gap-3">
           <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-xs">O continúa como</span>
                <div className="flex-grow border-t border-white/10"></div>
            </div>
           <button onClick={onLoginGuest} className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm font-medium transition-all flex items-center justify-center gap-2 hover:text-white">
             <i className="ph-bold ph-ghost"></i> Acceso Invitado
           </button>
           <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-xs text-slate-500 hover:text-amber-400 text-center mt-2 underline decoration-slate-700 underline-offset-4">{isRegistering ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Regístrate'}</button>
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
  
  // Sidebar toggle for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Lectura de datos
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

  // Scripts externos
  useEffect(() => {
    const tailwindConfigScript = document.createElement('script');
    tailwindConfigScript.text = `
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
            colors: { 
                slate: { 850: '#151F32', 900: '#0f172a' }, 
                indigo: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 900: '#312e81' },
                amber: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' } 
            },
            animation: {
              'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              'fade-in-down': 'fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              'grow-up': 'growUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              fadeInDown: { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
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
      loadScript("https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"),
      loadScript("https://unpkg.com/@phosphor-icons/web")
    ]).then(() => {
      if (window.Chart && window.ChartDataLabels) {
        window.Chart.register(window.ChartDataLabels);
      }
      updateCharts();
    });
  }, []);

  useEffect(() => {
    if (typeof Chart === 'undefined') return;
    if (view === 'dashboard') updateCharts();
  }, [metrics, view]);

  const updateCharts = () => {
    if (typeof Chart === 'undefined') return;
    
    // Configuración Global ChartJS
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = "#64748b";
    Chart.defaults.scale.grid.color = "#f1f5f9";

    // 1. PIE CHART (Ventas por Asesor - Año Actual)
    if (pieChartRef.current && metrics.agents.length > 0) {
      if (pieInstance.current) pieInstance.current.destroy();
      const processedAgents = [...metrics.agents].sort((a, b) => b.sales - a.sales);
      const ctxPie = pieChartRef.current.getContext('2d');
      pieInstance.current = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: processedAgents.map(a => a.name.split(' ')[0]),
          datasets: [{
            data: processedAgents.map(a => a.sales),
            backgroundColor: ['#4f46e5', '#f59e0b', '#0f172a', '#fbbf24', '#94a3b8', '#cbd5e1'],
            borderWidth: 0,
            hoverOffset: 10,
            borderRadius: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
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
          plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } }
        }
      });
    }

    // 2. BAR CHART (Evolución Histórica - ÚLTIMOS 3 AÑOS)
    if (barChartRef.current && metrics.annual.length > 0) {
      if (barInstance.current) barInstance.current.destroy();
      
      // Filtrar últimos 3 años explícitamente
      let sortedYears = [...metrics.annual].sort((a, b) => a.year - b.year);
      if (sortedYears.length > 3) sortedYears = sortedYears.slice(-3);
      
      const yearsLabels = sortedYears.map(y => y.year);
      
      // Construir datasets dinámicos por agente
      const allAgentsSet = new Set();
      sortedYears.forEach(yearData => {
          if (yearData.agents) Object.keys(yearData.agents).forEach(agent => allAgentsSet.add(agent));
      });
      const allAgents = Array.from(allAgentsSet);
      
      const colors = ['#4f46e5', '#f59e0b', '#1e293b', '#fbbf24', '#94a3b8', '#6366f1'];
      const datasets = [];
      
      allAgents.forEach((agent, index) => {
          const data = sortedYears.map(yearData => yearData.agents ? (yearData.agents[agent] || 0) : 0);
          datasets.push({
              label: agent.split(' ')[0],
              data: data,
              backgroundColor: colors[index % colors.length],
              borderRadius: 4,
              barThickness: 30,
              maxBarThickness: 40,
          });
      });
      
      // Datos sin desglose (legacy)
      const unknownData = sortedYears.map(yearData => !yearData.agents ? yearData.total : 0);
      if (unknownData.some(v => v > 0)) {
           datasets.push({ label: 'Otros', data: unknownData, backgroundColor: '#e2e8f0', borderRadius: 4, barThickness: 30 });
      }

      // Meta Lineal
      const annualGoal = 15000 * 12;
      datasets.push({
          label: 'Meta Anual',
          data: sortedYears.map(() => annualGoal),
          type: 'line',
          borderColor: '#e11d48',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 0,
          datalabels: { display: false } // No mostrar label en la linea
      });

      const ctxBar = barChartRef.current.getContext('2d');
      barInstance.current = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: yearsLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, stacked: false, grid: { borderDash: [4, 4], drawBorder: false }, ticks: { callback: v => '$' + v/1000 + 'k', font: {size: 10} }, border: { display: false } },
            x: { stacked: false, grid: { display: false }, ticks: { font: {weight: 'bold'} } }
          },
          plugins: { 
              legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 6, font: {size: 11} } },
              datalabels: {
                anchor: 'end',
                align: 'end',
                font: { size: 10, weight: 'bold' },
                formatter: (value) => '$' + (value / 1000).toFixed(0) + 'k',
                color: '#64748b'
              },
              tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  titleFont: { family: 'Plus Jakarta Sans', size: 13 },
                  bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
                  padding: 10,
                  cornerRadius: 8,
                  displayColors: true,
                  callbacks: {
                      label: (context) => {
                          let label = context.dataset.label || '';
                          if (label) label += ': ';
                          label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                          return label;
                      }
                  }
              }
          }
        }
      });
    }

    // 3. LINE CHART (Ventas Diarias - Mes Actual)
    if (lineChartRef.current && metrics.daily.length > 0) {
        if (lineInstance.current) lineInstance.current.destroy();
        const dailyDataPoints = metrics.daily; 
        const labels = dailyDataPoints.map(d => parseInt(d.date.split('-')[2])); // Solo el día
        const dataValues = dailyDataPoints.map(d => d.total);
        
        const ctxLine = lineChartRef.current.getContext('2d');
        const gradient = ctxLine.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.2)'); // Indigo
        gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');

        lineInstance.current = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Venta',
                    data: dataValues,
                    borderColor: '#4f46e5',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#4f46e5',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#f1f5f9' }, ticks: { callback: v => '$' + (v/1000) + 'k', font: {size: 10} } },
                    x: { grid: { display: false }, ticks: { font: {size: 10} } }
                },
                plugins: { 
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 10,
                        callbacks: {
                            label: (context) => new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y)
                        }
                    }
                }
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
        
        // Mapeo Inteligente de Columnas
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
        if (colIndices.name === -1 || colIndices.sales === -1 || colIndices.date === -1) throw new Error("Faltan columnas requeridas (Asesor, Venta, Fecha)");

        // Estructuras de Datos
        const annualMap = new Map();
        // Cargar histórico existente para no perderlo
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

        // Primera Pasada: Detectar Años y Fecha Máxima
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
        
        // Inicializar años nuevos detectados en el mapa anual
        yearsInFile.forEach(y => {
            if (!annualMap.has(y)) annualMap.set(y, { total: 0, agents: {} });
        });

        // Configurar "Año Actual" basado en los datos (El año más reciente del archivo)
        const maxDate = maxDateTimestamp > 0 ? new Date(maxDateTimestamp) : new Date();
        const currentYear = maxDate.getFullYear();
        const currentMonth = maxDate.getMonth();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const currentMonthName = monthNames[currentMonth];

        // Segunda Pasada: Procesar Datos
        for(let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[colIndices.name]) continue;
          
          // Limpieza de valor venta
          let salesVal = 0;
          const rawSales = row[colIndices.sales];
          if (typeof rawSales === 'number') salesVal = rawSales;
          else if (typeof rawSales === 'string') salesVal = parseFloat(rawSales.replace(/[^0-9.-]+/g,"")) || 0;
          
          // Limpieza fecha
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
          
          // Guardar Raw Data (limitado)
          if (rawDataArray.length < 2000) {
              const rawCat = colIndices.category !== -1 ? String(row[colIndices.category] || "-").trim() : "-";
              const rawQty = colIndices.quantity !== -1 ? (row[colIndices.quantity] || 0) : 0;
              rawDataArray.push({ date: dateStr, agent: rawName, sales: salesVal, category: rawCat, quantity: rawQty });
          }

          // 1. Acumular en Histórico (Todos los años)
          const annualEntry = annualMap.get(year);
          if (annualEntry) {
              annualEntry.total += salesVal;
              // Acumular por agente dentro del histórico anual
              const agentKey = rawName; 
              annualEntry.agents[agentKey] = (annualEntry.agents[agentKey] || 0) + salesVal;
              annualMap.set(year, annualEntry);
          }

          // 2. Acumular SOLO si es el año/mes actual para el dashboard operativo
          if (year === currentYear) {
              // Métricas por Asesor (Año Actual)
              const nameKey = rawName.toLowerCase();
              if (agentsMap.has(nameKey)) {
                const existing = agentsMap.get(nameKey);
                existing.sales += salesVal;
                agentsMap.set(nameKey, existing);
              } else {
                agentsMap.set(nameKey, { name: rawName, sales: salesVal });
              }
              
              // Categorías (Año Actual)
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

              // Métricas Diarias (Mes Actual)
              if (month === currentMonth) {
                  dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + salesVal);
                  
                  // Para calcular el MVP del día
                  if (!dailyAgentSalesMap.has(dateStr)) dailyAgentSalesMap.set(dateStr, new Map());
                  const dayAgentMap = dailyAgentSalesMap.get(dateStr);
                  dayAgentMap.set(nameKey, (dayAgentMap.get(nameKey) || 0) + salesVal);
              }
          }
        }

        // Convertir Mapas a Arrays
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

        // Finalizar
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
            showNotification(`✅ Datos actualizados. Año visualizado: ${currentYear}`);
        }
      } catch (err) { showNotification("Error al procesar: " + err.message, 'error'); } 
      finally { setIsUploading(false); setPendingFile(null); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmReplace = () => { setShowConfirmModal(false); if (pendingFile) processFile(pendingFile); };
  const cancelReplace = () => { setShowConfirmModal(false); setPendingFile(null); };

  // Cálculos de KPIs
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

  let lastDaySales = 0, growthPct = 0, bestAgentToday = { name: 'N/A', sales: 0 };
  if (metrics.daily.length > 0) {
      const nonEmpty = metrics.daily.filter(d => d.total > 0);
      if (nonEmpty.length > 0) {
          const last = nonEmpty[nonEmpty.length - 1];
          lastDaySales = last.total;
          bestAgentToday = last.bestAgent || { name: 'N/A', sales: 0 };
          if (nonEmpty.length > 1) {
              const prev = nonEmpty[nonEmpty.length - 2];
              if (prev.total > 0) growthPct = ((last.total - prev.total) / prev.total) * 100;
          }
      }
  }

  // Estilos CSS Base
  const customStyles = `
    :root { --sidebar-w: 260px; }
    body { background-color: #f8fafc; color: #1e293b; overflow-x: hidden; }
    .glass-panel { background: white; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02); }
    .glass-panel-dark { background: #1e293b; border: 1px solid #334155; color: white; }
    .sidebar-link { display: flex; items-center; gap: 12px; padding: 12px 16px; border-radius: 12px; font-weight: 600; font-size: 14px; transition: all 0.2s; color: #94a3b8; }
    .sidebar-link:hover { background: rgba(255,255,255,0.05); color: white; }
    .sidebar-link.active { background: #4f46e5; color: white; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }
    .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .podium-bar { position: relative; overflow: hidden; }
    .podium-bar::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%); transform: skewX(-20deg) translateX(-150%); transition: transform 0.5s; }
    .podium-bar:hover::after { transform: skewX(-20deg) translateX(150%); transition: transform 1s; }
    .metric-mini { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; transition: all 0.2s; }
    .metric-mini:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-color: #cbd5e1; }
  `;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><i className="ph ph-spinner animate-spin text-amber-500 text-4xl"></i></div>;
  if (!user) return <><style>{customStyles}</style><Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} /><LoginScreen onLoginGuest={handleLoginGuest} onLoginEmail={handleLoginEmail} /></>;

  return (
    <div className="flex min-h-screen font-sans">
      <style>{customStyles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {isUploading && <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center"><i className="ph ph-spinner animate-spin text-white text-4xl mb-4"></i><p className="text-white font-bold">Procesando archivo...</p></div>}
      <ConfirmModal isOpen={showConfirmModal} title="Actualizar Datos" message="Se detectaron datos nuevos. ¿Deseas fusionarlos con el historial existente?" onCancel={cancelReplace} onConfirm={confirmReplace} />
      <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 shadow-2xl flex flex-col`}>
         <div className="p-6 border-b border-slate-800 flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                 <i className="ph-bold ph-chart-polar text-xl"></i>
             </div>
             <div>
                 <h1 className="font-bold text-white text-lg leading-tight">DashBoard</h1>
                 <p className="text-xs text-slate-400">Call Center Analytics</p>
             </div>
         </div>

         <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
             <button onClick={() => setView('dashboard')} className={`sidebar-link w-full ${view === 'dashboard' ? 'active' : ''}`}>
                 <i className="ph-bold ph-squares-four text-lg"></i> Resumen General
             </button>
             <button onClick={() => setView('data')} className={`sidebar-link w-full ${view === 'data' ? 'active' : ''}`}>
                 <i className="ph-bold ph-database text-lg"></i> Base de Datos
             </button>
             
             <div className="pt-6 pb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</div>
             <label className="sidebar-link w-full cursor-pointer hover:bg-slate-800">
                 <i className="ph-bold ph-file-arrow-up text-lg text-amber-500"></i> Importar Excel
                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls, .csv" className="hidden" />
             </label>
         </nav>

         <div className="p-4 border-t border-slate-800">
             <div className="bg-slate-800 rounded-xl p-4 mb-4">
                 <p className="text-xs text-slate-400 mb-1">Año Fiscal Actual</p>
                 <p className="text-xl font-bold text-white">{metrics.currentYear || '---'}</p>
             </div>
             <button onClick={handleLogout} className="flex items-center gap-2 text-rose-400 hover:text-rose-300 text-sm font-bold w-full p-2 rounded-lg hover:bg-rose-500/10 transition-colors">
                 <i className="ph-bold ph-sign-out"></i> Cerrar Sesión
             </button>
         </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 bg-slate-50/50 relative">
        {/* MOBILE HEADER */}
        <div className="lg:hidden p-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-40">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-600 text-2xl"><i className="ph-bold ph-list"></i></button>
            <span className="font-bold text-slate-800">Tablero Directivo</span>
            <div className="w-8"></div>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
           
           {metrics.agents.length === 0 ? (
             <div className="h-[80vh] flex flex-col justify-center items-center text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 animate-bounce">
                    <i className="ph-duotone ph-file-xls text-amber-500 text-5xl"></i>
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Comencemos</h2>
                <p className="text-slate-500 max-w-md mb-8">No hay datos cargados para el periodo actual. Sube tu reporte de ventas para generar el tablero.</p>
                <label className="cursor-pointer px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 transform hover:scale-105">
                    <i className="ph-bold ph-upload-simple"></i> Cargar Excel
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" />
                </label>
             </div>
           ) : view === 'data' ? (
              // VISTA DE DATOS
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="glass-panel p-6 h-fit">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><i className="ph-fill ph-clock-counter-clockwise text-amber-500"></i> Historial Anual</h3>
                      <div className="space-y-3">
                        {metrics.annual.sort((a,b) => b.year - a.year).map((item) => (
                            <div key={item.year} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-900 bg-slate-200 px-2 py-1 rounded text-xs">{item.year}</span>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Venta Total</span>
                                        <span className="font-bold text-slate-800">{formatCurrency(item.total)}</span>
                                    </div>
                                </div>
                                <button onClick={() => { if(window.confirm(`Eliminar ${item.year}?`)) deleteYear(item.year); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"><i className="ph-bold ph-trash"></i></button>
                            </div>
                        ))}
                      </div>
                  </div>
                  <div className="lg:col-span-2 glass-panel p-0 overflow-hidden flex flex-col max-h-[85vh]">
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                          <h3 className="font-bold text-slate-800">Raw Data ({metrics.rawData.length})</h3>
                          <span className="text-xs font-medium text-slate-400">Últimos 2000 registros</span>
                      </div>
                      <div className="overflow-auto custom-scroll flex-1 p-0">
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                  <tr>
                                      <th className="px-6 py-3">Fecha</th>
                                      <th className="px-6 py-3">Asesor</th>
                                      <th className="px-6 py-3 text-right">Venta</th>
                                      <th className="px-6 py-3">Categoría</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {metrics.rawData.map((row, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-6 py-3 text-slate-600 font-medium whitespace-nowrap">{row.date}</td>
                                          <td className="px-6 py-3 text-slate-800 font-bold">{row.agent}</td>
                                          <td className="px-6 py-3 text-right font-mono text-emerald-600 bg-emerald-50/30">{formatCurrency(row.sales)}</td>
                                          <td className="px-6 py-3 text-slate-500">{row.category}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
           ) : (
             // DASHBOARD PRINCIPAL (Bento Grid)
             <div className="space-y-6">
                
                {/* Header Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* KPI 1: Cumplimiento Global */}
                    <div className="glass-panel p-5 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                             <div>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Ventas</p>
                                 <h3 className="text-2xl font-black text-slate-800 tracking-tight"><AnimatedCounter value={totalSales} prefix="$" /></h3>
                             </div>
                             <div className={`p-2 rounded-lg ${isCCAhead ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                 <i className={`ph-bold ${isCCAhead ? 'ph-trend-up' : 'ph-trend-down'} text-xl`}></i>
                             </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                             <CircularProgress value={totalSales} max={goalCCToday} size={40} strokeWidth={4} color={isCCAhead ? 'text-emerald-500' : 'text-rose-500'} />
                             <div className="flex flex-col">
                                 <span className="text-xs font-bold text-slate-700">Meta al Día</span>
                                 <span className="text-[10px] text-slate-400">{formatCurrency(goalCCToday)}</span>
                             </div>
                        </div>
                    </div>

                    {/* KPI 2: Proyección */}
                    <div className="glass-panel p-5 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                         <div className="flex justify-between items-start mb-4">
                             <div>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Proyección Cierre</p>
                                 <h3 className="text-2xl font-black text-indigo-600 tracking-tight"><AnimatedCounter value={daysElapsed > 0 ? (totalSales / daysElapsed * daysTotal) : 0} prefix="$" /></h3>
                             </div>
                             <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                 <i className="ph-bold ph-chart-line-up text-xl"></i>
                             </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full animate-grow-up origin-left" style={{width: '65%'}}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Basado en promedio diario actual</p>
                    </div>

                     {/* KPI 3: Saldo Pendiente (RESTAURADO) */}
                     <div className="glass-panel p-5 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                         <div className="flex justify-between items-start mb-2">
                             <div>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Pendiente</p>
                                 <h3 className="text-2xl font-black text-slate-800 tracking-tight"><AnimatedCounter value={Math.max(0, goalMonthCC - totalSales)} prefix="$" /></h3>
                             </div>
                             <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                 <i className="ph-bold ph-hourglass-high text-xl"></i>
                             </div>
                        </div>
                         <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>Meta Mes: {formatCurrency(goalMonthCC)}</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{daysTotal - daysElapsed} días rest.</span>
                        </div>
                    </div>

                     {/* KPI 4: Top Performer */}
                     <div className="bg-slate-900 text-white rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-slate-900/10">
                         <div className="absolute top-0 right-0 p-8 bg-white/5 rounded-full blur-2xl -mr-4 -mt-4"></div>
                         <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="ph-fill ph-trophy text-amber-500"></i>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">MVP del Día</p>
                            </div>
                            <h3 className="text-xl font-bold mb-1">{bestAgentToday.name.split(' ')[0]}</h3>
                            <div className="inline-block bg-white/10 px-3 py-1 rounded-lg border border-white/10 text-sm font-bold text-amber-400">
                                {formatCurrency(bestAgentToday.sales)}
                            </div>
                         </div>
                    </div>
                </div>

                {/* Control Strip (RESTAURADO) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="metric-mini">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ritmo Esperado</p>
                        <p className="text-lg font-black text-amber-500">{(targetPercentToday * 100).toFixed(0)}%</p>
                    </div>
                     <div className="metric-mini">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Mes Agente</p>
                        <p className="text-lg font-black text-slate-700">{formatCurrency(goalMonthAgent)}</p>
                    </div>
                     <div className="metric-mini">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Día Agente</p>
                        <p className="text-lg font-black text-slate-700">{formatCurrency(goalDailyAgent)}</p>
                    </div>
                     <div className="metric-mini">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Día CC</p>
                        <p className="text-lg font-black text-slate-700">{formatCurrency(goalDailyCC)}</p>
                    </div>
                </div>

                {/* Main Grid: Charts & Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Columna Izquierda (2/3): Gráficas */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Fila: Evolución y Market Share */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="glass-panel p-6 flex flex-col justify-between min-h-[300px]">
                                 <div className="mb-4">
                                     <h3 className="font-bold text-slate-800 flex items-center gap-2"><i className="ph-fill ph-clock-counter-clockwise text-indigo-500"></i> Evolución (3 Años)</h3>
                                     <p className="text-xs text-slate-400">Comparativo histórico de ventas</p>
                                 </div>
                                 <div className="flex-1 w-full relative">
                                     <canvas ref={barChartRef}></canvas>
                                 </div>
                             </div>

                             <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[300px] relative">
                                <div className="absolute top-6 left-6">
                                     <h3 className="font-bold text-slate-800 flex items-center gap-2"><i className="ph-fill ph-chart-pie-slice text-amber-500"></i> Distribución {metrics.currentYear}</h3>
                                </div>
                                <div className="w-[200px] h-[200px] relative mt-8">
                                    <canvas ref={pieChartRef}></canvas>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">{hoveredAgent ? hoveredAgent.name : 'TOTAL'}</span>
                                        <span className="text-lg font-black text-slate-800">{hoveredAgent ? formatCurrency(hoveredAgent.sales) : formatCurrency(totalSales)}</span>
                                    </div>
                                </div>
                             </div>
                        </div>
                        
                        {/* Tabla de Asesores */}
                        <div className="glass-panel overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><i className="ph-fill ph-users-three text-slate-400"></i> Detalle por Asesor</h3>
                                <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Meta Indv: {formatCurrency(goalMonthAgent)}</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-extrabold">
                                        <tr>
                                            <th className="px-6 py-4">Asesor</th>
                                            <th className="px-6 py-4 text-center">Progreso</th>
                                            <th className="px-6 py-4 text-right">Venta</th>
                                            <th className="px-6 py-4 text-right">Brecha</th>
                                            <th className="px-6 py-4 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {processedAgents.map((agent, idx) => {
                                            const pct = Math.min(agent.percent * 100, 100);
                                            const isAhead = agent.percent >= paceRatio;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">{getInitials(agent.name)}</span>
                                                        {agent.name.split(' ')[0]}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${isAhead ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{width: `${pct}%`}}></div>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-400 w-8">{pct.toFixed(0)}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-slate-800">{formatCurrency(agent.sales)}</td>
                                                    <td className={`px-6 py-4 text-right font-bold text-xs ${agent.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                        {agent.diff > 0 ? '+' : ''}{formatCurrency(agent.diff)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {isAhead 
                                                            ? <i className="ph-fill ph-check-circle text-emerald-500 text-lg"></i>
                                                            : <i className="ph-fill ph-warning-circle text-amber-500 text-lg"></i>
                                                        }
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Columna Derecha (1/3): Ranking y Categorías */}
                    <div className="space-y-6">
                        
                        {/* Podium */}
                        <div className="glass-panel p-6 bg-gradient-to-b from-white to-slate-50 border-indigo-100 border text-center">
                            <h3 className="font-extrabold text-slate-800 mb-6 uppercase tracking-wider text-xs">Ranking de Campeones</h3>
                            <Podium agents={processedAgents} />
                        </div>
                        
                        {/* Gráfica Lineal Mini */}
                        <div className="glass-panel p-6">
                             <div className="mb-4 flex items-center justify-between">
                                 <h3 className="font-bold text-slate-800 text-sm">Tendencia Mensual</h3>
                                 <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">Venta Diaria</span>
                             </div>
                             <div className="h-32 w-full relative">
                                 <canvas ref={lineChartRef}></canvas>
                             </div>
                        </div>

                        {/* Top Categorias */}
                        {top3Categories.length > 0 && (
                            <div className="glass-panel overflow-hidden">
                                <div className="p-4 border-b border-slate-100 font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <i className="ph-fill ph-tag text-slate-400"></i> Top Categorías
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {top3Categories.map((cat, i) => (
                                        <div key={i} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50">
                                            <span className="text-slate-600 font-medium truncate max-w-[120px]" title={cat.name}>{cat.name}</span>
                                            <span className="font-bold text-slate-800">{formatCurrency(cat.sales)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

             </div>
           )}
        </div>
      </main>
    </div>
  );
}

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

// --- COMPONENTES UI ANIMADOS ---

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

    return (
        <span>{prefix}{count.toLocaleString('es-PA')}</span>
    );
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
                <circle 
                    className={`${color} transition-all duration-[1500ms] ease-out`} 
                    strokeWidth={strokeWidth} 
                    strokeDasharray={circumference} 
                    strokeDashoffset={offset} 
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r={radius} 
                    cx={size / 2} 
                    cy={size / 2} 
                />
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
        <div className="flex items-end justify-center gap-2 md:gap-4 h-64 w-full pt-8 pb-0">
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
                
                const realHeightPct = (agent.sales / maxSales) * 100;
                const visualHeight = index === 1 ? 'h-[90%]' : (index === 0 ? 'h-[75%]' : 'h-[60%]');

                return (
                    <div key={index} className={`flex flex-col items-center justify-end w-24 md:w-32 group ${visualHeight} transition-transform hover:scale-105 duration-300`}>
                        
                        <div className={`mb-2 flex flex-col items-center transition-all duration-700 opacity-0 animate-fade-in-down ${delay} fill-mode-forwards`}>
                            <div className="font-bold text-slate-700 text-xs md:text-sm text-center line-clamp-1 mb-1">{agent.name.split(' ')[0]}</div>
                            <div className="font-black text-slate-900 text-sm md:text-base"><AnimatedCounter value={agent.sales} prefix="$" /></div>
                        </div>

                        <div className={`w-full h-full rounded-t-2xl bg-gradient-to-t ${colorClass} shadow-lg relative flex items-end justify-center pb-4 transition-all duration-1000 transform scale-y-0 animate-grow-up origin-bottom podium-bar`}>
                             <div className="absolute -top-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border-4 border-slate-50 shadow-md flex items-center justify-center z-10">
                                <span className={`font-black ${index === 1 ? 'text-amber-500' : (index === 0 ? 'text-slate-500' : 'text-orange-500')}`}>#{rank}</span>
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
              shine: {
                '0%': { transform: 'translateX(-100%) skewX(-30deg)' },
                '100%': { transform: 'translateX(400%) skewX(-30deg)' }
              }
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
    
    // --- PIE CHART ---
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
          plugins: { 
              legend: { display: false },
              tooltip: { enabled: false }
          }
        }
      });
    }

    // --- BAR CHART (Evolución Histórica) - CORREGIDO A COLUMNAS AGRUPADAS (NO APILADAS) ---
    if (barChartRef.current) {
      if (barInstance.current) barInstance.current.destroy();
      
      // Últimos 3 años (como solicitado)
      let sortedYears = [...metrics.annual].sort((a, b) => a.year - b.year);
      if (sortedYears.length > 3) sortedYears = sortedYears.slice(-3);
      const yearsLabels = sortedYears.map(y => y.year);
      
      const allAgentsSet = new Set();
      sortedYears.forEach(yearData => {
          if (yearData.agents) {
              Object.keys(yearData.agents).forEach(agent => allAgentsSet.add(agent));
          }
      });
      const allAgents = Array.from(allAgentsSet);
      
      const colors = ['#0f172a', '#f59e0b', '#334155', '#fbbf24', '#94a3b8', '#64748b', '#d97706', '#475569'];
      
      const datasets = [];

      allAgents.forEach((agent, index) => {
          const data = sortedYears.map(yearData => {
              return yearData.agents ? (yearData.agents[agent] || 0) : 0;
          });
          
          datasets.push({
              label: agent.split(' ')[0],
              data: data,
              backgroundColor: colors[index % colors.length],
              borderRadius: 4,
              barThickness: 28, // Agrupadas más anchas
          });
      });

      const unknownData = sortedYears.map(yearData => {
          return !yearData.agents ? yearData.total : 0;
      });
      
      if (unknownData.some(v => v > 0)) {
           datasets.push({
              label: 'Sin Desglose',
              data: unknownData,
              backgroundColor: '#cbd5e1',
              borderRadius: 4,
              barThickness: 28,
          });
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
        data: {
          labels: yearsLabels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { 
                beginAtZero: true, 
                stacked: false, // NO APILADO
                grid: { color: '#f1f5f9', drawBorder: false }, 
                ticks: { callback: v => '$' + v/1000 + 'k', font: {size: 10} }, 
                border: { display: false } 
            },
            x: { 
                stacked: false, // NO APILADO
                grid: { display: false }, 
                ticks: { font: {weight: 'bold'} } 
            }
          },
          plugins: { 
              legend: { 
                  display: true,
                  position: 'bottom',
                  labels: { usePointStyle: true, boxWidth: 8, font: {size: 10} }
              },
              tooltip: {
                  callbacks: {
                      label: (context) => {
                          let label = context.dataset.label || '';
                          if (label) label += ': ';
                          if (context.parsed.y !== null) {
                              label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                          }
                          return label;
                      }
                  }
              }
          }
        }
      });
    }

    // --- LINE CHART (Ventas Diarias) - VERSIÓN MÁS GRÁFICA Y DINÁMICA (barras + línea acumulada) ---
    if (lineChartRef.current) {
        if (lineInstance.current) lineInstance.current.destroy();
        const dailyDataPoints = metrics.daily; 
        const labels = dailyDataPoints.map(d => parseInt(d.date.split('-')[2]));
        const dataValues = dailyDataPoints.map(d => d.total);
        
        // Calcular acumulado para línea dinámica
        let cumulative = [];
        let sum = 0;
        dataValues.forEach(val => {
          sum += val;
          cumulative.push(sum);
        });

        const growthRates = dataValues.map((val, i) => {
            if (i === 0) return 0;
            const prev = dataValues[i-1];
            return prev === 0 ? 0 : ((val - prev) / prev) * 100;
        });

        const ctxLine = lineChartRef.current.getContext('2d');
        
        const barGradient = ctxLine.createLinearGradient(0, 0, 0, 300);
        barGradient.addColorStop(0, 'rgba(245, 158, 11, 0.7)');
        barGradient.addColorStop(1, 'rgba(245, 158, 11, 0.2)');

        lineInstance.current = new Chart(ctxLine, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                  {
                    label: 'Ventas Diarias',
                    data: dataValues,
                    type: 'bar',
                    backgroundColor: barGradient,
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 6,
                    barThickness: 22,
                    order: 2
                  },
                  {
                    label: 'Acumulado',
                    data: cumulative,
                    type: 'line',
                    borderColor: '#1e40af',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.25,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#1e40af',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    yAxisID: 'y2',
                    order: 1
                  }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { 
                      beginAtZero: true, 
                      position: 'left',
                      grid: { color: '#f1f5f9' },
                      ticks: { callback: v => '$' + (v/1000) + 'k', font: {size: 10} }
                    },
                    y2: { 
                      beginAtZero: true, 
                      position: 'right', 
                      grid: { drawOnChartArea: false },
                      ticks: { callback: v => '$' + (v/1000) + 'k', font: {size: 10} }
                    },
                    x: { grid: { display: false }, ticks: { font: {size: 10} } }
                },
                plugins: { 
                    legend: { display: true, position: 'top', align: 'start', labels: { boxWidth: 10, font: {size: 11} } },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label + ': ';
                                label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                return label;
                            }
                        }
                    }
                },
                animation: {
                  duration: 1400,
                  easing: 'easeOutQuart'
                }
            }
        });
    }
  };

  // ... (el resto de funciones handleFileSelect, processFile, deleteYear, confirmReplace, cancelReplace, cálculos KPI permanecen iguales - NO MODIFICADOS)

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
    
    /* Shine effect para podium más dinámico */
    .podium-bar {
      position: relative;
      overflow: hidden;
    }
    .podium-bar::after {
      content: '';
      position: absolute;
      top: -100%;
      left: -50%;
      width: 40%;
      height: 200%;
      background: linear-gradient(
        to right,
        transparent 0%,
        rgba(255,255,255,0.9) 50%,
        transparent 100%
      );
      transform: skewX(-30deg);
      animation: shine 4s linear infinite;
    }
    @keyframes shine {
      0% { transform: translateX(-100%) skewX(-30deg); }
      100% { transform: translateX(400%) skewX(-30deg); }
    }
  `;

  // ... (resto del return permanece igual excepto el reordenamiento solicitado)

  return (
    <>
      <style>{customStyles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      {isUploading && <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center"><i className="ph ph-spinner animate-spin text-white text-4xl mb-4"></i><p className="text-white font-bold">Procesando...</p></div>}
      <ConfirmModal isOpen={showConfirmModal} title="Actualizar Datos" message="Se detectaron datos nuevos. ¿Deseas fusionarlos con el historial existente?" onCancel={cancelReplace} onConfirm={confirmReplace} />
      <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="p-4 lg:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header sin cambios */}

          {metrics.agents.length === 0 ? (
             // ... vacío sin cambios
          ) : view === 'data' ? (
              // ... vista data sin cambios
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* KPIs y Pie sin cambios */}
              </div>
              
              {/* Ranking de Campeones (sin cambios en estructura, solo más vida vía CSS shine y hover scale) */}
              <div className="glass-card overflow-hidden pb-6 mt-6">
                {/* ... contenido podium y tabla igual */}
              </div>

              {/* Ventas Diarias - Movido debajo de Ranking (como solicitado) */}
              <section className="glass-card p-6">
                  {/* Header y contenido igual, pero ahora con chart más dinámico (barras + acumulado) */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    {/* ... igual */}
                  </div>
                  <div className="h-72 w-full relative"><canvas ref={lineChartRef}></canvas></div> {/* Altura aumentada para mejor visual */}
              </section>

              {/* Categorías y Evolución Histórica (Evolución ahora agrupada en panel inferior, espacio optimizado) */}
              <div className="space-y-8 mt-8">
                {/* Categorías grid igual */}
                {top3Categories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ... */}
                </div>
                )}
                {/* Evolución Histórica - ahora en columnas agrupadas */}
                <div className="glass-card p-8 relative overflow-hidden">
                   {/* ... header igual */}
                   <div className="h-48 w-full relative"><canvas ref={barChartRef}></canvas></div> {/* Altura reducida para aprovechar espacio */}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

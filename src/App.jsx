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
        <div className="relative flex items-center justify-center drop-shadow-lg" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle className="text-slate-100" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
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
    
    return (
        <div className="flex items-end justify-center gap-2 md:gap-4 h-80 w-full pt-0 pb-0">
            {top3.map((agent, index) => {
                let rank = 0;
                let colorClass = '';
                let icon = '';
                let delay = '';
                
                // Configuración visual basada en el ranking (Oro, Plata, Bronce)
                if (index === 1) { 
                    rank = 1; 
                    colorClass = 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 shadow-amber-500/40 ring-4 ring-yellow-100/50'; 
                    icon = 'ph-crown'; 
                    delay = 'delay-300'; 
                } else if (index === 0) { 
                    rank = 2; 
                    colorClass = 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 shadow-slate-400/40'; 
                    icon = 'ph-medal'; 
                    delay = 'delay-500'; 
                } else { 
                    rank = 3; 
                    colorClass = 'bg-gradient-to-b from-orange-200 via-orange-300 to-orange-400 shadow-orange-400/40'; 
                    icon = 'ph-medal'; 
                    delay = 'delay-700'; 
                }
                
                const visualHeight = index === 1 ? 'h-[90%]' : (index === 0 ? 'h-[75%]' : 'h-[60%]');
                
                return (
                    <div key={index} className={`flex flex-col items-center justify-end w-24 md:w-32 group ${visualHeight} transition-transform hover:-translate-y-2 duration-300`}>
                        <div className={`mb-3 flex flex-col items-center transition-all duration-700 opacity-0 animate-fade-in-down ${delay} fill-mode-forwards`}>
                            <div className="font-bold text-slate-600 text-xs md:text-sm text-center line-clamp-1 mb-1 tracking-tight">{agent.name.split(' ')[0]}</div>
                            <div className="px-3 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 shadow-sm font-black text-slate-900 text-xs md:text-sm"><AnimatedCounter value={agent.sales} prefix="$" /></div>
                        </div>
                        <div className={`w-full h-full rounded-t-3xl shadow-2xl relative flex items-end justify-center pb-4 transition-all duration-1000 transform scale-y-0 animate-grow-up origin-bottom podium-bar ${colorClass}`}>
                             {/* Efecto de brillo interior */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-t-3xl pointer-events-none"></div>
                            
                            <div className="absolute -top-6 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border-4 border-white/50 shadow-xl flex items-center justify-center z-20">
                                <span className={`font-black text-lg md:text-xl ${index === 1 ? 'text-amber-500' : (index === 0 ? 'text-slate-500' : 'text-orange-500')}`}>#{rank}</span>
                            </div>
                            <i className={`ph-fill ${icon} text-white/50 text-5xl absolute bottom-4 mix-blend-overlay`}></i>
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
    <div className={`fixed top-6 right-6 z-[100] p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-fade-in-down transition-all transform hover:scale-105 backdrop-blur-md ${isError ? 'bg-rose-50/90 border-rose-200 text-rose-800' : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'}`}>
      <div className={`p-2 rounded-full ${isError ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
         <i className={`ph-fill text-xl ${isError ? 'ph-warning-circle' : 'ph-check-circle'}`}></i>
      </div>
      <span className="font-bold text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 rounded-full hover:bg-black/5 transition-colors"><i className="ph-bold ph-x"></i></button>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white/50 animate-scale-in">
        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-lg shadow-amber-500/20 mx-auto">
          <i className="ph-fill ph-warning-octagon"></i>
        </div>
        <h3 className="text-xl font-extrabold text-slate-800 mb-2 text-center">{title}</h3>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed text-center">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-6 py-3 text-slate-600 hover:bg-slate-100 font-bold rounded-xl text-sm transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105">Sí, actualizar</button>
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-amber-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
          <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute top-[30%] left-[20%] w-32 h-32 bg-purple-500/20 rounded-full blur-[40px] animate-float"></div>
      </div>
      
      <div className="glass-card w-full max-w-md p-10 relative z-10 bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl ring-1 ring-white/10 relative group">
             <div className="absolute inset-0 bg-amber-500/20 blur-xl group-hover:bg-amber-500/40 transition-all rounded-3xl"></div>
             <i className="ph-fill ph-chart-polar text-amber-500 text-4xl relative z-10"></i>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Bienvenido</h1>
          <p className="text-slate-400 text-sm font-medium">Acceso al Tablero Directivo</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-200 text-xs text-center font-medium backdrop-blur-sm">{error}</div>}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1 tracking-wider">Correo Electrónico</label>
            <div className="relative">
                <i className="ph-fill ph-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-white text-sm rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600" placeholder="usuario@empresa.com" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1 tracking-wider">Contraseña</label>
            <div className="relative">
                <i className="ph-fill ph-lock-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-white text-sm rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600" placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]">{loading ? '...' : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}</button>
        </form>
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-4">
           <button onClick={onLoginGuest} className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-slate-300 text-sm font-semibold transition-all flex items-center justify-center gap-2 group">
             <i className="ph-bold ph-user text-slate-400 group-hover:text-white transition-colors"></i>
             Acceso Invitado
           </button>
           <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-xs text-slate-500 hover:text-amber-400 text-center transition-colors font-medium">{isRegistering ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Registrarse'}</button>
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

  // --- PDF GENERATION LOGIC ---
  const handleDownloadPDF = () => {
      if (typeof window.html2pdf === 'undefined') {
          showNotification("El generador de PDF no está listo. Intenta de nuevo en unos segundos.", 'error');
          return;
      }
      const element = document.getElementById('dashboard-content');
      const opt = {
        margin: [5, 5, 5, 5],
        filename: `Reporte_Ventas_${metrics.currentMonthName}_${metrics.currentYear}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Feedback visual
      const originalOpacity = element.style.opacity;
      element.style.opacity = '0.7';
      showNotification("Generando PDF... por favor espera", "success");

      window.html2pdf().set(opt).from(element).save().then(() => {
          element.style.opacity = originalOpacity;
          showNotification("PDF descargado correctamente", "success");
      }).catch(err => {
          element.style.opacity = originalOpacity;
          console.error(err);
          showNotification("Error al generar PDF", "error");
      });
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
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            colors: { 
                navy: { 800: '#1e3a8a', 900: '#0f172a' }, 
                amber: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
                slate: { 850: '#152033' }
            },
            animation: {
              'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              'fade-in-down': 'fadeInDown 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              'grow-up': 'growUp 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              fadeInDown: { '0%': { opacity: '0', transform: 'translateY(-30px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
              growUp: { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
              scaleIn: { '0%': { opacity: '0', transform: 'scale(0.9)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
              shine: { '0%': { transform: 'translateX(-100%) skewX(-30deg)' }, '100%': { transform: 'translateX(400%) skewX(-30deg)' } },
              float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-20px)' } }
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
      loadScript("https://unpkg.com/@phosphor-icons/web"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js") // Added HTML2PDF
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
            backgroundColor: ['#1e293b', '#f59e0b', '#475569', '#fbbf24', '#94a3b8'],
            borderWidth: 0,
            hoverOffset: 15,
            borderRadius: 5,
            spacing: 3
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

    // Bar Chart - Evolución Histórica
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
              borderRadius: 6,
              barThickness: 32,
              borderSkipped: false
          });
      });
      const unknownData = sortedYears.map(yearData => !yearData.agents ? yearData.total : 0);
      if (unknownData.some(v => v > 0)) {
           datasets.push({ label: 'Sin Desglose', data: unknownData, backgroundColor: '#cbd5e1', borderRadius: 6, barThickness: 32 });
      }
      const annualGoal = 15000 * 12;
      datasets.push({
          label: 'Meta Anual',
          data: sortedYears.map(() => annualGoal),
          type: 'line',
          borderColor: '#f43f5e',
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
            x: { stacked: false, grid: { display: false }, ticks: { font: {weight: 'bold', size: 11}, color: '#334155' } }
          },
          plugins: { 
              legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: {size: 10}, padding: 20 } },
              datalabels: {
                anchor: 'end',
                align: 'end',
                font: {
                  size: 10,
                  weight: 'bold'
                },
                formatter: (value, ctx) => {
                  if (ctx.dataset.type === 'line') return null;
                  const index = ctx.dataIndex;
                  let pctStr = '';
                  if (index > 0) {
                    const prev = ctx.dataset.data[index - 1];
                    if (prev !== 0) {
                      const pct = ((value - prev) / prev) * 100;
                      const sign = pct >= 0 ? '+' : '';
                      pctStr = '\n' + sign + pct.toFixed(0) + '%';
                    }
                  }
                  return '$' + (value / 1000).toFixed(0) + 'k' + pctStr;
                },
                color: (ctx) => {
                    const index = ctx.dataIndex;
                    if (index === 0) return '#64748b';
                    const prev = ctx.dataset.data[index - 1];
                    if (prev === 0) return '#64748b';
                    const pct = ((ctx.dataset.data[index] - prev) / prev) * 100;
                    return pct >= 0 ? '#10b981' : '#f43f5e';
                }
              },
              tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  padding: 12,
                  titleFont: { size: 13 },
                  bodyFont: { size: 12 },
                  cornerRadius: 8,
                  displayColors: true,
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

    // Line Chart - Ventas Diarias
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
        areaGradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
        areaGradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
        lineInstance.current = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas Diarias',
                    data: dataValues,
                    borderColor: '#f59e0b',
                    backgroundColor: areaGradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointStyle: 'circle',
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#f59e0b',
                    pointBorderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9', borderDash: [5, 5] }, ticks: { callback: v => '$' + (v/1000) + 'k', color: '#94a3b8' }, border: {display: false} },
                    x: { grid: { display: false }, ticks: { font: {size: 10}, color: '#94a3b8' } }
                },
                plugins: { 
                    legend: { display: false },
                    datalabels: { display: false }, // Cleaner look
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: (context) => {
                                let label = 'Venta: ';
                                label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                const idx = context.dataIndex;
                                if (idx > 0) {
                                    const growth = growthRates[idx];
                                    const icon = growth >= 0 ? '▲' : '▼';
                                    const sign = growth >= 0 ? '+' : '';
                                    label += `  ${icon} ${sign}${growth.toFixed(1)}%`;
                                }
                                return label;
                            }
                        }
                    }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
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
    :root { 
        --glass-bg: rgba(255, 255, 255, 0.65);
        --glass-border: rgba(255, 255, 255, 0.4);
        --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
    }
    body { 
        font-family: 'Plus Jakarta Sans', sans-serif; 
        background-color: #f8fafc;
        background-image: 
            radial-gradient(at 0% 0%, hsla(253,16%,7%,0) 0, transparent 50%), 
            radial-gradient(at 50% 0%, hsla(225,39%,30%,0) 0, transparent 50%), 
            radial-gradient(at 100% 0%, hsla(339,49%,30%,0) 0, transparent 50%);
        min-height: 100vh;
        color: #1e293b;
    }
    .main-bg-gradient {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: -1;
        background: radial-gradient(circle at top left, #f1f5f9, #cbd5e1);
    }
    .blob {
        position: absolute;
        filter: blur(80px);
        z-index: -1;
        opacity: 0.6;
        animation: float 10s infinite ease-in-out;
    }
    .blob-1 { top: -10%; right: -5%; width: 500px; height: 500px; background: #fbbf24; animation-delay: 0s; }
    .blob-2 { bottom: -10%; left: -10%; width: 600px; height: 600px; background: #e2e8f0; animation-delay: 2s; }
    .blob-3 { top: 40%; left: 40%; width: 300px; height: 300px; background: #fef3c7; animation-delay: 4s; }

    .glass-card { 
        background: var(--glass-bg); 
        backdrop-filter: blur(20px); 
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border); 
        border-radius: 24px; 
        box-shadow: var(--glass-shadow);
        transition: transform 0.3s ease, box-shadow 0.3s ease; 
    }
    .glass-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px -4px rgba(0, 0, 0, 0.08); }
    
    .metric-mini-exec { 
        background: rgba(255, 255, 255, 0.5); 
        border: 1px solid rgba(255,255,255,0.8); 
        border-radius: 20px; 
        padding: 1.25rem; 
        text-align: center; 
        transition: all 0.3s; 
        position: relative;
        overflow: hidden;
    }
    .metric-mini-exec:hover { 
        background: #fff; 
        transform: translateY(-3px); 
        box-shadow: 0 10px 20px -5px rgba(0,0,0,0.05);
        border-color: #f59e0b; 
    }

    .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    
    .podium-bar { position: relative; overflow: hidden; }
  `;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="flex flex-col items-center gap-4"><i className="ph ph-spinner animate-spin text-amber-500 text-5xl"></i><span className="text-white font-medium tracking-wider text-sm animate-pulse">CARGANDO DASHBOARD...</span></div></div>;
  if (!user) return <><style>{customStyles}</style><Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} /><LoginScreen onLoginGuest={handleLoginGuest} onLoginEmail={handleLoginEmail} /></>;

  return (
    <>
      <style>{customStyles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      
      {/* Background Blobs */}
      <div className="main-bg-gradient"></div>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      {isUploading && <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center"><i className="ph ph-spinner animate-spin text-white text-5xl mb-4"></i><p className="text-white font-bold text-lg tracking-wide">Procesando Datos...</p></div>}
      <ConfirmModal isOpen={showConfirmModal} title="Actualizar Datos" message="Se detectaron datos nuevos. ¿Deseas fusionarlos con el historial existente?" onCancel={cancelReplace} onConfirm={confirmReplace} />
      <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="p-6 lg:p-10 animate-fade-in min-h-screen">
        <div className="max-w-[1400px] mx-auto space-y-8" id="dashboard-content">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-20">
            <div className="space-y-1">
              <div className="flex items-center gap-4 group">
                <div className="p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/20 group-hover:scale-105 transition-transform duration-300">
                  <i className="ph-fill ph-chart-line-up text-amber-500 text-3xl"></i>
                </div>
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">Dashboard <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-600 ml-1">{metrics.currentYear}</span></h1>
                    <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                        <i className="ph-fill ph-check-circle text-emerald-500"></i>
                        Sistema de Control de Ventas
                    </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3" data-html2canvas-ignore="true">
                <div className="bg-white/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/60 shadow-sm flex">
                    <button onClick={() => setView('dashboard')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'dashboard' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/80'}`}>
                        <i className="ph-bold ph-squares-four text-lg"></i> Tablero
                    </button>
                    <button onClick={() => setView('data')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'data' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/80'}`}>
                        <i className="ph-bold ph-table text-lg"></i> Datos
                    </button>
                </div>

                <div className="flex items-center gap-3 pl-2">
                    <button onClick={handleDownloadPDF} className="group relative px-5 py-3 bg-white hover:bg-rose-50 border border-slate-200 rounded-2xl text-slate-700 hover:text-rose-600 font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2">
                         <i className="ph-fill ph-file-pdf text-xl text-rose-500 group-hover:scale-110 transition-transform"></i>
                         <span>PDF</span>
                    </button>

                    <label className="cursor-pointer group px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 transform hover:-translate-y-0.5">
                        <i className="ph-bold ph-upload-simple text-amber-500 text-lg group-hover:-translate-y-0.5 transition-transform"></i>
                        <span>Importar</span>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls, .csv" className="hidden" />
                    </label>
                    
                    <button onClick={handleLogout} className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-2xl text-lg transition-all" title="Cerrar Sesión">
                        <i className="ph-bold ph-sign-out"></i>
                    </button>
                </div>
            </div>
          </header>

          {metrics.agents.length === 0 ? (
             <div className="min-h-[60vh] flex flex-col justify-center items-center text-center bg-white/40 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-slate-300 m-4 animate-scale-in">
                <div className="p-8 bg-white rounded-full text-amber-500 shadow-2xl mb-8 animate-float"><i className="ph-duotone ph-upload-simple text-6xl"></i></div>
                <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Comencemos</h2>
                <p className="text-slate-500 max-w-md mb-8 text-lg">Importa tu archivo Excel de ventas para generar las visualizaciones automáticamente.</p>
                <label className="cursor-pointer px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex gap-3 items-center shadow-xl shadow-slate-900/20 hover:shadow-slate-900/40 transform hover:-translate-y-1">
                    <i className="ph-bold ph-file-plus text-xl"></i> Cargar Datos Ahora
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" />
                </label>
             </div>
          ) : view === 'data' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="glass-card p-8 bg-slate-900 text-white border-slate-800 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-32 bg-amber-500/10 blur-3xl rounded-full -mr-16 -mt-16"></div>
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2 relative z-10">
                              <i className="ph-fill ph-database text-amber-500"></i> Base de Datos
                          </h3>
                          <div className="space-y-3 relative z-10">
                              {metrics.annual.sort((a,b) => b.year - a.year).map((item) => (
                                  <div key={item.year} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors group">
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold flex items-center justify-center text-sm shadow-lg shadow-amber-500/20">
                                              {item.year}
                                          </div>
                                          <div>
                                              <div className="text-sm font-bold text-white">{formatCurrency(item.total)}</div>
                                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Venta Anual</div>
                                          </div>
                                      </div>
                                      <button onClick={() => { if(window.confirm(`¿Estás seguro de eliminar el año ${item.year} del histórico?`)) { deleteYear(item.year); } }} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all" title="Eliminar registro">
                                          <i className="ph-bold ph-trash"></i>
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-3">
                    <div className="glass-card p-8 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-2 h-6 bg-slate-800 rounded-full"></span> Data Cruda (Raw)
                            </h3>
                            <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                                {metrics.rawData.length} registros cargados
                            </span>
                        </div>
                        <div className="overflow-x-auto custom-scroll flex-1 rounded-2xl border border-slate-200/60">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">Fecha</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">Asesor</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200 text-right">Venta</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">Categoría</th>
                                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200 text-right">Cant.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white/40">
                                    {metrics.rawData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-3 text-slate-600 font-medium whitespace-nowrap">{row.date}</td>
                                            <td className="px-6 py-3 font-bold text-slate-700">{row.agent}</td>
                                            <td className="px-6 py-3 text-right font-bold text-emerald-600 bg-emerald-50/30">{formatCurrency(row.sales)}</td>
                                            <td className="px-6 py-3 text-slate-500 text-xs">{row.category}</td>
                                            <td className="px-6 py-3 text-right text-slate-500 font-mono">{row.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                  </div>
              </div>
          ) : (
            <>
              {/* --- DASHBOARD VIEW --- */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Main Metrics Area */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Card 1: Ventas Hoy */}
                        <div className={`glass-card p-6 border-l-[6px] ${isCCAhead ? 'border-l-emerald-500' : 'border-l-rose-500'} flex items-center gap-6 relative overflow-hidden group`}>
                             <div className="absolute right-0 top-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-slate-200 transition-all"></div>
                            <div className="relative z-10">
                                <CircularProgress value={totalSales} max={goalCCToday} color={isCCAhead ? 'text-emerald-500' : 'text-rose-500'} size={80} strokeWidth={8} />
                            </div>
                            <div className="flex-1 z-10">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">Ventas Reales <i className="ph-fill ph-info text-slate-300"></i></p>
                                <div className="flex flex-col">
                                    <span className="text-3xl font-black text-slate-800 tracking-tight"><AnimatedCounter value={totalSales} prefix="$" /></span>
                                    <span className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${isCCAhead ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        {isCCAhead ? <i className="ph-bold ph-trend-up"></i> : <i className="ph-bold ph-trend-down"></i>}
                                        vs Meta: {formatCurrency(goalCCToday)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Proyección */}
                        <div className="glass-card p-6 flex flex-col justify-center relative overflow-hidden group">
                             <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="flex justify-between items-center mb-3 z-10">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Proyección Mes</p>
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <i className="ph-fill ph-rocket-launch text-lg"></i>
                                </div>
                            </div>
                            <span className="text-3xl font-black text-slate-800 mb-3 z-10 tracking-tight"><AnimatedCounter value={daysElapsed > 0 ? (totalSales / daysElapsed * daysTotal) : 0} prefix="$" /></span>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex z-10">
                                <div className="bg-blue-500 h-full rounded-full animate-grow-up origin-left shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{width: '70%'}}></div>
                                <div className="bg-blue-200 h-full" style={{width: '30%'}}></div>
                            </div>
                        </div>

                        {/* Card 3: Pendiente */}
                        <div className="glass-card p-6 flex flex-col justify-center relative overflow-hidden group">
                             <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                             <div className="flex justify-between items-center mb-3">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pendiente</p>
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                    <i className="ph-fill ph-hourglass-medium text-lg"></i>
                                </div>
                            </div>
                            <span className="text-3xl font-black text-slate-800 mb-3 tracking-tight"><AnimatedCounter value={Math.max(0, goalMonthCC - totalSales)} prefix="$" /></span>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                                <div className="bg-slate-800 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (Math.max(0, goalMonthCC - totalSales) / goalMonthCC) * 100)}%` }}></div>
                            </div>
                             <div className="mt-3 text-[10px] font-bold text-slate-500 text-right flex justify-end items-center gap-1">
                                <i className="ph-bold ph-calendar-blank"></i> Quedan <span className="text-slate-800 text-xs bg-white px-1.5 rounded border border-slate-200">{daysTotal - daysElapsed}</span> días
                            </div>
                        </div>
                    </div>

                    {/* KPI Strip */}
                    <section className="glass-card p-6 bg-white/40">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> 
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span> 
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span> 
                                Objetivos Estratégicos
                            </h3>
                            <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold shadow-lg shadow-slate-900/20">
                                {daysElapsed} de {daysTotal} Días Hábiles
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="metric-mini-exec group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Pace</div>
                                <div className="text-2xl font-black text-amber-500">{(targetPercentToday * 100).toFixed(0)}<span className="text-sm align-top text-amber-300">%</span></div>
                            </div>
                            <div className="metric-mini-exec">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Meta Agente</div>
                                <div className="text-xl font-bold text-slate-700">{formatCurrency(goalMonthAgent)}</div>
                            </div>
                            <div className="metric-mini-exec">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">Run Rate</div>
                                <div className="text-xl font-bold text-slate-700">{formatCurrency(goalDailyAgent)}</div>
                            </div>
                            <div className="metric-mini-exec bg-slate-50 border-slate-200">
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Meta Center</div>
                                <div className="text-xl font-bold text-slate-800">{formatCurrency(goalMonthCC)}</div>
                            </div>
                            <div className="metric-mini-exec bg-slate-50 border-slate-200">
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Diaria Center</div>
                                <div className="text-xl font-bold text-slate-800">{formatCurrency(goalDailyCC)}</div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Pie Chart / Market Share */}
                <div className="lg:col-span-1">
                     <div className="glass-card p-6 h-full flex flex-col items-center justify-center relative overflow-hidden group transition-all bg-gradient-to-b from-white/60 to-white/30">
                        <div className="w-full text-center mb-6 relative z-10">
                            <h3 className="font-extrabold text-slate-800 flex items-center justify-center gap-2 text-sm uppercase tracking-wide">
                                <i className="ph-fill ph-chart-pie-slice text-amber-500 text-lg"></i>
                                Distribución
                            </h3>
                        </div>
                        <div className="relative w-full aspect-square max-w-[240px] transition-transform duration-500 hover:scale-105 cursor-pointer">
                            <canvas ref={pieChartRef}></canvas>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                    {hoveredAgent ? hoveredAgent.name : 'TOTAL'}
                                </span>
                                <span className={`font-black text-slate-800 tracking-tight transition-all duration-200 ${hoveredAgent ? 'text-2xl text-amber-600' : 'text-xl'}`}>
                                    {hoveredAgent ? formatCurrency(hoveredAgent.sales) : formatCurrency(totalSales)}
                                </span>
                            </div>
                        </div>
                         <div className="mt-8 w-full">
                            <div className="flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-wider border-t border-slate-100 pt-4">
                                <span>Líder</span>
                                <span className="text-slate-800">{processedAgents[0]?.name.split(' ')[0]}</span>
                            </div>
                         </div>
                    </div>
                </div>
              </div>
              
              {/* --- PODIUM & TABLE SECTION --- */}
              <div className="glass-card overflow-hidden mt-6 shadow-2xl shadow-slate-200/50 border-0">
                  <div className="p-8 bg-white/50 backdrop-blur border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="font-black text-slate-800 flex items-center gap-3 text-2xl">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                         <i className="ph-fill ph-trophy"></i>
                      </div>
                      Ranking de Campeones
                    </h2>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> En Vivo</span>
                    </div>
                  </div>
                  
                  {/* Podium Area */}
                  <div className="bg-gradient-to-b from-slate-50/50 to-white pt-8 pb-0 border-b border-slate-100 relative">
                       {/* Decoration */}
                       <div className="absolute top-10 left-10 text-9xl text-slate-100 opacity-50 font-black rotate-12 pointer-events-none">1</div>
                       <div className="absolute top-20 right-10 text-8xl text-slate-100 opacity-50 font-black -rotate-12 pointer-events-none">2</div>
                      <Podium agents={processedAgents} />
                  </div>

                  {/* Table Area */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-6 py-5 font-black">Asesor</th>
                          <th className="px-6 py-5 font-black text-right">Venta Real</th>
                          <th className="px-6 py-5 font-black text-right">Diferencia</th>
                          <th className="px-6 py-5 font-black text-center w-40">Cumplimiento</th>
                          <th className="px-6 py-5 font-black text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 bg-white">
                        {processedAgents.map((agent, index) => {
                          const percentage = agent.percent * 100;
                          const standardPace = daysTotal > 0 ? (daysElapsed/daysTotal) : 0;
                          const isAhead = agent.percent >= standardPace;
                          const initials = getInitials(agent.name);
                          
                          return (
                            <tr key={index} className="group transition-all hover:bg-slate-50/80">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${index === 0 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                    {initials}
                                  </div>
                                  <div>
                                     <span className="font-bold text-slate-700 block text-base">{agent.name}</span>
                                     <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Puesto Global #{index+1}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                  <div className="font-black text-slate-800 text-lg">{formatCurrency(agent.sales)}</div>
                              </td>
                              <td className={`px-6 py-5 text-right font-bold text-sm ${agent.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {agent.diff >= 0 ? '+' : ''}{Math.round(agent.diff).toLocaleString('es-PA')}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner ring-1 ring-slate-100">
                                    <div className={`h-full rounded-full transition-all duration-1000 relative ${isAhead ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-300 to-amber-500'}`} style={{width: `${Math.min(percentage, 100)}%`}}>
                                         <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-slate-400">{percentage.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm ${isAhead ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                  <i className={`ph-fill ${isAhead ? 'ph-check-circle' : 'ph-warning-octagon'}`}></i>
                                  {isAhead ? 'En Objetivo' : 'Riesgo'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              </div>

              {/* --- DAILY TREND SECTION --- */}
              <section className="glass-card p-8 mt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-5">
                         <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-900/30">
                             <i className="ph-bold ph-chart-bar text-2xl text-amber-500"></i>
                         </div>
                         <div>
                             <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Tendencia Diaria</h3>
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Comportamiento - <span className="text-amber-600 border-b border-amber-200">{metrics.currentMonthName}</span>
                             </p>
                         </div>
                    </div>
                    <div className="flex gap-4">
                        <div className={`px-6 py-3 rounded-2xl border flex items-center gap-4 transition-all hover:shadow-md ${growthPct >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                            <div className={`text-3xl ${growthPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <i className={`ph-fill ${growthPct >= 0 ? 'ph-trend-up' : 'ph-trend-down'}`}></i>
                            </div>
                            <div>
                                <div className={`text-xl font-black ${growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {growthPct > 0 ? '+' : ''}{growthPct.toFixed(1)}%
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">vs Ayer</div>
                            </div>
                        </div>
                        <div className="px-6 py-3 rounded-2xl bg-white border border-slate-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                             <div className="text-3xl text-amber-500 animate-pulse-slow">
                                <i className="ph-duotone ph-crown"></i>
                            </div>
                            <div>
                                <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                                    {bestAgentToday.name.split(' ')[0]}
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600 font-bold border border-slate-200">{formatCurrency(bestAgentToday.sales)}</span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">MVP del Día</div>
                            </div>
                        </div>
                    </div>
                  </div>
                  <div className="h-80 w-full relative p-2"><canvas ref={lineChartRef}></canvas></div>
              </section>

              {/* --- BOTTOM GRID (Categories & History) --- */}
              <div className="space-y-6 mt-6 pb-10" data-html2canvas-ignore="true">
                {top3Categories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card overflow-hidden border-t-4 border-t-emerald-500 hover:shadow-xl transition-shadow">
                        <div className="p-5 border-b border-slate-100 bg-emerald-50/30 flex justify-between items-center">
                             <h3 className="font-bold text-emerald-900 flex items-center gap-2 text-xs uppercase tracking-widest">
                                <i className="ph-fill ph-thumbs-up text-emerald-500 text-lg"></i> Top Productos
                             </h3>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-50">
                                    {top3Categories.map((cat, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-700 text-xs">{cat.name}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs bg-slate-50 rounded-lg mx-2">{cat.quantity} und</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(cat.sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="glass-card overflow-hidden border-t-4 border-t-rose-500 hover:shadow-xl transition-shadow">
                        <div className="p-5 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center">
                             <h3 className="font-bold text-rose-900 flex items-center gap-2 text-xs uppercase tracking-widest">
                                <i className="ph-fill ph-thumbs-down text-rose-500 text-lg"></i> Oportunidad (Bajo Vol)
                             </h3>
                        </div>
                        <div className="p-4">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-50">
                                    {bottom3Categories.map((cat, idx) => (
                                        <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-700 text-xs">{cat.name}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs bg-slate-50 rounded-lg mx-2">{cat.quantity} und</td>
                                            <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(cat.sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                )}
                
                {/* Historical Chart */}
                <div className="glass-card p-8 relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 transform origin-left scale-x-50 group-hover:scale-x-100 transition-transform duration-700"></div>
                   <h3 className="font-extrabold text-slate-800 flex items-center gap-3 mb-8 text-sm uppercase tracking-[0.2em]">
                      <span className="p-1.5 bg-slate-100 rounded text-slate-400"><i className="ph-bold ph-clock-counter-clockwise"></i></span>
                      Evolución Histórica (YoY)
                   </h3>
                   <div className="h-64 w-full relative"><canvas ref={barChartRef}></canvas></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

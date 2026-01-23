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

// --- UTILIDADES (Lógica Original Intacta) ---
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

// --- COMPONENTES VISUALES ---
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

const CircularProgress = ({ value, max, color = "text-blue-600", size = 64, strokeWidth = 6 }) => {
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
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle className="text-gray-100" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
                <circle className={`${color} transition-all duration-[1500ms] ease-out`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
            </svg>
            <div className="absolute text-[10px] font-bold text-gray-600">
                {Math.round((value / max) * 100)}%
            </div>
        </div>
    );
};

const Podium = ({ agents }) => {
    // Top 3 agents
    const top3 = [
        agents[1] || { name: 'Vacante', sales: 0 },
        agents[0] || { name: 'Vacante', sales: 0 },
        agents[2] || { name: 'Vacante', sales: 0 }
    ];
    
    return (
        <div className="flex items-end justify-center gap-4 h-60 w-full pt-4 px-4">
            {top3.map((agent, index) => {
                let rank = 0;
                let bgClass = '';
                let textClass = '';
                let height = '';
                
                if (index === 1) { 
                    rank = 2; 
                    bgClass = 'bg-gray-100 border-t-4 border-gray-400'; 
                    textClass = 'text-gray-600';
                    height = 'h-32'; 
                } else if (index === 0) { 
                    rank = 1; 
                    bgClass = 'bg-yellow-50 border-t-4 border-yellow-400 shadow-lg shadow-yellow-100'; 
                    textClass = 'text-yellow-700';
                    height = 'h-40'; 
                } else { 
                    rank = 3; 
                    bgClass = 'bg-orange-50 border-t-4 border-orange-300'; 
                    textClass = 'text-orange-700';
                    height = 'h-24'; 
                }
                
                return (
                    <div key={index} className="flex flex-col items-center w-24 md:w-32">
                        <div className="mb-2 flex flex-col items-center">
                            <span className="text-xs font-bold text-gray-500 mb-1 line-clamp-1">{agent.name.split(' ')[0]}</span>
                            <span className="font-bold text-gray-800 text-sm bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                                <AnimatedCounter value={agent.sales} prefix="$" />
                            </span>
                        </div>
                        <div className={`w-full ${height} rounded-t-lg ${bgClass} flex items-end justify-center pb-3 relative transition-all hover:opacity-90`}>
                            <span className={`text-3xl font-black opacity-30 ${textClass}`}>#{rank}</span>
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
    <div className={`fixed bottom-6 right-6 z-[200] px-6 py-4 rounded-lg shadow-xl border flex items-center gap-3 animate-fade-in-up transition-all ${isError ? 'bg-red-50 border-red-100 text-red-800' : 'bg-gray-900 border-gray-800 text-white'}`}>
      <i className={`ph-fill text-xl ${isError ? 'ph-warning-circle' : 'ph-check-circle text-green-400'}`}></i>
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><i className="ph-bold ph-x"></i></button>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-gray-500 hover:bg-gray-50 font-medium rounded-lg text-sm transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow-md transition-all">Sí, actualizar</button>
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
             <i className="ph-bold ph-chart-polar text-white text-2xl"></i>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Bienvenido</h1>
          <p className="text-gray-400 text-sm">Panel de Control de Ventas</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg text-center font-medium">{error}</div>}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg py-2.5 px-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg py-2.5 px-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-lg shadow-lg transition-all">{loading ? '...' : (isRegistering ? 'Registrar' : 'Entrar')}</button>
        </form>
        <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
           <button onClick={onLoginGuest} className="w-full py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition-all flex items-center justify-center gap-2">Acceso Invitado</button>
           <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="w-full text-xs text-blue-600 hover:text-blue-700 text-center font-medium">{isRegistering ? 'Volver a Login' : 'Crear nueva cuenta'}</button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // Estados
  const [metrics, setMetrics] = useState({ agents: [], annual: [], daily: [], categories: [], currentYear: 0, currentMonthName: '', rawData: [] });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [notification, setNotification] = useState(null);
  const [hoveredAgent, setHoveredAgent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Refs para gráficos y archivos
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const pieInstance = useRef(null);
  const barInstance = useRef(null);
  const lineInstance = useRef(null);
  const fileInputRef = useRef(null);
  
  const [businessDays, setBusinessDays] = useState({ total: 25, elapsed: 10 });

  // Notificaciones
  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    const days = getPanamaBusinessDays();
    setBusinessDays({ total: days.totalBusinessDays, elapsed: days.elapsedBusinessDays });
    return () => unsubscribe();
  }, []);

  // Handlers Login
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
    if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMetrics({ agents: [], annual: [], daily: [], categories: [], currentYear: 0, currentMonthName: '', rawData: [] });
    } catch (error) { console.error(error); }
  };

  // Carga de Datos Firebase
  useEffect(() => {
    if (!user) return;
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
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Scripts Charts
  useEffect(() => {
    const tailwindConfigScript = document.createElement('script');
    tailwindConfigScript.text = `
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
            animation: {
              'fade-in-up': 'fadeInUp 0.5s ease-out',
              'scale-in': 'scaleIn 0.3s ease-out',
            },
            keyframes: {
              fadeInUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
              scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
            }
          }
        }
      }
    `;
    document.head.appendChild(tailwindConfigScript);
    
    const loadScript = (src) => new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src; script.onload = resolve;
        document.head.appendChild(script);
    });

    Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/chart.js"),
      loadScript("https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"),
      loadScript("https://unpkg.com/@phosphor-icons/web")
    ]).then(() => {
      if (window.Chart && window.ChartDataLabels) window.Chart.register(window.ChartDataLabels);
      updateCharts();
    });
  }, []);

  useEffect(() => {
    if (typeof Chart === 'undefined') return;
    if (view === 'dashboard') updateCharts();
  }, [metrics, view]);

  const updateCharts = () => {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = "#94a3b8";
    
    // 1. PIE CHART (Donut limpio)
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
            backgroundColor: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#e2e8f0'],
            borderWidth: 0,
            hoverOffset: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
          plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } },
          onHover: (e, elements) => {
              if (elements && elements.length > 0) {
                  const idx = elements[0].index;
                  setHoveredAgent({ name: processedAgents[idx].name, sales: processedAgents[idx].sales });
              } else { setHoveredAgent(null); }
          }
        }
      });
    }

    // 2. BAR CHART (Evolución)
    if (barChartRef.current && metrics.annual.length > 0) {
      if (barInstance.current) barInstance.current.destroy();
      let sortedYears = [...metrics.annual].sort((a, b) => a.year - b.year);
      if (sortedYears.length > 3) sortedYears = sortedYears.slice(-3);
      
      const yearsLabels = sortedYears.map(y => y.year);
      const allAgentsSet = new Set();
      sortedYears.forEach(y => { if(y.agents) Object.keys(y.agents).forEach(a => allAgentsSet.add(a)); });
      const allAgents = Array.from(allAgentsSet);
      
      const colors = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'];
      const datasets = allAgents.map((agent, i) => ({
          label: agent.split(' ')[0],
          data: sortedYears.map(y => y.agents ? (y.agents[agent] || 0) : 0),
          backgroundColor: colors[i % colors.length],
          borderRadius: 4,
          barThickness: 40,
      }));
      
      const unknownData = sortedYears.map(y => !y.agents ? y.total : 0);
      if (unknownData.some(v => v > 0)) datasets.push({ label: 'Otros', data: unknownData, backgroundColor: '#e2e8f0', borderRadius: 4, barThickness: 40 });

      datasets.push({
          label: 'Meta',
          data: sortedYears.map(() => 15000 * 12),
          type: 'line',
          borderColor: '#ef4444',
          borderWidth: 2,
          borderDash: [5,5],
          pointRadius: 0,
          order: 0,
          datalabels: { display: false }
      });

      const ctxBar = barChartRef.current.getContext('2d');
      barInstance.current = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: yearsLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: { display: false, stacked: false },
              x: { grid: { display: false }, ticks: { font: { weight: 'bold' }, color: '#334155' } }
          },
          plugins: { 
              legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 6 } },
              datalabels: { anchor: 'end', align: 'end', formatter: v => '$'+(v/1000).toFixed(0)+'k', font: { weight: 'bold', size: 10 }, color: '#64748b' }
          }
        }
      });
    }

    // 3. LINE CHART (Tendencia)
    if (lineChartRef.current && metrics.daily.length > 0) {
        if (lineInstance.current) lineInstance.current.destroy();
        const dataValues = metrics.daily.map(d => d.total);
        const labels = metrics.daily.map(d => parseInt(d.date.split('-')[2]));
        const ctxLine = lineChartRef.current.getContext('2d');
        const gradient = ctxLine.createLinearGradient(0,0,0,200);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.1)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

        lineInstance.current = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: dataValues,
                    borderColor: '#2563eb',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { display: false }, y: { display: false } },
                plugins: { legend: { display: false }, datalabels: { display: false } }
            }
        });
    }
  };

  const processFile = (file) => {
    if (typeof XLSX === 'undefined') { showNotification("Error librería", 'error'); return; }
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
            metrics.annual.forEach(item => annualMap.set(item.year, { total: item.total, agents: item.agents || {} }));
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
                 let dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
                 if (dateObj && !isNaN(dateObj.getTime())) {
                     yearsInFile.add(dateObj.getFullYear());
                     if (dateObj.getTime() > maxDateTimestamp) maxDateTimestamp = dateObj.getTime();
                 }
            }
        }
        yearsInFile.forEach(y => { if (!annualMap.has(y)) annualMap.set(y, { total: 0, agents: {} }); });

        const maxDate = maxDateTimestamp > 0 ? new Date(maxDateTimestamp) : new Date();
        const currentYear = maxDate.getFullYear();
        const currentMonth = maxDate.getMonth();
        const currentMonthName = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][currentMonth];

        for(let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[colIndices.name]) continue;
          
          let salesVal = 0;
          const rawSales = row[colIndices.sales];
          if (typeof rawSales === 'number') salesVal = rawSales;
          else if (typeof rawSales === 'string') salesVal = parseFloat(rawSales.replace(/[^0-9.-]+/g,"")) || 0;
          
          const rawDate = row[colIndices.date];
          let dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
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
              annualEntry.agents[rawName] = (annualEntry.agents[rawName] || 0) + salesVal;
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
            showNotification(`Datos actualizados: ${currentYear}`);
        }
      } catch (err) { showNotification(err.message, 'error'); } 
      finally { setIsUploading(false); setPendingFile(null); }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteYear = async (yearToDelete) => {
    if (!user) return;
    try {
        const updatedAnnual = metrics.annual.filter(item => item.year !== yearToDelete);
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');
        await updateDoc(docRef, { annual: updatedAnnual });
        showNotification(`Año ${yearToDelete} eliminado`);
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (metrics.agents.length > 0) { setPendingFile(file); setShowConfirmModal(true); } 
    else { processFile(file); }
    e.target.value = ''; 
  };

  // KPIs
  const { total: daysTotal, elapsed: daysElapsed } = businessDays;
  const goalMonthAgent = 15000;
  const goalDailyAgent = daysTotal > 0 ? goalMonthAgent / daysTotal : 0;
  const goalMonthCC = goalMonthAgent * 3; 
  const goalDailyCC = goalDailyAgent * 3; 
  const paceRatio = daysTotal > 0 ? (daysElapsed / daysTotal) : 0;
  
  const processedAgents = metrics.agents.map(a => ({ ...a, diff: a.sales - goalMonthAgent, percent: a.sales / goalMonthAgent })).sort((a, b) => b.sales - a.sales);
  const totalSales = processedAgents.reduce((acc, curr) => acc + curr.sales, 0);
  const goalCCToday = goalDailyCC * daysElapsed;
  const isCCAhead = totalSales >= goalCCToday;
  const top3Categories = [...metrics.categories].sort((a, b) => b.sales - a.sales).slice(0, 3);

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

  const styles = `
    .glass-effect { background: white; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02); }
    .nav-btn { display: flex; items-center; gap: 8px; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; transition: all 0.2s; }
    .nav-btn:hover { background: #f8fafc; color: #0f172a; }
    .nav-btn.active { background: #eff6ff; color: #2563eb; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
  `;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><i className="ph ph-spinner animate-spin text-blue-600 text-3xl"></i></div>;
  if (!user) return <><style>{styles}</style><Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} /><LoginScreen onLoginGuest={handleLoginGuest} onLoginEmail={handleLoginEmail} /></>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-100">
      <style>{styles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      
      {/* Modals & Loaders */}
      {isUploading && <div className="fixed inset-0 z-[300] bg-white/80 backdrop-blur-sm flex items-center justify-center"><div className="flex flex-col items-center"><i className="ph ph-arrows-clockwise animate-spin text-blue-600 text-4xl mb-3"></i><p className="font-bold text-gray-600">Procesando Datos...</p></div></div>}
      <ConfirmModal isOpen={showConfirmModal} title="Actualizar" message="¿Fusionar datos nuevos con el historial existente?" onCancel={() => {setShowConfirmModal(false); setPendingFile(null);}} onConfirm={confirmReplace} />
      <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />

      {/* Main Layout */}
      <div className="flex flex-col h-screen">
          
          {/* Top Navigation */}
          <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 z-30">
              <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><i className="ph-bold ph-chart-polar"></i></div>
                  <h1 className="font-bold text-gray-900 text-lg tracking-tight hidden md:block">Dashboard <span className="text-gray-400 font-normal">| {metrics.currentYear || 'Sin Datos'}</span></h1>
              </div>
              
              <div className="flex items-center gap-2">
                  <button onClick={() => setView('dashboard')} className={`nav-btn ${view === 'dashboard' ? 'active' : 'text-gray-500'}`}><i className="ph-bold ph-squares-four"></i> <span className="hidden md:inline">Resumen</span></button>
                  <button onClick={() => setView('data')} className={`nav-btn ${view === 'data' ? 'active' : 'text-gray-500'}`}><i className="ph-bold ph-database"></i> <span className="hidden md:inline">Datos</span></button>
                  <div className="w-px h-6 bg-gray-200 mx-2"></div>
                  <label className="nav-btn text-gray-500 cursor-pointer hover:text-blue-600">
                      <i className="ph-bold ph-upload-simple"></i>
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" />
                  </label>
                  <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"><i className="ph-bold ph-sign-out"></i></button>
              </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-7xl mx-auto">
                  
                  {metrics.agents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 animate-pulse"><i className="ph-duotone ph-cloud-arrow-up text-4xl text-gray-400"></i></div>
                          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin información visual</h2>
                          <p className="text-gray-500 mb-8">Importa un archivo Excel para activar el tablero.</p>
                          <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold cursor-pointer transition-colors shadow-lg shadow-blue-500/20">
                              Subir Archivo <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx" className="hidden" />
                          </label>
                      </div>
                  ) : view === 'data' ? (
                      // Vista de Datos (Simplificada)
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up">
                          <div className="lg:col-span-1 space-y-4">
                              <div className="glass-effect p-6 rounded-2xl">
                                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Historial</h3>
                                  {metrics.annual.map(item => (
                                      <div key={item.year} className="flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-lg group hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                                          <div>
                                              <span className="block font-bold text-gray-900">{item.year}</span>
                                              <span className="text-xs text-gray-500">{formatCurrency(item.total)}</span>
                                          </div>
                                          <button onClick={() => { if(window.confirm('¿Borrar?')) deleteYear(item.year)}} className="text-gray-300 hover:text-red-500"><i className="ph-bold ph-trash"></i></button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div className="lg:col-span-3 glass-effect p-0 rounded-2xl overflow-hidden flex flex-col h-[80vh]">
                              <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                                  <h3 className="font-bold text-gray-700">Registros ({metrics.rawData.length})</h3>
                              </div>
                              <div className="overflow-auto flex-1">
                                  <table className="w-full text-sm text-left text-gray-600">
                                      <thead className="text-xs text-gray-400 uppercase bg-gray-50 sticky top-0">
                                          <tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Asesor</th><th className="px-6 py-3 text-right">Monto</th></tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                          {metrics.rawData.map((r,i) => (
                                              <tr key={i} className="hover:bg-gray-50"><td className="px-6 py-2">{r.date}</td><td className="px-6 py-2 font-medium text-gray-900">{r.agent}</td><td className="px-6 py-2 text-right">{formatCurrency(r.sales)}</td></tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                  ) : (
                      // DASHBOARD PRINCIPAL (Clean Layout)
                      <div className="space-y-8 animate-fade-in-up">
                          
                          {/* 1. HERO SECTION - KPIs Principales */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Venta Total */}
                              <div className="glass-effect p-6 rounded-2xl relative overflow-hidden group">
                                  <div className="flex justify-between items-start z-10 relative">
                                      <div>
                                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Ventas</p>
                                          <h3 className="text-3xl font-bold text-gray-900 tracking-tight"><AnimatedCounter value={totalSales} prefix="$" /></h3>
                                      </div>
                                      <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><i className="ph-bold ph-currency-dollar"></i></div>
                                  </div>
                                  <div className="mt-6 flex items-center gap-3">
                                      <CircularProgress value={totalSales} max={goalCCToday} size={48} strokeWidth={4} color={isCCAhead ? 'text-emerald-500' : 'text-rose-500'} />
                                      <div>
                                          <p className="text-sm font-bold text-gray-700">Meta: {formatCurrency(goalCCToday)}</p>
                                          <p className={`text-xs font-bold ${isCCAhead ? 'text-emerald-600' : 'text-rose-500'}`}>{isCCAhead ? 'En Objetivo' : 'Requiere Atención'}</p>
                                      </div>
                                  </div>
                              </div>

                              {/* Proyeccion */}
                              <div className="glass-effect p-6 rounded-2xl relative overflow-hidden">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Proyección</p>
                                          <h3 className="text-2xl font-bold text-blue-600"><AnimatedCounter value={daysElapsed > 0 ? (totalSales / daysElapsed * daysTotal) : 0} prefix="$" /></h3>
                                      </div>
                                      <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><i className="ph-bold ph-trend-up"></i></div>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1 mt-6">
                                      <div className="bg-blue-500 h-1 rounded-full" style={{width: '65%'}}></div>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">Basado en promedio diario</p>
                              </div>

                              {/* Saldo Pendiente */}
                              <div className="glass-effect p-6 rounded-2xl relative">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Por Cubrir</p>
                                          <h3 className="text-2xl font-bold text-gray-800"><AnimatedCounter value={Math.max(0, goalMonthCC - totalSales)} prefix="$" /></h3>
                                      </div>
                                      <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500"><i className="ph-bold ph-hourglass"></i></div>
                                  </div>
                                  <div className="mt-6 flex justify-between text-xs font-medium text-gray-500">
                                      <span>Meta: {formatCurrency(goalMonthCC)}</span>
                                      <span>{daysTotal - daysElapsed} días rest.</span>
                                  </div>
                              </div>

                              {/* MVP Card */}
                              <div className="bg-gray-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl shadow-gray-900/10 card-hover">
                                  <div className="absolute top-0 right-0 p-12 bg-white/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
                                  <div className="relative z-10">
                                      <div className="flex items-center gap-2 mb-4">
                                          <i className="ph-fill ph-trophy text-yellow-400"></i>
                                          <span className="text-xs font-bold text-gray-400 uppercase">MVP Hoy</span>
                                      </div>
                                      <h3 className="text-xl font-bold mb-1">{bestAgentToday.name.split(' ')[0]}</h3>
                                      <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">{formatCurrency(bestAgentToday.sales)}</p>
                                  </div>
                              </div>
                          </div>

                          {/* 2. MAIN CONTENT GRID */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                              
                              {/* Left Column: Charts (8 cols) */}
                              <div className="lg:col-span-8 space-y-6">
                                  {/* Evolution Chart */}
                                  <div className="glass-effect p-6 rounded-2xl">
                                      <div className="flex items-center justify-between mb-6">
                                          <h3 className="font-bold text-gray-800">Evolución Histórica</h3>
                                          <div className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">Últimos 3 años</div>
                                      </div>
                                      <div className="h-64 w-full relative">
                                          <canvas ref={barChartRef}></canvas>
                                      </div>
                                  </div>

                                  {/* Agents Table */}
                                  <div className="glass-effect rounded-2xl overflow-hidden">
                                      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                          <h3 className="font-bold text-gray-800">Rendimiento por Asesor</h3>
                                          <span className="text-xs font-medium text-gray-400">Meta Indv: {formatCurrency(goalMonthAgent)}</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                          <table className="w-full text-sm text-left">
                                              <thead className="bg-gray-50/50 text-xs uppercase text-gray-400 font-bold">
                                                  <tr>
                                                      <th className="px-6 py-4">Asesor</th>
                                                      <th className="px-6 py-4 text-center">Progreso</th>
                                                      <th className="px-6 py-4 text-right">Venta</th>
                                                      <th className="px-6 py-4 text-center">Gap</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-50">
                                                  {processedAgents.map((agent, idx) => {
                                                      const pct = Math.min(agent.percent * 100, 100);
                                                      const isOk = agent.percent >= paceRatio;
                                                      return (
                                                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                              <td className="px-6 py-4 font-bold text-gray-700 flex items-center gap-3">
                                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white shadow-sm ${idx < 3 ? 'bg-gray-900' : 'bg-gray-400'}`}>
                                                                      {getInitials(agent.name)}
                                                                  </div>
                                                                  {agent.name.split(' ')[0]}
                                                              </td>
                                                              <td className="px-6 py-4">
                                                                  <div className="w-24 mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                      <div className={`h-full rounded-full ${isOk ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{width: `${pct}%`}}></div>
                                                                  </div>
                                                              </td>
                                                              <td className="px-6 py-4 text-right font-bold text-gray-900">{formatCurrency(agent.sales)}</td>
                                                              <td className={`px-6 py-4 text-center font-bold text-xs ${agent.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                  {agent.diff > 0 ? '+' : ''}{formatCurrency(agent.diff)}
                                                              </td>
                                                          </tr>
                                                      )
                                                  })}
                                              </tbody>
                                          </table>
                                      </div>
                                  </div>
                              </div>

                              {/* Right Column: Details (4 cols) */}
                              <div className="lg:col-span-4 space-y-6">
                                  
                                  {/* Donut Chart */}
                                  <div className="glass-effect p-6 rounded-2xl flex flex-col items-center justify-center text-center relative h-[340px]">
                                      <h3 className="absolute top-6 left-6 font-bold text-gray-800 text-sm">Cuota de Mercado</h3>
                                      <div className="w-[200px] h-[200px] relative z-10">
                                          <canvas ref={pieChartRef}></canvas>
                                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                              <span className="text-[10px] font-bold text-gray-400 uppercase">{hoveredAgent ? hoveredAgent.name.split(' ')[0] : 'TOTAL'}</span>
                                              <span className="text-lg font-black text-gray-800">{hoveredAgent ? formatCurrency(hoveredAgent.sales) : formatCurrency(totalSales)}</span>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Podium */}
                                  <div className="glass-effect p-6 rounded-2xl bg-white border border-gray-100">
                                      <h3 className="font-bold text-gray-800 mb-2 text-center">Top Performers</h3>
                                      <Podium agents={processedAgents} />
                                  </div>

                                  {/* Mini Daily Trend */}
                                  <div className="glass-effect p-6 rounded-2xl">
                                       <div className="flex justify-between items-center mb-4">
                                           <h3 className="font-bold text-gray-800 text-sm">Tendencia Diaria</h3>
                                           <span className={`text-xs font-bold px-2 py-0.5 rounded ${growthPct >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                               {growthPct > 0 ? '+' : ''}{growthPct.toFixed(1)}%
                                           </span>
                                       </div>
                                       <div className="h-20 w-full relative">
                                           <canvas ref={lineChartRef}></canvas>
                                       </div>
                                  </div>
                              </div>

                          </div>
                          
                          {/* Footer KPIs Strip */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                               <div className="text-center border-r border-gray-100 last:border-0">
                                   <p className="text-[10px] font-bold text-gray-400 uppercase">Ritmo Req.</p>
                                   <p className="font-bold text-gray-800">{(targetPercentToday * 100).toFixed(0)}%</p>
                               </div>
                               <div className="text-center border-r border-gray-100 last:border-0">
                                   <p className="text-[10px] font-bold text-gray-400 uppercase">Meta Mes Agt</p>
                                   <p className="font-bold text-gray-800">{formatCurrency(goalMonthAgent)}</p>
                               </div>
                               <div className="text-center border-r border-gray-100 last:border-0">
                                   <p className="text-[10px] font-bold text-gray-400 uppercase">Meta Día Agt</p>
                                   <p className="font-bold text-gray-800">{formatCurrency(goalDailyAgent)}</p>
                               </div>
                               <div className="text-center">
                                   <p className="text-[10px] font-bold text-gray-400 uppercase">Meta Día CC</p>
                                   <p className="font-bold text-gray-800">{formatCurrency(goalDailyCC)}</p>
                               </div>
                          </div>

                      </div>
                  )}
              </div>
          </main>
      </div>
    </div>
  );
}

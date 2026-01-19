import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
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

// --- COMPONENTE DE NOTIFICACIÓN ---
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

// --- COMPONENTE DE MODAL DE CONFIRMACIÓN ---
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
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-lg text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm shadow-lg shadow-amber-500/20 transition-all">
            Sí, reemplazar datos
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE DE LOGIN ---
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
          <p className="text-slate-400 text-sm">Executive Dashboard Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-200 text-xs text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Email Corporativo</label>
            <div className="relative">
              <i className="ph-duotone ph-envelope absolute left-3 top-3 text-slate-400"></i>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600 text-white text-sm rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                placeholder="ejemplo@empresa.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Contraseña</label>
            <div className="relative">
              <i className="ph-duotone ph-lock-key absolute left-3 top-3 text-slate-400"></i>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600 text-white text-sm rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph-bold ph-sign-in"></i>}
            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col gap-4">
           <button 
            onClick={onLoginGuest}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 text-sm font-medium transition-all flex items-center justify-center gap-2 group"
          >
            <i className="ph-duotone ph-user-circle text-lg group-hover:text-white"></i>
            Acceso Invitado (Demo)
          </button>
          
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-xs text-slate-500 hover:text-amber-400 transition-colors text-center"
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo usuario? Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [agents, setAgents] = useState([]); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Carga inicial de auth
  const [dataLoading, setDataLoading] = useState(false); // Carga de datos de Firestore
  
  // Nuevos estados para UI de carga y confirmación
  const [isUploading, setIsUploading] = useState(false); // Subida de archivo
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [notification, setNotification] = useState(null);

  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartRef = useRef(null); // Referencia para el nuevo gráfico de línea
  const pieInstance = useRef(null);
  const barInstance = useRef(null);
  const lineInstance = useRef(null); // Instancia para el gráfico de línea
  const fileInputRef = useRef(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // 1. Monitor de Estado de Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Funciones de Login
  const handleLoginGuest = async () => {
    setLoading(true);
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) {
      console.error("Auth error:", error);
      showNotification("Error al iniciar como invitado: " + error.message, 'error');
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
      setAgents([]);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // 3. Sincronización de Datos (Firestore -> App)
  useEffect(() => {
    if (!user) return;
    
    setDataLoading(true);
    const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');

    const unsubscribe = onSnapshot(dataRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.agents && Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      } else {
        setAgents([]);
      }
      setDataLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setDataLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 4. Cargar Scripts Externos
  useEffect(() => {
    const tailwindConfigScript = document.createElement('script');
    tailwindConfigScript.text = `
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              navy: { 800: '#1e3a8a', 900: '#0f172a' },
              amber: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' }
            },
            animation: {
              'fade-in': 'fadeIn 0.5s ease-out',
              'fade-in-down': 'fadeInDown 0.5s ease-out',
              'scale-in': 'scaleIn 0.3s ease-out',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              fadeInDown: { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
              scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
            }
          }
        }
      }
    `;
    document.head.appendChild(tailwindConfigScript);

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve(); return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/chart.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"),
      loadScript("https://unpkg.com/@phosphor-icons/web")
    ]).then(() => {
      updateCharts();
    });
  }, []);

  // 5. Lógica de Renderizado de Gráficos
  useEffect(() => {
    if (typeof Chart === 'undefined') return;
    updateCharts();
  }, [agents]);

  const updateCharts = () => {
    if (typeof Chart === 'undefined') return;
    if (agents.length === 0) return;

    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = "#64748b";

    const processedAgents = [...agents].sort((a, b) => b.sales - a.sales);
    const currentYear = new Date().getFullYear();

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
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // --- BAR CHART (EVOLUCIÓN) ---
    if (barChartRef.current) {
      if (barInstance.current) barInstance.current.destroy();
      
      const growthLabelPlugin = {
        id: 'growthLabel',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((element, index) => {
              if (index > 0) {
                const currentVal = dataset.data[index];
                const prevVal = dataset.data[index - 1];
                let growth = 0;
                if (prevVal !== 0) growth = ((currentVal - prevVal) / prevVal) * 100;
                const x = element.x;
                const y = element.y;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = 'bold 11px "Plus Jakarta Sans"';
                const text = (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%';
                ctx.fillStyle = growth >= 0 ? '#059669' : '#e11d48';
                ctx.fillText(text, x, y - 8);
                ctx.restore();
              }
            });
          });
        }
      };

      const ctxBar = barChartRef.current.getContext('2d');
      barInstance.current = new Chart(ctxBar, {
        type: 'bar',
        data: {
          // Años dinámicos basados en la fecha actual
          labels: [String(currentYear - 2), String(currentYear - 1), String(currentYear)],
          datasets: processedAgents.slice(0, 4).map((agent, i) => ({
            label: agent.name.split(' ')[0],
            // Usamos el dato cargado como el año actual. Simulamos historia para mantener consistencia visual.
            data: [ agent.sales * 0.75, agent.sales * 0.88, agent.sales ],
            backgroundColor: i === 0 ? '#f59e0b' : (i % 2 === 0 ? '#0f172a' : '#475569'),
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9', drawBorder: false }, ticks: { callback: v => '$' + v/1000 + 'k', color: '#94a3b8', font: {size: 10} }, border: { display: false } },
            x: { grid: { display: false }, ticks: { color: '#64748b', font: {weight: 'bold'} } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, padding: 20, font: {size: 11} } },
            tooltip: { backgroundColor: '#0f172a', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12 }, cornerRadius: 8, displayColors: false }
          }
        },
        plugins: [growthLabelPlugin]
      });
    }

    // --- LINE CHART (TENDENCIA DIARIA) ---
    if (lineChartRef.current) {
        if (lineInstance.current) lineInstance.current.destroy();
        
        // Simulación de datos diarios basada en el total para visualización
        const daysInMonth = 30;
        const totalSales = processedAgents.reduce((acc, curr) => acc + curr.sales, 0);
        // Generamos una curva random pero acumulativa que llegue al total aprox
        let currentSum = 0;
        const dailyData = Array.from({length: daysInMonth}, (_, i) => {
            const baseDaily = totalSales / daysInMonth;
            const variance = baseDaily * 0.4;
            const dailyVal = Math.max(0, baseDaily + (Math.random() * variance * 2 - variance));
            return dailyVal;
        });
        const labels = Array.from({length: daysInMonth}, (_, i) => `Día ${i + 1}`);

        const ctxLine = lineChartRef.current.getContext('2d');
        
        // Plugin para línea punteada en el cursor
        const verticalLinePlugin = {
            id: 'verticalLine',
            afterDraw: (chart) => {
                if (chart.tooltip?._active?.length) {
                    const ctx = chart.ctx;
                    const x = chart.tooltip._active[0].element.x;
                    const topY = chart.scales.y.top;
                    const bottomY = chart.scales.y.bottom;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, topY);
                    ctx.lineTo(x, bottomY);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        };

        lineInstance.current = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas Diarias',
                    data: dailyData,
                    borderColor: '#f59e0b',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.2)');
                        gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
                        return gradient;
                    },
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#f59e0b',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9', drawBorder: false },
                        ticks: { callback: v => '$' + v.toLocaleString(), color: '#94a3b8', font: {size: 10} },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { display: false } // Ocultar etiquetas X para limpieza visual
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 12,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                // Calcular diferencia con día anterior
                                const dataIndex = context.dataIndex;
                                if(dataIndex > 0) {
                                    const prev = context.dataset.data[dataIndex - 1];
                                    const current = context.parsed.y;
                                    const diff = ((current - prev) / prev) * 100;
                                    const symbol = diff >= 0 ? '▲' : '▼';
                                    label += ` (${symbol} ${Math.abs(diff).toFixed(1)}%)`;
                                }
                                return label;
                            }
                        }
                    }
                }
            },
            plugins: [verticalLinePlugin]
        });
    }
  };

  // --- LÓGICA DE PROCESAMIENTO DE ARCHIVO ---
  
  // 1. Selector de archivo (Handler inicial)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Si ya hay agentes, pedir confirmación
    if (agents.length > 0) {
      setPendingFile(file);
      setShowConfirmModal(true);
      // Limpiamos el input para permitir seleccionar el mismo archivo si se cancela y reintenta
      e.target.value = ''; 
    } else {
      processFile(file);
      e.target.value = ''; 
    }
  };

  // 2. Procesar el archivo (Lectura y Guardado)
  const processFile = (file) => {
    if (typeof XLSX === 'undefined') {
        showNotification("La librería Excel no se ha cargado aún. Intenta de nuevo.", 'error');
        return;
    }

    setIsUploading(true); // Activar overlay de carga

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
        
        let colIndices = { name: 0, sales: 1 }; 
        const headers = jsonData[0]; 
        
        if (headers && Array.isArray(headers)) {
          headers.forEach((h, idx) => {
            const txt = String(h).toLowerCase();
            if (txt.includes('asesor') || txt.includes('nombre') || txt.includes('agente') || txt.includes('vendedor')) colIndices.name = idx;
            if (txt.includes('venta') || txt.includes('total') || txt.includes('monto') || txt.includes('sales') || txt.includes('importe')) colIndices.sales = idx;
          });
        }

        // --- LÓGICA DE AGRUPACIÓN MODIFICADA ---
        const agentsMap = new Map(); // Usamos un mapa para acumular ventas por nombre
        
        for(let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[colIndices.name]) continue;
          
          const rawSales = row[colIndices.sales];
          // Limpieza robusta de valores numéricos
          let salesVal = 0;
          if (typeof rawSales === 'number') {
             salesVal = rawSales;
          } else if (typeof rawSales === 'string') {
             salesVal = parseFloat(rawSales.replace(/[^0-9.-]+/g,"")) || 0;
          }

          const rawName = String(row[colIndices.name]).trim();
          // Usamos una clave normalizada para asegurar que 'Juan Perez' y 'Juan Perez ' sean iguales
          // Pero guardamos el nombre original (o el primero que encontramos) para mostrar
          const nameKey = rawName.toLowerCase();

          if (agentsMap.has(nameKey)) {
            // Si ya existe, sumamos al total actual
            const existingAgent = agentsMap.get(nameKey);
            existingAgent.sales += salesVal;
            agentsMap.set(nameKey, existingAgent);
          } else {
            // Si no existe, creamos la entrada
            agentsMap.set(nameKey, {
              name: rawName,
              sales: salesVal
            });
          }
        }

        // Convertimos el mapa de vuelta a array
        const newAgents = Array.from(agentsMap.values());

        if(newAgents.length > 0) {
          if (user) {
            const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');
            await setDoc(dataRef, { agents: newAgents });
            showNotification("✅ Datos agrupados y actualizados correctamente.");
          } else {
            showNotification("⚠️ No hay sesión activa. Recarga la página.", 'error');
          }
        } else {
          showNotification("⚠️ El archivo no contiene datos válidos. Revisa las columnas.", 'error');
        }
      } catch (err) {
        console.error(err);
        showNotification("❌ Error al procesar el archivo: " + err.message, 'error');
      } finally {
        setIsUploading(false); // Desactivar overlay de carga
        setPendingFile(null);
      }
    };
    
    reader.onerror = () => {
        showNotification("Error de lectura de archivo", 'error');
        setIsUploading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  // 3. Handlers de Modal
  const confirmReplace = () => {
    setShowConfirmModal(false);
    if (pendingFile) {
      processFile(pendingFile);
    }
  };

  const cancelReplace = () => {
    setShowConfirmModal(false);
    setPendingFile(null);
  };

  // Cálculos
  const config = { daysTotal: 25, daysElapsed: 10, goalAgentFixed: 15000 };
  const targetPercentToday = config.daysElapsed / config.daysTotal;
  const goalMonthAgent = config.goalAgentFixed;
  const goalDailyAgent = goalMonthAgent / config.daysTotal;
  const totalAgents = agents.length;
  const goalMonthCC = goalMonthAgent * (totalAgents || 1); 
  const goalDailyCC = goalMonthCC / config.daysTotal;

  const processedAgents = agents.map(agent => {
    const percent = agent.sales / goalMonthAgent;
    return { ...agent, goal: goalMonthAgent, diff: agent.sales - goalMonthAgent, percent: percent };
  }).sort((a, b) => b.sales - a.sales);

  const totalSales = processedAgents.reduce((acc, curr) => acc + curr.sales, 0);
  const goalCCToday = goalDailyCC * config.daysElapsed;
  const isCCAhead = totalSales >= goalCCToday;
  const fmtMoney = (n) => '$' + n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

  const customStyles = `
    :root { --primary: #0f172a; --accent: #f59e0b; --glass: rgba(255, 255, 255, 0.85); }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color: #1e293b; min-height: 100vh; }
    .glass-card {
        background: var(--glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 20px;
        box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05); transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
    }
    .glass-card:hover { transform: translateY(-5px); box-shadow: 0 12px 30px -4px rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); }
    .metric-mini-exec {
        background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 16px; padding: 1rem; text-align: center; transition: all 0.3s ease;
    }
    .metric-mini-exec:hover { border-color: var(--accent); background: #fff; }
    .hero-upload {
        min-height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center;
        text-align: center; border: 2px dashed #cbd5e1; border-radius: 24px; background: rgba(255,255,255,0.4);
    }
  `;

  // --- RENDER CONDICIONAL ---
  
  if (loading) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
           <i className="ph ph-spinner animate-spin text-amber-500 text-4xl"></i>
        </div>
     );
  }

  if (!user) {
    return (
        <>
            <style>{customStyles}</style>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />
            <LoginScreen onLoginGuest={handleLoginGuest} onLoginEmail={handleLoginEmail} />
        </>
    );
  }

  return (
    <>
      <style>{customStyles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      
      {/* Overlay de Carga (Global) */}
      {isUploading && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center">
           <div className="relative">
             <div className="w-16 h-16 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
               <i className="ph-fill ph-file-arrow-up text-white text-xl"></i>
             </div>
           </div>
           <h3 className="text-white font-bold mt-6 text-lg animate-pulse">Procesando Datos...</h3>
           <p className="text-slate-400 text-sm mt-2">Estamos construyendo tu dashboard</p>
        </div>
      )}

      {/* Modal de Confirmación */}
      <ConfirmModal 
        isOpen={showConfirmModal}
        title="Reemplazar Datos Existentes"
        message="Ya hay información cargada en el sistema. ¿Estás seguro de que deseas reemplazar los datos actuales con el nuevo archivo? Esta acción no se puede deshacer."
        onCancel={cancelReplace}
        onConfirm={confirmReplace}
      />

      {/* Notificaciones */}
      <Notification message={notification?.message} type={notification?.type} onClose={() => setNotification(null)} />

      <div className="p-4 lg:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header Siempre Visible */}
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl shadow-lg shadow-slate-900/20">
                  <i className="ph-fill ph-chart-line-up text-amber-500 text-2xl"></i>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Executive Dashboard</h1>
              </div>
              <p className="text-slate-500 font-medium ml-12">Performance Analytics & Control de Metas</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-slate-200">
              <label className="group cursor-pointer px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/30">
                <i className="ph ph-file-xls font-bold text-amber-500"></i>
                <span>Importar Datos</span>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileSelect} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
              </label>
              
              <button 
                onClick={handleLogout}
                className="px-4 py-2.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                title="Cerrar Sesión"
              >
                <i className="ph-bold ph-sign-out"></i>
              </button>
            </div>
          </header>

          {/* ESTADO VACIO: Mostrar Hero de Carga */}
          {agents.length === 0 ? (
             <div className="hero-upload animate-fade-in space-y-4">
                <div className="p-6 bg-slate-100 rounded-full text-slate-400">
                    <i className="ph-duotone ph-cloud-arrow-up text-6xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-slate-700">Comencemos</h2>
                <p className="text-slate-500 max-w-md">
                    {dataLoading ? "Sincronizando datos de la nube..." : "No hay datos cargados en el sistema. Sube tu archivo Excel para visualizar las métricas."}
                </p>
                {!dataLoading && (
                    <label className="cursor-pointer px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2">
                        <i className="ph-bold ph-upload-simple"></i>
                        Subir Archivo Excel
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileSelect} 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                        />
                    </label>
                )}
             </div>
          ) : (
            <>
              {/* CONTENIDO DASHBOARD (Solo si hay agentes) */}
              
              {/* Panel de Parámetros */}
              <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-8 h-[3px] bg-amber-500 rounded-full"></span>
                    Métricas de Control Diario
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="metric-mini-exec bg-amber-50/50 border-amber-200/50">
                    <div className="text-[10px] font-extrabold text-amber-700 uppercase mb-1">Ritmo Esperado Hoy</div>
                    <div className="text-2xl font-black text-amber-600">{(targetPercentToday * 100).toFixed(0)}%</div>
                  </div>
                  <div className="metric-mini-exec">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Mes x Agente</div>
                    <div className="text-xl font-bold text-slate-800">{fmtMoney(goalMonthAgent)}</div>
                  </div>
                  <div className="metric-mini-exec">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Día x Agente</div>
                    <div className="text-xl font-bold text-slate-800">{fmtMoney(goalDailyAgent)}</div>
                  </div>
                  <div className="metric-mini-exec">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Mes Call Center</div>
                    <div className="text-xl font-bold text-slate-800">{fmtMoney(goalMonthCC)}</div>
                  </div>
                  <div className="metric-mini-exec">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meta Día Call Center</div>
                    <div className="text-xl font-bold text-slate-800">{fmtMoney(goalDailyCC)}</div>
                  </div>
                </div>
              </section>

              {/* Nueva Sección: Análisis de Ventas Diarias */}
              <section className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                      <i className="ph ph-chart-line-up text-amber-500 text-xl"></i>
                      Ventas Día a Día (Año en Curso)
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Tendencia Diaria vs Anterior
                    </div>
                  </div>
                  <div className="h-48 w-full relative">
                     <canvas ref={lineChartRef}></canvas>
                  </div>
              </section>

              {/* KPI Principal Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`glass-card p-6 border-l-4 ${isCCAhead ? 'border-l-amber-500' : 'border-l-rose-500'}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Venta vs Cuota Hoy</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-slate-900">{fmtMoney(totalSales)}</span>
                    <span className="text-xs font-bold text-slate-400 mb-1.5">/ {fmtMoney(goalCCToday)}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isCCAhead ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      <i className={`ph-fill ${isCCAhead ? 'ph-trend-up' : 'ph-trend-down'}`}></i>
                      {isCCAhead ? 'Sobre Cuota' : 'Bajo Cuota'}
                    </span>
                  </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-blue-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Run Rate Cierre</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-slate-900">{fmtMoney(totalSales / config.daysElapsed * config.daysTotal)}</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xs font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full uppercase">Proyección Estimada</span>
                  </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-slate-900">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Saldo Pendiente</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-slate-900">{fmtMoney(Math.max(0, goalMonthCC - totalSales))}</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-xs font-bold text-slate-500">Faltan {config.daysTotal - config.daysElapsed} días hábiles</span>
                  </div>
                </div>
              </div>

              {/* Secciones de Análisis */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Columna Izquierda: Tabla y Comparativo */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Histórico Visual */}
                  <div className="glass-card p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                        <i className="ph ph-trend-up text-amber-500 text-xl"></i>
                        Evolución Anual Comparativa
                      </h3>
                    </div>
                    <div className="h-60 w-full relative">
                      <canvas ref={barChartRef}></canvas>
                    </div>
                  </div>

                  {/* Tabla Ejecutiva */}
                  <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/40">
                      <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
                        <i className="ph ph-users-four text-amber-500 text-xl"></i>
                        Ranking de Operaciones
                      </h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/50">
                            <th className="px-8 py-4 font-black">Asesor Comercial</th>
                            <th className="px-6 py-4 font-black text-right">Venta Real</th>
                            <th className="px-6 py-4 font-black text-right">Brecha Meta</th>
                            <th className="px-6 py-4 font-black text-center">Cumplimiento</th>
                            <th className="px-8 py-4 font-black text-center">Estatus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {processedAgents.map((agent, index) => {
                            const percentage = agent.percent * 100;
                            const isAhead = agent.percent >= targetPercentToday;
                            
                            let rankColor = 'bg-slate-100 text-slate-600';
                            if(index === 0) rankColor = 'bg-amber-100 text-amber-700 ring-2 ring-amber-400';
                            if(index === 1) rankColor = 'bg-slate-200 text-slate-700';
                            if(index === 2) rankColor = 'bg-orange-100 text-orange-800';

                            return (
                              <tr key={index} className="group transition-all hover:bg-white/60">
                                <td className="px-8 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full ${rankColor} flex items-center justify-center text-xs font-bold transition-all`}>
                                      {index + 1}
                                    </div>
                                    <span className="font-bold text-slate-700 tracking-tight">{agent.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-900">${agent.sales.toLocaleString('en-US')}</td>
                                <td className={`px-6 py-4 text-right font-bold ${agent.diff >= 0 ? 'text-amber-600' : 'text-rose-500'}`}>
                                  {agent.diff >= 0 ? '+' : ''}{Math.round(agent.diff).toLocaleString('en-US')}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="w-32 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                      <div className="bg-slate-900 h-1.5 rounded-full transition-all duration-1000" style={{width: `${Math.min(percentage, 100)}%`}}></div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500">{percentage.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-8 py-4 flex justify-center">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isAhead ? 'bg-amber-100 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
                                    <i className={`ph-fill ${isAhead ? 'ph-check-circle' : 'ph-warning-circle'}`}></i>
                                    {isAhead ? 'Objetivo OK' : 'En Alerta'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Gráfico de Pastel y Rankings */}
                <div className="space-y-6">
                  {/* Market Share */}
                  <div className="glass-card p-8 flex flex-col items-center">
                    <div className="w-full mb-6">
                      <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                        <i className="ph ph-chart-pie-slice text-amber-500 text-xl"></i>
                        Market Share Interno
                      </h3>
                    </div>
                    
                    <div className="relative w-full aspect-square max-w-[260px]">
                      <canvas ref={pieChartRef}></canvas>
                    </div>
                    
                    <div className="mt-8 w-full p-6 rounded-2xl bg-slate-900 text-center text-white shadow-xl shadow-slate-900/30 ring-1 ring-white/10">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volumen Total Operado</p>
                      <p className="text-4xl font-black text-white">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

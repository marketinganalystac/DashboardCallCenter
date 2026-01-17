import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

// --- CONFIGURACIÓN FIREBASE (MANDATORY PATTERN) ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  // Estado para los datos de los agentes
  const [agents, setAgents] = useState([
    { name: "Jackeline Hernández", sales: 693.00 },
    { name: "Kimberly Tuñón", sales: 12286.92 },
    { name: "Asley Ortega", sales: 7846.06 }
  ]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Refs para los gráficos y charts
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const pieInstance = useRef(null);
  const barInstance = useRef(null);

  // 1. Autenticación Firebase
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
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

  // 2. Sincronización de Datos (Firestore -> App)
  useEffect(() => {
    if (!user) return;

    // Usamos una colección pública para este ejemplo de dashboard compartido
    // Regla 1: Strict Paths -> /artifacts/{appId}/public/data/{collectionName}
    const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');

    const unsubscribe = onSnapshot(dataRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.agents && Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Cargar Scripts Externos (Tailwind Config, ChartJS, Phosphor, XLSX)
  useEffect(() => {
    // Inject Tailwind Config
    const tailwindConfigScript = document.createElement('script');
    tailwindConfigScript.text = `
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              navy: { 800: '#1e3a8a', 900: '#0f172a' },
              amber: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' }
            }
          }
        }
      }
    `;
    document.head.appendChild(tailwindConfigScript);

    // Inject External Libraries
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
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
      // Forzar re-render de charts una vez cargadas las librerías
      updateCharts();
    });

  }, []);

  // 4. Lógica de Renderizado de Gráficos (Effect separado que depende de agents)
  useEffect(() => {
    if (typeof Chart === 'undefined') return; // Esperar a que cargue ChartJS
    updateCharts();
  }, [agents]);

  const updateCharts = () => {
    if (typeof Chart === 'undefined') return;

    // Configuración Global
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = "#64748b";

    // Preparar datos
    const processedAgents = [...agents].sort((a, b) => b.sales - a.sales);

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

    // --- BAR CHART ---
    if (barChartRef.current) {
      if (barInstance.current) barInstance.current.destroy();

      // Plugin personalizado (recreado en React)
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
          labels: ['2023', '2024', '2025 (PROY)'],
          datasets: processedAgents.slice(0, 4).map((agent, i) => ({
            label: agent.name.split(' ')[0],
            data: [
              agent.sales * 0.8,
              agent.sales * 0.9,
              agent.sales * 1.15
            ],
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
            y: { 
              beginAtZero: true, 
              grid: { color: '#f1f5f9', drawBorder: false },
              ticks: { callback: v => '$' + v/1000 + 'k', color: '#94a3b8', font: {size: 10} },
              border: { display: false }
            },
            x: { 
              grid: { display: false },
              ticks: { color: '#64748b', font: {weight: 'bold'} }
            }
          },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, padding: 20, font: {size: 11} } },
            tooltip: { backgroundColor: '#0f172a', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12 }, cornerRadius: 8, displayColors: false }
          }
        },
        plugins: [growthLabelPlugin]
      });
    }
  };

  // 5. Manejo de Archivo Excel
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || typeof XLSX === 'undefined') return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
      
      let colIndices = { name: 0, sales: 1 }; 
      const headers = jsonData[0]; 
      
      if (headers && Array.isArray(headers)) {
        headers.forEach((h, idx) => {
          const txt = String(h).toLowerCase();
          if (txt.includes('asesor') || txt.includes('nombre') || txt.includes('agente')) colIndices.name = idx;
          if (txt.includes('venta') || txt.includes('total') || txt.includes('monto') || txt.includes('sales')) colIndices.sales = idx;
        });
      }

      const newAgents = [];
      for(let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[colIndices.name]) continue;
        newAgents.push({
          name: String(row[colIndices.name]).trim(),
          sales: parseFloat(String(row[colIndices.sales]).replace(/[^0-9.-]+/g,"")) || 0
        });
      }

      if(newAgents.length > 0) {
        // ACTUALIZAR FIRESTORE
        if (user) {
          try {
             // Rule 1: /artifacts/{appId}/public/data/{collectionName}
            const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_metrics', 'current_period');
            await setDoc(dataRef, { agents: newAgents });
            alert("Datos importados y guardados en la nube correctamente.");
          } catch (err) {
            console.error(err);
            alert("Error al guardar en la nube.");
          }
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- CÁLCULOS PARA RENDERIZADO (Replicando lógica original) ---
  const config = { daysTotal: 25, daysElapsed: 10, goalAgentFixed: 15000 };
  const targetPercentToday = config.daysElapsed / config.daysTotal;
  const goalMonthAgent = config.goalAgentFixed;
  const goalDailyAgent = goalMonthAgent / config.daysTotal;
  const totalAgents = agents.length;
  const goalMonthCC = goalMonthAgent * totalAgents;
  const goalDailyCC = goalMonthCC / config.daysTotal;

  const processedAgents = agents.map(agent => {
    const percent = agent.sales / goalMonthAgent;
    return {
      ...agent,
      goal: goalMonthAgent,
      diff: agent.sales - goalMonthAgent,
      percent: percent
    };
  }).sort((a, b) => b.sales - a.sales);

  const totalSales = processedAgents.reduce((acc, curr) => acc + curr.sales, 0);
  const goalCCToday = goalDailyCC * config.daysElapsed;
  const isCCAhead = totalSales >= goalCCToday;
  const fmtMoney = (n) => '$' + n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});

  // --- ESTILOS EN LINEA (Reemplazo de <style>) ---
  // Nota: Usamos una constante de estilo para inyectar CSS custom que no es Tailwind
  const customStyles = `
    :root { --primary: #0f172a; --accent: #f59e0b; --glass: rgba(255, 255, 255, 0.85); }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color: #1e293b; min-height: 100vh; }
    .glass-card {
        background: var(--glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 20px;
        box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05); transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
    }
    .glass-card:hover { transform: translateY(-5px); box-shadow: 0 12px 30px -4px rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); }
    .status-badge { @apply px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5; }
    .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .metric-mini-exec {
        background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 16px; padding: 1rem; text-align: center; transition: all 0.3s ease;
    }
    .metric-mini-exec:hover { border-color: var(--accent); background: #fff; }
  `;

  return (
    <>
      <style>{customStyles}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      
      <div className="p-4 lg:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header Dinámico */}
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
              <div className="flex flex-col px-4 border-r border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ciclo Actual</span>
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1">
                  <i className="ph ph-calendar text-amber-500"></i> Enero 2025
                </span>
              </div>
              <div className="flex flex-col px-4 border-r border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Progreso Tiempo</span>
                <span className="text-sm font-bold text-slate-900">10 / 25 <span className="text-slate-400 font-normal">Días</span></span>
              </div>
              <label className="group cursor-pointer px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/30">
                <i className="ph ph-file-xls font-bold text-amber-500"></i>
                <span>Importar Datos</span>
                <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />
              </label>
            </div>
          </header>

          {/* Panel de Parámetros Moderno */}
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

          {/* Top/Bottom Products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 3 Productos */}
            <div className="glass-card p-5 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-amber-100 rounded text-amber-600">
                  <i className="ph-fill ph-trophy"></i>
                </div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Top 3 Productos Más Vendidos</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-300">01</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Plan Premium Anual</p>
                      <p className="text-[10px] text-slate-400">Categoría: Suscripción</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">+15% vs LY</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-300">02</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Seguro Protección Total</p>
                      <p className="text-[10px] text-slate-400">Categoría: Seguros</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">+8% vs LY</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-300">03</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Asistencia Vial Plus</p>
                      <p className="text-[10px] text-slate-400">Categoría: Servicios</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">+4% vs LY</span>
                </div>
              </div>
            </div>

            {/* Bottom 3 Productos */}
            <div className="glass-card p-5 border-l-4 border-l-slate-400">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-slate-100 rounded text-slate-600">
                  <i className="ph-fill ph-trend-down"></i>
                </div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">3 Productos Menos Vendidos</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-300">01</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Plan Básico Mensual</p>
                      <p className="text-[10px] text-slate-400">Rotación Lenta</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded">-12% vs LY</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-300">02</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Tarjeta Regalo Digital</p>
                      <p className="text-[10px] text-slate-400">Baja Demanda</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded">-5% vs LY</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-300">03</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Accesorio Promocional</p>
                      <p className="text-[10px] text-slate-400">Stock Estancado</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded">-2% vs LY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico Visual */}
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                <i className="ph ph-trend-up text-amber-500 text-xl"></i>
                Evolución Anual Comparativa
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-3 py-1 rounded-full">Incluye Variación %</span>
            </div>
            <div className="h-80 w-full relative">
              <canvas ref={barChartRef}></canvas>
            </div>
          </div>

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

              {/* Ranking Departamental */}
              <div className="glass-card p-6">
                <div className="w-full mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-sm">
                    <i className="ph ph-buildings text-amber-500 text-lg"></i>
                    Ranking Departamentos
                  </h3>
                </div>
                <div className="space-y-4">
                  {/* Dept 1 */}
                  <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-700">1. Ventas Outbound</span>
                      <span className="text-xs font-black text-slate-900">$145,200</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-slate-900 h-2 rounded-full w-[85%]"></div>
                    </div>
                  </div>
                  {/* Dept 2 */}
                  <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-700">2. Retención</span>
                      <span className="text-xs font-black text-slate-900">$98,400</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full w-[60%]"></div>
                    </div>
                  </div>
                  {/* Dept 3 */}
                  <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-700">3. Soporte / Upsell</span>
                      <span className="text-xs font-black text-slate-900">$45,100</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-slate-400 h-2 rounded-full w-[35%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

// --- CONFIGURACIÓN FIREBASE ---
const userFirebaseConfig = {
  apiKey: "AIzaSyAY5PNoQqvkMVOgInqpn4tkIAdFFcKQZx0", // Note: Usually handled via env vars, kept for continuity
  authDomain: "dashboardcallcenter-6d8cf.firebaseapp.com",
  projectId: "dashboardcallcenter-6d8cf",
  storageBucket: "dashboardcallcenter-6d8cf.firebasestorage.app",
  messagingSenderId: "418436578818",
  appId: "1:418436578818:web:3ddabc1b56e2a1eeacf11b",
  measurementId: "G-DQT1X9X1C4"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SIMULACIÓN DE DATOS TIPO EXCEL (2026.xlsx) ---
// Genera datos con la estructura exacta solicitada:
// Año, AñoMes, Fecha Fac, Bodega, Sucursal, Departamento, Categoria_L2, Linea, Categoria_L3, Nombre Vendedor, Cantidad, Venta, Costo
const generateExcelData = () => {
  const vendors = ['ASLEY ORTEGA', 'KIMBERLY TUNON', 'JORGE PEREZ', 'MARIA GONZALEZ'];
  const branches = ['BRISAS DEL GOLF', 'VISTA HERMOSA', 'CHITRE', 'DAVID'];
  const departments = ['ABRASIVOS', 'REPUESTOS', 'ACCESORIOS', 'LUBRICANTES'];
  
  const categories = {
    'ABRASIVOS': ['NORTON ABRASIVOS', 'LOCTITE - HENKEL', '3M'],
    'REPUESTOS': ['FILTROS - PREMIUM', 'WIX', 'BOSCH'],
    'ACCESORIOS': ['ACCESORIOS OUYA', 'GOLDMINATE', 'SPARCO'],
    'LUBRICANTES': ['SHELL', 'CASTROL', 'MOBIL']
  };

  const data = [];
  const rows = 150; // Cantidad de filas simuladas

  for (let i = 0; i < rows; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const catL2 = categories[dept][Math.floor(Math.random() * categories[dept].length)];
    const venta = parseFloat((Math.random() * 100 + 5).toFixed(2));
    const costo = parseFloat((venta * 0.6).toFixed(2)); // Margen simulado

    data.push({
      Año: 2026,
      AñoMes: '2026-01',
      'Fecha Fac': `2026-01-${Math.floor(Math.random() * 30) + 1}`,
      Bodega: branches[Math.floor(Math.random() * branches.length)],
      Sucursal: branches[Math.floor(Math.random() * branches.length)], // Asumiendo misma bodega y sucursal para simpleza
      Departamento: dept,
      Categoria_L2: catL2,
      Linea: `${Math.floor(Math.random() * 500)} ${catL2}`,
      Categoria_L3: 'GENERAL',
      'Nombre Vendedor': vendors[Math.floor(Math.random() * vendors.length)],
      Cantidad: Math.floor(Math.random() * 10) + 1,
      Venta: venta,
      Costo: costo
    });
  }
  return data;
};

// --- COMPONENTE DE LOGIN (NUEVO) ---
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Simulación de login o login real anónimo para demo
    try {
      // Para efectos de este demo, usamos login anónimo si no hay credenciales reales configuradas,
      // pero simulamos la experiencia de usuario de ingresar datos.
      await signInAnonymously(auth);
      // Si quisieras usar email/pass real: await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Error al iniciar sesión. Intente nuevamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <i className="ph-fill ph-lock-key text-white text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Bienvenido</h2>
            <p className="text-slate-400 text-sm">Ingrese sus credenciales para acceder al Dashboard 2026</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Usuario</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="ph ph-user text-slate-400 group-focus-within:text-blue-400 transition-colors"></i>
                </div>
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 text-white text-sm rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                  placeholder="admin@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="ph ph-lock text-slate-400 group-focus-within:text-blue-400 transition-colors"></i>
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 text-white text-sm rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="ph ph-spinner animate-spin text-lg"></i>
                  <span>Ingresando...</span>
                </>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]); // Ahora guardará los datos tipo Excel
  const [loading, setLoading] = useState(true);
  const pieChartRef = useRef(null);
  const chartInstance = useRef(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Al autenticarse, cargamos los datos simulados del Excel
        const excelData = generateExcelData();
        setData(excelData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Procesamiento de datos para visualización
  // Calculamos totales y agrupamos por Categoria_L2 para el gráfico
  const { totalSales, chartData, topVendors } = useMemo(() => {
    if (data.length === 0) return { totalSales: 0, chartData: {}, topVendors: [] };

    // 1. Total Ventas
    const total = data.reduce((acc, row) => acc + (row.Venta || 0), 0);

    // 2. Datos para Gráfico (Agrupado por Categoria_L2)
    const salesByCategory = data.reduce((acc, row) => {
      const cat = row.Categoria_L2 || 'Otros';
      acc[cat] = (acc[cat] || 0) + (row.Venta || 0);
      return acc;
    }, {});

    // 3. Top Vendedores (Para mostrar en algún lado si se requiere, o para depuración)
    const salesByVendor = data.reduce((acc, row) => {
      const vendor = row['Nombre Vendedor'] || 'Desconocido';
      acc[vendor] = (acc[vendor] || 0) + (row.Venta || 0);
      return acc;
    }, {});
    
    const sortedVendors = Object.entries(salesByVendor)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5); // Top 5

    return {
      totalSales: total,
      chartData: salesByCategory,
      topVendors: sortedVendors
    };
  }, [data]);

  // Chart.js Logic
  useEffect(() => {
    if (!pieChartRef.current || !window.Chart || Object.keys(chartData).length === 0) return;

    // Destruir anterior si existe
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = pieChartRef.current.getContext('2d');
    
    // Configuración de colores
    const colors = [
      '#6366f1', // Indigo
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#10b981', // Emerald
      '#f59e0b', // Amber
    ];

    chartInstance.current = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(chartData),
        datasets: [{
          data: Object.values(chartData),
          backgroundColor: colors.slice(0, Object.keys(chartData).length),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        cutout: '75%',
        plugins: {
          legend: {
            display: false // Ocultamos leyenda por defecto del canvas para usar la custom si hubiera
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 12,
            titleFont: { family: 'sans-serif', size: 13 },
            bodyFont: { family: 'sans-serif', size: 13 },
            cornerRadius: 8,
            displayColors: true
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData]); // Re-render when chartData changes

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <i className="ph ph-spinner animate-spin text-blue-500 text-3xl"></i>
      </div>
    );
  }

  // Si no está logueado, mostrar Login
  if (!user) {
    return <LoginScreen />;
  }

  // --- DASHBOARD (Layout original preservado) ---
  return (
    <>
      {/* External Scripts needed for the UI */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <script src="https://unpkg.com/@phosphor-icons/web"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      
      <div className="min-h-screen bg-slate-950 text-slate-200 font-['Plus_Jakarta_Sans'] p-4 md:p-6 overflow-x-hidden selection:bg-indigo-500/30">
        
        {/* Background Gradients */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard <span className="text-indigo-500">2026</span></h1>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Datos actualizados en tiempo real
              </p>
            </div>
            <div className="flex items-center gap-3">
               <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-sm font-semibold text-white">Administrador</span>
                  <span className="text-xs text-slate-500">Vista Gerencial</span>
               </div>
               <button 
                onClick={() => signOut(auth)}
                className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-white/5 transition-all"
                title="Cerrar Sesión"
               >
                 <i className="ph ph-sign-out text-lg"></i>
               </button>
            </div>
          </header>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-card p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="ph-fill ph-trend-up text-6xl text-emerald-400"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Ventas Totales</p>
              <h3 className="text-3xl font-bold text-white mb-2">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">+12.5%</span>
                <span className="text-slate-500">vs mes anterior</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-xl relative overflow-hidden group">
               <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="ph-fill ph-users-three text-6xl text-blue-400"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Transacciones</p>
              <h3 className="text-3xl font-bold text-white mb-2">{data.length}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-semibold">+5.2%</span>
                <span className="text-slate-500">registros procesados</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-xl relative overflow-hidden group">
               <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="ph-fill ph-chart-bar text-6xl text-purple-400"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Margen Promedio</p>
              <h3 className="text-3xl font-bold text-white mb-2">40%</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 font-semibold">Estable</span>
                <span className="text-slate-500">Objetivo anual</span>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Data Table (Simulando vista detallada) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <i className="ph ph-table text-indigo-400"></i>
                    Desglose de Operaciones (Top 5)
                  </h3>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Ver todo</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-white/10">
                        <th className="pb-3 pl-2 font-semibold">Fecha</th>
                        <th className="pb-3 font-semibold">Vendedor</th>
                        <th className="pb-3 font-semibold">Depto / Línea</th>
                        <th className="pb-3 pr-2 font-semibold text-right">Venta</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {data.slice(0, 5).map((row, index) => (
                        <tr key={index} className="group border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-2 text-slate-300 font-mono text-xs">{row['Fecha Fac']}</td>
                          <td className="py-4 text-white font-medium">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300">
                                 {row['Nombre Vendedor'].charAt(0)}
                               </div>
                               {row['Nombre Vendedor']}
                            </div>
                          </td>
                          <td className="py-4 text-slate-400">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-300">{row.Departamento}</span>
                              <span className="text-[10px] opacity-70">{row.Categoria_L2}</span>
                            </div>
                          </td>
                          <td className="py-4 pr-2 text-right font-bold text-emerald-400">
                            ${row.Venta.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
               {/* Quick Action / Filter Banner */}
               <div className="glass-card bg-gradient-to-r from-indigo-900/40 to-blue-900/40 border border-indigo-500/20 rounded-2xl p-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-sm">Base de Datos 2026 Activa</h4>
                    <p className="text-indigo-200 text-xs mt-1">Estructura sincronizada con formato Excel (Hoja1).</p>
                  </div>
                  <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
                    Exportar Reporte
                  </button>
               </div>
            </div>

            {/* Right Column: Chart & Summary */}
            <div className="space-y-6">
              {/* Market Share Card */}
              <div className="glass-card bg-white/5 border border-white/5 rounded-3xl p-8 flex flex-col items-center backdrop-blur-xl">
                <div className="w-full mb-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <i className="ph ph-chart-pie-slice text-amber-500 text-xl"></i>
                    Mix por Categoría
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Distribución basada en volumen de ventas</p>
                </div>
                
                <div className="relative w-full aspect-square max-w-[260px]">
                  <canvas ref={pieChartRef}></canvas>
                  {/* Center Text Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="text-center">
                        <span className="block text-3xl font-bold text-white">{Object.keys(chartData).length}</span>
                        <span className="block text-[10px] text-slate-400 uppercase">Cats</span>
                     </div>
                  </div>
                </div>
                
                <div className="mt-8 w-full p-6 rounded-2xl bg-slate-900/80 text-center text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volumen Total Operado</p>
                  <p className="text-3xl font-black text-white tracking-tight">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                </div>

                {/* Legend List */}
                <div className="w-full mt-6 space-y-3">
                   {topVendors.map(([vendor, amount], i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                         <span className="text-slate-400">{vendor}</span>
                         <span className="text-white font-medium">${amount.toFixed(2)}</span>
                      </div>
                   ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      {/* Global Styles for Scrollbar & Glass */}
      <style jsx global>{`
        .glass-card {
           /* Base styles applied via Tailwind classes above, just ensuring consistency */
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        ::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}</style>
    </>
  );
}

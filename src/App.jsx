import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, limit } from 'firebase/firestore';
import Chart from 'chart.js/auto';

// --- CONFIGURACIÓN FIREBASE (Preservada del original) ---
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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [topVendors, setTopVendors] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const pieChartRef = useRef(null);
  const chartInstance = useRef(null);

  // --- 1. AUTENTICACIÓN ---
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. LOGICA MATEMATICA CORREGIDA (AGREGACIÓN) ---
  const processRawData = (data) => {
    // Mapas para agregar totales
    const vendorMap = {};
    const categoryMap = {};
    const productMap = {};
    let grandTotal = 0;

    data.forEach(row => {
      // Normalizar nombres y asegurar números
      const vendor = row['Nombre Vendedor'] || row.vendor || 'Desconocido';
      const category = row['Departamento'] || row.category || 'Sin Categoría';
      // Usamos Categoria_L3 como nombre del producto, o Linea como fallback
      const product = row['Categoria_L3'] || row['Linea'] || 'Producto General'; 
      const amount = parseFloat(row['Venta'] || row.amount || 0);

      if (!isNaN(amount)) {
        grandTotal += amount;

        // Sumarizar Vendedores
        if (vendorMap[vendor]) {
          vendorMap[vendor] += amount;
        } else {
          vendorMap[vendor] = amount;
        }

        // Sumarizar Categorías
        if (categoryMap[category]) {
          categoryMap[category] += amount;
        } else {
          categoryMap[category] = amount;
        }

        // Sumarizar Productos
        if (productMap[product]) {
          productMap[product] += amount;
        } else {
          productMap[product] = amount;
        }
      }
    });

    // Convertir mapas a arrays ordenados para ranking
    const sortedVendors = Object.entries(vendorMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const sortedCategories = Object.entries(categoryMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const sortedProducts = Object.entries(productMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    // Actualizar estados
    setTotalSales(grandTotal);
    setTopVendors(sortedVendors);
    setTopCategories(sortedCategories);
    setTopProducts(sortedProducts);
  };

  // --- 3. CARGA DE DATOS (CSV O FIRESTORE) ---
  // Listener para CSV Upload (Método principal para trabajar con el excel adjunto)
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = parseCSV(text);
        processRawData(rows);
      };
      reader.readAsText(file);
    }
  };

  // Parser simple de CSV
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { 
          values.push(current.trim().replace(/^"|"$/g, '')); 
          current = ''; 
        } else { current += char; }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));

      const entry = {};
      headers.forEach((h, i) => entry[h] = values[i]);
      return entry;
    });
  };

  // --- 4. RENDERIZADO DE GRÁFICO (PIE CHART) ---
  useEffect(() => {
    if (pieChartRef.current && topVendors.length > 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = pieChartRef.current.getContext('2d');
      const top5Vendors = topVendors.slice(0, 5);
      const otherTotal = topVendors.slice(5).reduce((acc, curr) => acc + curr.total, 0);
      
      const labels = top5Vendors.map(v => v.name);
      const data = top5Vendors.map(v => v.total);
      if (otherTotal > 0) {
        labels.push('Otros');
        data.push(otherTotal);
      }

      chartInstance.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              '#f59e0b', // Amber 500
              '#3b82f6', // Blue 500
              '#10b981', // Emerald 500
              '#8b5cf6', // Violet 500
              '#ec4899', // Pink 500
              '#64748b'  // Slate 500
            ],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false // Ocultamos leyenda por defecto para limpieza visual
            }
          },
          cutout: '70%',
        }
      });
    }
  }, [topVendors]);

  // --- 5. CARGA DE ICONOS ---
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@phosphor-icons/web';
    document.head.appendChild(link);
  }, []);

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-amber-100 selection:text-amber-900 pb-20">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <i className="ph-bold ph-chart-bar text-xl"></i>
              </div>
              <div>
                <h1 className="font-black text-xl tracking-tight text-slate-900 leading-none">Ventas<span className="text-amber-500">2026</span></h1>
                <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Dashboard Analítico</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Input para Cargar Excel/CSV */}
               <label className="cursor-pointer px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-all flex items-center gap-2">
                <i className="ph ph-upload-simple"></i>
                <span>Cargar Excel (CSV)</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">Admin User</p>
                  <p className="text-xs text-slate-500">Gerente Regional</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 ring-2 ring-white shadow-sm overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="Avatar" className="w-full h-full" />
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          
          {loading ? (
             <div className="flex items-center justify-center h-64">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
             </div>
          ) : (
            <>
              {/* Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-card p-6 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between h-32 relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <i className="ph-duotone ph-currency-dollar text-8xl text-amber-500"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Ventas</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-50 w-fit px-2 py-1 rounded-md">
                    <i className="ph-bold ph-trend-up"></i>
                    <span>+12.5% vs mes anterior</span>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between h-32 relative overflow-hidden group">
                   <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <i className="ph-duotone ph-users-three text-8xl text-blue-500"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Vendedores Activos</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">{topVendors.length}</h3>
                  </div>
                   <div className="flex items-center gap-2 text-blue-500 text-xs font-bold bg-blue-50 w-fit px-2 py-1 rounded-md">
                    <i className="ph-bold ph-check-circle"></i>
                    <span>Totalizados y Agrupados</span>
                  </div>
                </div>

                 <div className="glass-card p-6 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between h-32 relative overflow-hidden group">
                   <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <i className="ph-duotone ph-tag text-8xl text-purple-500"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Categorías Top</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">{topCategories.length}</h3>
                  </div>
                   <div className="flex items-center gap-2 text-purple-500 text-xs font-bold bg-purple-50 w-fit px-2 py-1 rounded-md">
                    <i className="ph-bold ph-stack"></i>
                    <span>Departamentos Únicos</span>
                  </div>
                </div>
              </div>

              {/* Grid Principal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Columna Izquierda: Tablas Detalladas */}
                <div className="lg:col-span-2 space-y-8">
                  
                  {/* Ranking Vendedores */}
                  <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                        <i className="ph-duotone ph-trophy text-amber-500 text-2xl"></i>
                        Top Vendedores (Consolidado)
                      </h3>
                      <button className="text-slate-400 hover:text-amber-500 transition-colors">
                        <i className="ph-bold ph-dots-three-outline-vertical text-xl"></i>
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                            <th className="p-4 pl-6">#</th>
                            <th className="p-4">Vendedor</th>
                            <th className="p-4">Rendimiento</th>
                            <th className="p-4 pr-6 text-right">Total Ventas</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {topVendors.slice(0, 10).map((vendor, index) => (
                            <tr key={index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                              <td className="p-4 pl-6 font-bold text-slate-300 group-hover:text-amber-500 transition-colors">
                                {index + 1 < 10 ? `0${index + 1}` : index + 1}
                              </td>
                              <td className="p-4 font-bold text-slate-700">{vendor.name}</td>
                              <td className="p-4 w-1/3">
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                                    style={{ width: `${(vendor.total / topVendors[0].total) * 100}%` }}
                                  ></div>
                                </div>
                              </td>
                              <td className="p-4 pr-6 text-right font-black text-slate-800">
                                ${vendor.total.toLocaleString('en-US', {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          ))}
                          {topVendors.length === 0 && (
                            <tr>
                              <td colSpan="4" className="p-8 text-center text-slate-400 italic">
                                Carga un archivo CSV para ver los datos
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Ranking Productos / Categorias */}
                   <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                        <i className="ph-duotone ph-package text-blue-500 text-2xl"></i>
                        Top Categorías (Departamentos)
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                            <th className="p-4 pl-6">Categoría</th>
                            <th className="p-4 text-right">Participación</th>
                            <th className="p-4 pr-6 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {topCategories.slice(0, 5).map((cat, index) => (
                            <tr key={index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 pl-6 font-bold text-slate-700">{cat.name}</td>
                              <td className="p-4 text-right text-slate-500 font-medium">
                                {((cat.total / totalSales) * 100).toFixed(1)}%
                              </td>
                              <td className="p-4 pr-6 text-right font-black text-slate-800">
                                ${cat.total.toLocaleString('en-US', {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          ))}
                           {topCategories.length === 0 && (
                            <tr>
                              <td colSpan="3" className="p-8 text-center text-slate-400 italic">
                                Sin datos disponibles
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Gráfico de Pastel y Rankings */}
                <div className="space-y-6">
                  {/* Market Share */}
                  <div className="glass-card p-8 flex flex-col items-center bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100">
                    <div className="w-full mb-6">
                      <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                        <i className="ph-fill ph-chart-pie-slice text-amber-500 text-xl"></i>
                        Market Share (Vendedores)
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Distribución del volumen de ventas totalizado.</p>
                    </div>
                    
                    <div className="relative w-full aspect-square max-w-[260px]">
                      <canvas ref={pieChartRef}></canvas>
                    </div>
                    
                    <div className="mt-8 w-full p-6 rounded-2xl bg-slate-900 text-center text-white shadow-xl shadow-slate-900/30 ring-1 ring-white/10">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volumen Total Operado</p>
                      <p className="text-4xl font-black text-white">${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                    </div>
                  </div>

                  {/* Top Product Hero (Mejor Producto Individual) */}
                   {topProducts.length > 0 && (
                    <div className="relative p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/20 overflow-hidden">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 opacity-80">
                           <i className="ph-bold ph-star text-yellow-300"></i>
                           <span className="text-xs font-bold uppercase tracking-widest">Producto Estrella</span>
                        </div>
                        <h4 className="font-bold text-lg leading-tight mb-4">{topProducts[0].name}</h4>
                        <div className="flex items-end gap-2">
                           <span className="text-3xl font-black">${topProducts[0].total.toLocaleString('en-US', {minimumFractionDigits: 0})}</span>
                           <span className="text-sm font-medium opacity-70 mb-1">generados</span>
                        </div>
                      </div>
                    </div>
                   )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default App;

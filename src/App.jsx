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

// --- UTILIDADES (sin cambios) ---
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

// --- COMPONENTES UI ANIMADOS (Podium mejorado) ---
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
                
                const visualHeight = index === 1 ? 'h-[90%]' : (index === 0 ? 'h-[75%]' : 'h-[60%]');

                return (
                    <div key={index} className={`flex flex-col items-center justify-end w-24 md:w-32 group ${visualHeight} transition-transform hover:scale-105 duration-300`}>
                        <div className={`mb-2 flex flex-col items-center transition-all duration-700 opacity-0 animate-fade-in-down ${delay} fill-mode-forwards`}>
                            <div className="font-bold text-slate-700 text-xs md:text-sm text-center line-clamp-1 mb-1">{agent.name.split(' ')[0]}</div>
                            <div className="font-black text-slate-900 text-sm md:text-base"><AnimatedCounter value={agent.sales} prefix="$" /></div>
                        </div>

                        <div className={`w-full h-full rounded-t-2xl bg-gradient-to-t ${colorClass} shadow-lg relative flex items-end justify-center pb-4 transition-all duration-1000 transform scale-y-0 animate-grow-up origin-bottom podium-bar`}>
                             {/* Badge más grande y mejor posicionado - color contrastante */}
                             <div className="absolute -top-6 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white border-[3px] border-slate-50 shadow-xl flex items-center justify-center z-20">
                                <span className={`font-black text-lg md:text-xl drop-shadow-sm ${index === 1 ? 'text-amber-600' : (index === 0 ? 'text-slate-700' : 'text-orange-600')}`}>
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

// ... (AnimatedCounter, CircularProgress, Notification, ConfirmModal, LoginScreen sin cambios)

export default function App() {
  // ... (todos los estados y hooks sin cambios)

  const updateCharts = () => {
    // ... (pie chart sin cambios)

    // BAR CHART - Evolución Histórica + variación vs año anterior por agente
    if (barChartRef.current) {
      if (barInstance.current) barInstance.current.destroy();
      
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
              barThickness: 28,
          });
      });

      // ... (unknownData y meta anual sin cambios)

      const ctxBar = barChartRef.current.getContext('2d');
      
      barInstance.current = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: yearsLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, stacked: false, grid: { color: '#f1f5f9' }, ticks: { callback: v => '$' + v/1000 + 'k' } },
            x: { stacked: false, grid: { display: false }, ticks: { font: {weight: 'bold'} } }
          },
          plugins: { 
              legend: { display: true, position: 'bottom', labels: { boxWidth: 8, font: {size: 10} } },
              tooltip: {
                  callbacks: {
                      label: (context) => {
                          let label = context.dataset.label || '';
                          if (label) label += ': ';
                          const currentVal = context.parsed.y;
                          label += new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(currentVal);
                          
                          // Variación vs año anterior por agente
                          if (context.dataIndex > 0) {
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

    // VENTAS DIARIAS - DENSITY STYLE (área suave) + triángulos dinámicos de variación
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
                    tension: 0.45,           // Curva suave estilo densidad
                    fill: true,
                    pointStyle: 'triangle',
                    pointRadius: 7,
                    pointHoverRadius: 10,
                    pointRotation: (ctx) => {
                        const g = growthRates[ctx.dataIndex];
                        return g >= 0 ? 0 : 180;
                    },
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

  // ... (resto de funciones y return sin cambios estructurales, solo podium actualizado y charts arriba)

  return (
    // ... (todo el return igual, con Podium ya actualizado en componente)
    // Ranking ahora tiene badge más grande y texto con color fuerte contrastante
    // Ventas Diarias ahora es área suave (density) con triángulos dinámicos verde/rojo
    // Evolución Histórica tiene variación % por agente en tooltip
  );
}

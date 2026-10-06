// src/components/envios/DashboardEnvios.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  TrendingUp,
  BarChart3,
  Truck,
  Clock,
  RefreshCw,
  Package,
  Layers,
  PieChart,
  Activity,
  Plus,
  Inbox,
  AlertCircle
} from "lucide-react";
import { getAllEnvios } from "../../services/envioService";
import { processarAnalyticsEnvios } from "../../services/envioAnalytics";
import styles from "./DashboardEnvios.module.css";

// Registro dos módulos do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Opções corporativas comuns para os gráficos (VendPago Design System)
const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 400
  },
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#475569",
        font: {
          size: 11,
          weight: "600",
          family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        },
        boxWidth: 12,
        padding: 14
      }
    },
    tooltip: {
      backgroundColor: "#001e40",
      titleColor: "#ffffff",
      bodyColor: "#ffffff",
      padding: 10,
      cornerRadius: 4,
      displayColors: true,
      titleFont: { size: 12, weight: "bold" },
      bodyFont: { size: 11 }
    }
  },
  scales: {
    x: {
      grid: {
        color: "#f1f5f9"
      },
      ticks: {
        color: "#64748b",
        font: { size: 11 }
      }
    },
    y: {
      grid: {
        color: "#f1f5f9"
      },
      ticks: {
        color: "#64748b",
        font: { size: 11 },
        precision: 0
      },
      beginAtZero: true
    }
  }
};

export default function DashboardEnvios({ onNavigateToNew = null, onNavigateToBacklog = null }) {
  const [enviosRaw, setEnviosRaw] = useState([]);
  const [filtroTempo, setFiltroTempo] = useState("mes"); // "7dias" | "mes" | "ano" | "geral"
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const dados = await getAllEnvios();
      setEnviosRaw(dados);
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Processa as métricas analíticas e datasets do Chart.js
  const analytics = useMemo(() => {
    return processarAnalyticsEnvios(enviosRaw, filtroTempo);
  }, [enviosRaw, filtroTempo]);

  // Opções customizadas para gráfico horizontal de top equipamentos
  const horizontalBarOptions = useMemo(() => ({
    ...commonChartOptions,
    indexAxis: "y",
    plugins: {
      ...commonChartOptions.plugins,
      legend: { display: false }
    },
    scales: {
      x: {
        ...commonChartOptions.scales.x,
        beginAtZero: true,
        ticks: { precision: 0 }
      },
      y: {
        ...commonChartOptions.scales.y,
        grid: { display: false },
        ticks: { color: "#001e40", font: { weight: "600", size: 11 } }
      }
    }
  }), []);

  // Opções para Doughnut de motivos
  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    cutout: "68%",
    plugins: {
      ...commonChartOptions.plugins,
      legend: {
        position: "bottom",
        labels: {
          color: "#475569",
          font: { size: 11, weight: "600" },
          padding: 12,
          boxWidth: 12
        }
      }
    }
  }), []);

  const totalGeralNoPeriodo = analytics.totalPacotes;

  return (
    <div className={styles.container}>
      {/* Cabeçalho do Painel */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Activity className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>Painel Analítico de Envios & Gestão AT</h2>
            <p className={styles.subtitle}>
              Monitoramento executivo de cadência, tempo de espera, motivos e equipamentos demandados
            </p>
          </div>
        </div>

        <div className={styles.headerControls}>
          {/* Seletor de Período Temporal */}
          <div className={styles.filterBar}>
            <button
              type="button"
              className={`${styles.filterTab} ${filtroTempo === "7dias" ? styles.filterTabActive : ""}`}
              onClick={() => setFiltroTempo("7dias")}
            >
              Últimos 7 Dias
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${filtroTempo === "mes" ? styles.filterTabActive : ""}`}
              onClick={() => setFiltroTempo("mes")}
            >
              Mês Atual
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${filtroTempo === "ano" ? styles.filterTabActive : ""}`}
              onClick={() => setFiltroTempo("ano")}
            >
              Ano Atual
            </button>
            <button
              type="button"
              className={`${styles.filterTab} ${filtroTempo === "geral" ? styles.filterTabActive : ""}`}
              onClick={() => setFiltroTempo("geral")}
            >
              Histórico Geral
            </button>
          </div>

          <button
            type="button"
            className={styles.btnRefresh}
            onClick={carregarDados}
            title="Recarregar dados"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </header>

      {/* Cards de KPIs Executivos */}
      <section className={styles.kpiGrid}>
        {/* KPI 1: Total de Pacotes & Unidades */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Volume de Envios</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
              <Truck size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{analytics.totalPacotes}</div>
          <div className={styles.kpiFooter}>
            <span>Pacotes registrados</span>
            <span style={{ fontWeight: 700, color: "var(--vp-navy-dark)" }}>
              {analytics.totalEquipamentosUnidades} itens/peças
            </span>
          </div>
        </div>

        {/* KPI 2: Cadência de Expedição */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Status da Esteira</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{analytics.totalConcluidos}</div>
          <div className={styles.kpiFooter}>
            <span style={{ color: "var(--vp-emerald-dark)", fontWeight: 700 }}>
              Despachados / Concluídos
            </span>
            <span style={{ color: "var(--vp-warning)", fontWeight: 600 }}>
              {analytics.totalPendentes} na bancada
            </span>
          </div>
        </div>

        {/* KPI 3: Lead Time Médio de Envio */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Tempo Médio de Espera</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconWarning}`}>
              <Clock size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {analytics.mediaLeadTimeDias} <span style={{ fontSize: "1rem", fontWeight: 600 }}>dias</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Média da bancada ao despacho</span>
            <span style={{ color: analytics.gargaloCritico > 0 ? "var(--vp-danger)" : "var(--vp-emerald-dark)", fontWeight: 700 }}>
              {analytics.gargaloCritico > 0 ? `${analytics.gargaloCritico} travados > 72h` : "Fluxo ágil"}
            </span>
          </div>
        </div>

        {/* KPI 4: Equipamento Mais Demandado */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Equipamento Campeão</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
              <Package size={17} />
            </div>
          </div>
          <div className={`${styles.kpiValue} ${styles.kpiValueHighlight}`} title={analytics.equipamentoTop}>
            {analytics.equipamentoTop}
          </div>
          <div className={styles.kpiFooter}>
            <span>Maior volume de saída</span>
            <span style={{ fontWeight: 600, color: "var(--vp-blue-primary)" }}>Líder do período</span>
          </div>
        </div>
      </section>

      {/* Seção Principal de Gráficos (React Chart.js 2) */}
      {totalGeralNoPeriodo === 0 ? (
        <div className={styles.emptyStateBanner}>
          <Inbox className={styles.emptyIcon} />
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--vp-navy-dark)" }}>
            Nenhum envio registrado no período selecionado
          </h3>
          <p style={{ maxWidth: "450px", margin: "0.4rem auto 0", fontSize: "0.82rem" }}>
            Alterne o filtro de período acima (ex: <em>Histórico Geral</em>) ou registre novas saídas de bancada para visualizar as curvas e comparativos.
          </p>
          {onNavigateToNew && (
            <button type="button" className={styles.emptyBtnAction} onClick={onNavigateToNew}>
              <Plus size={15} /> Cadastrar Envio na Bancada
            </button>
          )}
        </div>
      ) : (
        <div className={styles.chartsGrid}>
          {/* GRÁFICO 1: Evolução Temporal (Volume por Dia / Semana / Mês / Ano) */}
          <div className={`${styles.chartCard} ${styles.colFull}`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrapper}>
                <h3 className={styles.chartTitle}>
                  <TrendingUp size={16} color="var(--vp-blue-primary)" />
                  Evolução da Cadência de Envios
                </h3>
                <span className={styles.chartSubtitle}>
                  Volume cronológico de pacotes registrados vs. despachados conforme o ciclo ({filtroTempo.toUpperCase()})
                </span>
              </div>
              <span className={styles.chartBadge}>
                {filtroTempo === "7dias" ? "Visão Diária Recente" : filtroTempo === "mes" ? "Evolução do Mês" : filtroTempo === "ano" ? "Visão Mensal do Ano" : "Histórico Consolidado"}
              </span>
            </div>
            <div className={styles.chartCanvasBoxLarge}>
              <Line data={analytics.chartEvolucaoTemporal} options={commonChartOptions} />
            </div>
          </div>

          {/* GRÁFICO 2: Top Equipamentos Mais Enviados */}
          <div className={`${styles.chartCard} ${styles.colHalf}`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrapper}>
                <h3 className={styles.chartTitle}>
                  <BarChart3 size={16} color="var(--vp-navy-dark)" />
                  Equipamentos Mais Enviados
                </h3>
                <span className={styles.chartSubtitle}>
                  Ranking de modelos de terminais e kits mais demandados pela operação
                </span>
              </div>
              <span className={styles.chartBadge}>Top Saídas</span>
            </div>
            <div className={styles.chartCanvasBoxMedium}>
              {analytics.chartTopEquipamentos.labels.length > 0 ? (
                <Bar data={analytics.chartTopEquipamentos} options={horizontalBarOptions} />
              ) : (
                <div className={styles.emptyChartMessage}>
                  <AlertCircle size={20} />
                  <span>Nenhum equipamento catalogado neste ciclo.</span>
                </div>
              )}
            </div>
          </div>

          {/* GRÁFICO 3: Tempo de Espera até Despacho (Lead Time & Gargalos) */}
          <div className={`${styles.chartCard} ${styles.colHalf}`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrapper}>
                <h3 className={styles.chartTitle}>
                  <Clock size={16} color="var(--vp-warning)" />
                  Tempo de Espera até Despacho (Lead Time)
                </h3>
                <span className={styles.chartSubtitle}>
                  Distribuição de pacotes por dias de esteira da montagem até a expedição
                </span>
              </div>
              <span className={styles.chartBadge}>Gargalos Operacionais</span>
            </div>
            <div className={styles.chartCanvasBoxMedium}>
              <Bar data={analytics.chartTempoEspera} options={commonChartOptions} />
            </div>
          </div>

          {/* GRÁFICO 4: Distribuição por Motivo de Envio */}
          <div className={`${styles.chartCard} ${styles.colHalf}`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrapper}>
                <h3 className={styles.chartTitle}>
                  <PieChart size={16} color="var(--vp-blue-primary)" />
                  Distribuição por Motivo de Envio
                </h3>
                <span className={styles.chartSubtitle}>
                  Locação, Comercial, Suporte e Manutenção da Assistência Técnica
                </span>
              </div>
              <span className={styles.chartBadge}>Motivos AT</span>
            </div>
            <div className={styles.chartCanvasBoxDoughnut}>
              <Doughnut data={analytics.chartMotivos} options={doughnutOptions} />
            </div>
          </div>

          {/* GRÁFICO 5: Modalidades de Postagem & Canais de Frete */}
          <div className={`${styles.chartCard} ${styles.colHalf}`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrapper}>
                <h3 className={styles.chartTitle}>
                  <Layers size={16} color="var(--vp-emerald)" />
                  Canais & Modalidades de Despacho
                </h3>
                <span className={styles.chartSubtitle}>
                  Comparativo de envios por SEDEX, PAC, Retirada na VendPago e Transportadora
                </span>
              </div>
              <span className={styles.chartBadge}>Logística</span>
            </div>
            <div className={styles.chartCanvasBoxMedium}>
              <Bar data={analytics.chartModalidades} options={commonChartOptions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

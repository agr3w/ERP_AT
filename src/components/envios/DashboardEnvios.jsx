import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Truck,
  RefreshCw,
  FileWarning,
  Activity
} from "lucide-react";
import { getMetrics } from "../../services/envioService";
import styles from "./DashboardEnvios.module.css";

export default function DashboardEnvios({ onNavigateToBacklog = null }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregarMetricas = async () => {
    setLoading(true);
    try {
      const data = await getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Erro ao carregar métricas operacionais:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
  }, []);

  if (loading && !metrics) {
    return (
      <div className={styles.container} style={{ textAlign: "center", padding: "3rem" }}>
        <RefreshCw size={24} className="spin" style={{ color: "var(--vp-blue-primary)" }} />
        <p style={{ marginTop: "0.5rem", color: "var(--vp-text-muted)" }}>
          Calculando métricas operacionais de envios...
        </p>
      </div>
    );
  }

  const {
    totalGeral = 0,
    totalPendentes = 0,
    totalConcluidos = 0,
    totalEnviosNoMes = 0,
    cadenciaDiariaMedia = 0,
    caixasTravadasNfe = 0,
    caixasAtraso48h = 0,
    indiceTestados = 0,
    indiceDoubleCheck = 0,
    motivosRanking = [],
    tipoEnvioRanking = [],
    periodoReferencia = ""
  } = metrics || {};

  return (
    <div className={styles.container}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Activity className={styles.titleIcon} />
          <div>
            <h2 className={styles.title}>Painel de Indicadores & Gargalos de Envios</h2>
            <p className={styles.subtitle}>
              Métricas de cadência, tempo de espera fiscal e controle de qualidade da Assistência Técnica
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div className={styles.periodBadge}>
            <Calendar size={14} />
            <span>{periodoReferencia}</span>
          </div>

          <button
            type="button"
            className={styles.periodBadge}
            onClick={carregarMetricas}
            style={{ cursor: "pointer", background: "var(--vp-bg-subtle)" }}
            title="Atualizar indicadores"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Grid de Cards de KPI */}
      <div className={styles.kpiGrid}>
        {/* KPI 1: Total de Envios no Mês */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Envios no Mês</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
              <Truck size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>{totalEnviosNoMes}</div>
          <div className={styles.kpiFooter}>
            <span>Despachados neste ciclo</span>
            <span style={{ fontWeight: 600 }}>{totalConcluidos} concluídos ({totalGeral} total)</span>
          </div>
        </div>

        {/* KPI 2: Cadência Diária Média */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Cadência Diária Média</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>{cadenciaDiariaMedia}</div>
          <div className={styles.kpiFooter}>
            <span>Envios / dia de operação</span>
            <span style={{ color: "var(--vp-emerald-dark)", fontWeight: 600 }}>Média Ativa</span>
          </div>
        </div>

        {/* KPI 3: Caixas Travadas Aguardando NF-e (Gargalo Principal) */}
        <div
          className={`${styles.kpiCard} ${
            caixasAtraso48h > 0 ? styles.kpiCardCritical : styles.kpiCardWarning
          }`}
          style={{ cursor: onNavigateToBacklog ? "pointer" : "default" }}
          onClick={onNavigateToBacklog ? () => onNavigateToBacklog(true) : undefined}
          title="Clique para ir à fila de pendentes com alerta"
        >
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Aguardando NF-e</span>
            <div
              className={`${styles.kpiIconWrapper} ${
                caixasAtraso48h > 0 ? styles.iconCritical : styles.iconWarning
              }`}
            >
              {caixasAtraso48h > 0 ? <AlertTriangle size={18} /> : <Clock size={18} />}
            </div>
          </div>
          <div
            className={`${styles.kpiValue} ${
              caixasAtraso48h > 0 ? styles.kpiValueCritical : ""
            }`}
          >
            {caixasTravadasNfe}
          </div>
          <div className={styles.kpiFooter}>
            {caixasAtraso48h > 0 ? (
              <span style={{ color: "var(--vp-danger)", fontWeight: 700 }}>
                {caixasAtraso48h} caixas travadas há &gt; 48h
              </span>
            ) : (
              <span>Nenhum atraso crítico &gt; 48h</span>
            )}
            <span style={{ fontSize: "0.7rem", textDecoration: "underline" }}>Ver fila</span>
          </div>
        </div>

        {/* KPI 4: Qualidade Bancada (Testados / Double Check) */}
        <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Qualidade na Bancada</span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span className={styles.kpiValue}>{indiceTestados}%</span>
            <span style={{ fontSize: "0.85rem", color: "var(--vp-text-muted)" }}>
              / {indiceDoubleCheck}% DC
            </span>
          </div>
          <div className={styles.kpiFooter}>
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span>Testado: {indiceTestados}%</span>
                <span>Double Check: {indiceDoubleCheck}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${Math.min(100, indiceTestados)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seções Analíticas: Motivos e Modalidades */}
      <div className={styles.analyticsGrid}>
        {/* Painel 1: Motivos com Maior Volume de Saídas */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <BarChart3 size={16} /> Motivos com Maior Volume de Saídas
            </h3>
            <span className={styles.panelDesc}>Distribuição percentual e contagem</span>
          </div>

          <div className={styles.barList}>
            {motivosRanking.length === 0 ? (
              <p style={{ color: "var(--vp-text-muted)", fontSize: "0.85rem" }}>
                Sem dados suficientes de motivos registrados.
              </p>
            ) : (
              motivosRanking.map((item, idx) => (
                <div key={item.motivo} className={styles.barItem}>
                  <div className={styles.barMeta}>
                    <span className={styles.barLabel}>{item.motivo}</span>
                    <span className={styles.barValues}>
                      {item.quantidade} envio(s) ({item.percentual}%)
                    </span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${Math.min(100, item.percentual)}%`,
                        backgroundColor:
                          idx === 0
                            ? "var(--vp-navy-dark)"
                            : idx === 1
                            ? "var(--vp-blue-primary)"
                            : "var(--vp-blue-medium)"
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel 2: Status do Fluxo Operacional & Modalidades */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              <Layers size={16} /> Fluxo de Operação
            </h3>
            <span className={styles.panelDesc}>Estado atual</span>
          </div>

          <div className={styles.flowList}>
            <div className={styles.flowItem}>
              <div className={styles.flowLabel}>
                <Clock size={16} color="var(--vp-warning)" />
                <span>Na Bancada (Pendentes)</span>
              </div>
              <span
                className={styles.flowBadge}
                style={{
                  backgroundColor: "var(--vp-warning-light)",
                  color: "var(--vp-warning)"
                }}
              >
                {totalPendentes}
              </span>
            </div>

            <div className={styles.flowItem}>
              <div className={styles.flowLabel}>
                <FileWarning size={16} color="var(--vp-danger)" />
                <span>Gargalo Fiscal (&gt;48h)</span>
              </div>
              <span
                className={styles.flowBadge}
                style={{
                  backgroundColor: "var(--vp-danger-light)",
                  color: "var(--vp-danger)"
                }}
              >
                {caixasAtraso48h}
              </span>
            </div>

            <div className={styles.flowItem}>
              <div className={styles.flowLabel}>
                <CheckCircle2 size={16} color="var(--vp-emerald)" />
                <span>Despachados / Concluídos</span>
              </div>
              <span
                className={styles.flowBadge}
                style={{
                  backgroundColor: "var(--vp-emerald-light)",
                  color: "var(--vp-emerald-dark)"
                }}
              >
                {totalConcluidos}
              </span>
            </div>

            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--vp-border-light)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--vp-text-muted)", marginBottom: "0.5rem" }}>
                Canais de Envio
              </div>
              {tipoEnvioRanking.map((t) => (
                <div
                  key={t.tipo}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8rem",
                    padding: "0.25rem 0",
                    color: "var(--vp-text-secondary)"
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{t.tipo}</span>
                  <span>{t.quantidade} ({t.percentual}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

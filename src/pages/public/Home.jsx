import React, { useState, useEffect } from "react";
import {
  Boxes,
  PlusCircle,
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Laptop
} from "lucide-react";
import FormEnvioRapido from "../../components/envios/FormEnvioRapido";
import BacklogEnvios from "../../components/envios/BacklogEnvios";
import DashboardEnvios from "../../components/envios/DashboardEnvios";
import { getEnviosPendentes } from "../../services/envioService";
import styles from "./Home.module.css";

export default function Home() {
  const [currentView, setCurrentView] = useState("backlog"); // "backlog" | "novo" | "dashboard"
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const [resumoPendentes, setResumoPendentes] = useState({ total: 0, atrasados48h: 0 });

  useEffect(() => {
    let isMounted = true;

    const carregar = async () => {
      try {
        const pendentes = await getEnviosPendentes();
        if (!isMounted) return;
        const atrasados = pendentes.filter((item) => item.diasAguardandoNfe >= 2).length;
        setResumoPendentes({
          total: pendentes.length,
          atrasados48h: atrasados
        });
      } catch (err) {
        console.error("Erro ao carregar resumo de pendentes:", err);
      }
    };

    carregar();

    return () => {
      isMounted = false;
    };
  }, [currentView]);

  // Teclas de atalho para alternar visões: Alt+1, Alt+2, Alt+3
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          setCurrentView("backlog");
        } else if (e.key === "2") {
          e.preventDefault();
          setItemEmEdicao(null);
          setCurrentView("novo");
        } else if (e.key === "3") {
          e.preventDefault();
          setCurrentView("dashboard");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleEditItem = (item) => {
    setItemEmEdicao(item);
    setCurrentView("novo");
  };

  const handleFormSuccess = () => {
    setItemEmEdicao(null);
    setCurrentView("backlog");
  };

  const handleFormCancel = () => {
    setItemEmEdicao(null);
    setCurrentView("backlog");
  };

  return (
    <div className={styles.pageContainer}>
      {/* Topbar Institucional VendPago */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandArea}>
            <div className={styles.brandLogoBox}>
              <Cpu size={22} />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandCompany}>VendPago • Logística Técnica</span>
              <h1 className={styles.brandTitle}>Registro & Controle de Envios</h1>
            </div>
          </div>

          {/* Abas Principais de Navegação */}
          <nav className={styles.navTabs} aria-label="Visões do Sistema">
            <button
              type="button"
              className={`${styles.navTabBtn} ${
                currentView === "backlog" ? styles.navTabBtnActive : ""
              }`}
              onClick={() => {
                setItemEmEdicao(null);
                setCurrentView("backlog");
              }}
              title="Fila de envios pendentes e histórico concluído (Alt+1)"
            >
              <Boxes size={16} />
              <span>Fila / Backlog</span>
              <span
                className={`${styles.navBadge} ${
                  resumoPendentes.atrasados48h > 0 ? styles.navBadgeAlert : ""
                }`}
                title={
                  resumoPendentes.atrasados48h > 0
                    ? `${resumoPendentes.atrasados48h} caixas travadas há mais de 48h sem NF-e`
                    : `${resumoPendentes.total} envios pendentes`
                }
              >
                {resumoPendentes.total}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.navTabBtn} ${
                currentView === "novo" ? styles.navTabBtnActive : ""
              }`}
              onClick={() => {
                setItemEmEdicao(null);
                setCurrentView("novo");
              }}
              title="Cadastro rápido de novos envios na bancada (Alt+2)"
            >
              <PlusCircle size={16} />
              <span>{itemEmEdicao ? "Editar Envio" : "Novo Registro"}</span>
            </button>

            <button
              type="button"
              className={`${styles.navTabBtn} ${
                currentView === "dashboard" ? styles.navTabBtnActive : ""
              }`}
              onClick={() => {
                setItemEmEdicao(null);
                setCurrentView("dashboard");
              }}
              title="Indicadores de gargalo e cadência (Alt+3)"
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo da Visão Ativa */}
      <main className={styles.mainContent}>
        {currentView === "backlog" && (
          <BacklogEnvios
            onEditItem={handleEditItem}
            onNavigateToNew={() => {
              setItemEmEdicao(null);
              setCurrentView("novo");
            }}
          />
        )}

        {currentView === "novo" && (
          <FormEnvioRapido
            initialData={itemEmEdicao}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}

        {currentView === "dashboard" && (
          <DashboardEnvios
            onNavigateToBacklog={() => {
              setCurrentView("backlog");
            }}
          />
        )}
      </main>

      {/* Rodapé Corporativo */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <strong>ERP AT • Assistência Técnica VendPago</strong> — Sistema de Gestão de Gargalos Fiscais e Logísticos
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <span>Atalhos: F2 (A ser informado) | Alt+1 (Fila) | Alt+2 (Novo) | Alt+3 (Dashboard)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

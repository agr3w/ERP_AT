import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Check,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  PackageCheck,
  Truck,
  Edit,
  Trash2,
  Eye,
  X,
  FileCheck,
  AlertCircle,
  Inbox,
  Plus,
  Download,
  Copy,
  Calculator,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  Save,
  Package,
  Send,
  FileText
} from "lucide-react";
import {
  getEnviosPendentes,
  getEnviosConcluidos,
  updateEnvio,
  deleteEnvio,
  obterConfiguracaoEsteira,
  salvarConfiguracaoEsteira
} from "../../services/envioService";
import {
  MOTIVOS,
  exportarParaCsvCorreios,
  abrirCalculoOficialCorreios,
  gerarTextoCobrancaBitrix,
  CEP_ORIGEM_VENDPAGO,
  formatarDataBR,
  obterTimestampData
} from "../../constants/envioConfig";
import styles from "./BacklogEnvios.module.css";

const getBadgeStyle = (motivoNome) => {
  const config = MOTIVOS[motivoNome];
  if (!config) {
    return {
      backgroundColor: "#f1f5f9",
      color: "#475569",
      borderColor: "#cbd5e1"
    };
  }
  return {
    backgroundColor: config.bg,
    color: config.color,
    borderColor: config.border
  };
};

// Chave para memorização de preferências de filtros e ordenação
const STORAGE_KEY_PREFS = "vp_backlog_envios_prefs";

const carregarPreferenciasIniciais = () => {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_PREFS);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      return {
        activeTab: parsed.activeTab === "concluidos" ? "concluidos" : "pendentes",
        tipoFiltro: typeof parsed.tipoFiltro === "string" ? parsed.tipoFiltro : "TODOS",
        filtroEtapa: typeof parsed.filtroEtapa === "string" ? parsed.filtroEtapa : "TODAS",
        apenasAtrasados48h: Boolean(parsed.apenasAtrasados48h),
        sortConfig:
          parsed.sortConfig && typeof parsed.sortConfig === "object"
            ? parsed.sortConfig
            : { key: null, direction: null },
        searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
        ordemManualIds: Array.isArray(parsed.ordemManualIds) ? parsed.ordemManualIds : []
      };
    }
  } catch (err) {
    console.error("Erro ao carregar preferências de envios do localStorage:", err);
  }
  return {
    activeTab: "pendentes",
    tipoFiltro: "TODOS",
    filtroEtapa: "TODAS",
    apenasAtrasados48h: false,
    sortConfig: { key: null, direction: null },
    searchQuery: "",
    ordemManualIds: []
  };
};

export default function BacklogEnvios({ onEditItem = null, onNavigateToNew = null }) {
  const prefsIniciais = useMemo(() => carregarPreferenciasIniciais(), []);

  const [activeTab, setActiveTab] = useState(() => prefsIniciais.activeTab); // "pendentes" | "concluidos"
  const [pendentes, setPendentes] = useState([]);
  const [concluidos, setConcluidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros memorizados
  const [searchQuery, setSearchQuery] = useState(() => prefsIniciais.searchQuery);
  const [tipoFiltro, setTipoFiltro] = useState(() => prefsIniciais.tipoFiltro);
  const [filtroEtapa, setFiltroEtapa] = useState(() => prefsIniciais.filtroEtapa || "TODAS");
  const [apenasAtrasados48h, setApenasAtrasados48h] = useState(() => prefsIniciais.apenasAtrasados48h);

  // Estado de ordenação da coluna memorizado: { key: string | null, direction: 'asc' | 'desc' | null }
  const [sortConfig, setSortConfig] = useState(() => prefsIniciais.sortConfig);
  const [ordemManualIds, setOrdemManualIds] = useState(() => prefsIniciais.ordemManualIds);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Salva preferências no localStorage e sincroniza a esteira no Firestore para todo o deploy geral
  useEffect(() => {
    try {
      const prefs = {
        activeTab,
        tipoFiltro,
        filtroEtapa,
        apenasAtrasados48h,
        sortConfig,
        searchQuery,
        ordemManualIds
      };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    } catch (err) {
      console.error("Erro ao salvar preferências de envios no localStorage:", err);
    }

    // Sincroniza ordem e critérios da esteira no banco de dados para todo o deploy geral
    const timer = setTimeout(() => {
      salvarConfiguracaoEsteira({
        sortConfig,
        ordemManualIds,
        tipoFiltro,
        filtroEtapa
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [activeTab, tipoFiltro, filtroEtapa, apenasAtrasados48h, sortConfig, searchQuery, ordemManualIds]);

  // Modais de Ação Rápida
  const [itemParaConcluir, setItemParaConcluir] = useState(null);
  const [modalConcluirData, setModalConcluirData] = useState({
    rastreio: "",
    nfe: "",
    valorFrete: ""
  });
  const [concluindoLoading, setConcluindoLoading] = useState(false);

  const [itemDetalhes, setItemDetalhes] = useState(null);
  const [copiadoMacs, setCopiadoMacs] = useState(false);
  const [copiadoBitrix, setCopiadoBitrix] = useState(false);

  // Modal Rápido de NF-e
  const [itemModalNfe, setItemModalNfe] = useState(null);
  const [valorInputNfe, setValorInputNfe] = useState("");
  const [salvandoNfe, setSalvandoNfe] = useState(false);

  // Fechar qualquer modal ativo ao pressionar a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (itemDetalhes) setItemDetalhes(null);
        else if (itemModalNfe) setItemModalNfe(null);
        else if (itemParaConcluir) setItemParaConcluir(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itemDetalhes, itemModalNfe, itemParaConcluir]);

  // Alternador de ciclo: Desc -> Asc -> Padrão
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        return { key, direction: "desc" };
      }
      if (prev.direction === "desc") {
        return { key, direction: "asc" };
      }
      // Volta ao padrão da bancada
      return { key: null, direction: null };
    });
  };

  // Renderizador do ícone de direção na coluna
  const renderSortIcon = (colKey) => {
    if (sortConfig.key !== colKey) {
      return <ArrowUpDown size={12} className={styles.sortIconInactive} />;
    }
    if (sortConfig.direction === "asc") {
      return <ChevronUp size={14} className={styles.sortIconActive} />;
    }
    return <ChevronDown size={14} className={styles.sortIconActive} />;
  };

  // Helper para verificar se a NF-e já foi anexada/informada
  const temNfeAnexada = (item) => {
    if (!item || !item.nfe) return false;
    const n = String(item.nfe).trim().toLowerCase();
    return n !== "" && n !== "a ser informado" && n !== "a ser informada";
  };

  // ESTADO DE SELEÇÃO PARA EXPORTAÇÃO CORREIOS
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Limpa seleções ao alternar entre abas
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  // Alterna seleção de um card individual
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Alterna selecionar todos os itens exibidos na lista atual
  const handleToggleSelectAll = () => {
    if (selectedIds.size === listaExibida.length && listaExibida.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listaExibida.map((item) => item.id)));
    }
  };

  // Atalho: Seleciona em 1 clique apenas quem tem NF-e emitida
  const handleSelecionarApenasComNfe = () => {
    const idsComNfe = listaExibida
      .filter((item) => temNfeAnexada(item))
      .map((item) => item.id);
    setSelectedIds(new Set(idsComNfe));
  };

  const handleLimparSelecao = () => {
    setSelectedIds(new Set());
  };

  // Abre modal rápido para anexar ou editar NF-e
  const abrirModalNfe = (item) => {
    setItemModalNfe(item);
    const nfeAtual = String(item.nfe || "").trim();
    setValorInputNfe(
      nfeAtual.toLowerCase() === "a ser informado" || nfeAtual.toLowerCase() === "a ser informada"
        ? ""
        : nfeAtual
    );
  };

  // Salva NF-e digitada de forma instantânea
  const handleSalvarNfeRapido = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!itemModalNfe) return;

    setSalvandoNfe(true);
    try {
      const nfeFinal = valorInputNfe.trim() || "A ser informado";
      await updateEnvio(itemModalNfe.id, { nfe: nfeFinal });
      await carregarDados();
      setItemModalNfe(null);
    } catch (err) {
      console.error("Erro ao atualizar NF-e rápida:", err);
    } finally {
      setSalvandoNfe(false);
    }
  };

  // Handlers de Drag and Drop
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const novaLista = [...listaExibida];
    const [removido] = novaLista.splice(draggedIndex, 1);
    novaLista.splice(targetIndex, 0, removido);

    const novosIds = novaLista.map((it) => it.id);
    setOrdemManualIds(novosIds);
    setSortConfig({ key: null, direction: null });
    setDraggedIndex(null);
  };

  const moverItem = (index, direcao) => {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= listaExibida.length) return;

    const novaLista = [...listaExibida];
    const [removido] = novaLista.splice(index, 1);
    novaLista.splice(novoIndex, 0, removido);

    const novosIds = novaLista.map((it) => it.id);
    setOrdemManualIds(novosIds);
    setSortConfig({ key: null, direction: null });
  };

  // Copia múltiplos MACs no padrão exato do ERP: mac1 - mac2 - mac3
  const copiarMacsParaErp = (macs) => {
    if (!macs || !macs.length) return;
    const textoFormatado = macs.join(" - ");
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textoFormatado);
    }
    setCopiadoMacs(true);
    setTimeout(() => setCopiadoMacs(false), 2000);
  };

  // Copia resumo do frete formatado para a tarefa do fiscal no Bitrix
  const copiarResumoBitrix = (item) => {
    if (!item) return;
    const texto = gerarTextoCobrancaBitrix(item);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(texto);
    }
    setCopiadoBitrix(true);
    setTimeout(() => setCopiadoBitrix(false), 2200);
  };

  // Carrega lista de envios e sincroniza a configuração compartilhada da esteira do Firestore
  const carregarDados = async () => {
    setLoading(true);
    try {
      const [listPendentes, listConcluidos, configEsteira] = await Promise.all([
        getEnviosPendentes(),
        getEnviosConcluidos(),
        obterConfiguracaoEsteira()
      ]);
      setPendentes(listPendentes);
      setConcluidos(listConcluidos);

      // Sincroniza a ordem e filtros globais salvos no Firestore para todo o deploy
      if (configEsteira) {
        if (configEsteira.sortConfig && (configEsteira.sortConfig.key || configEsteira.sortConfig.direction)) {
          setSortConfig(configEsteira.sortConfig);
        }
        if (Array.isArray(configEsteira.ordemManualIds) && configEsteira.ordemManualIds.length > 0) {
          setOrdemManualIds(configEsteira.ordemManualIds);
        }
        if (configEsteira.tipoFiltro && configEsteira.tipoFiltro !== "TODOS") {
          setTipoFiltro(configEsteira.tipoFiltro);
        }
        if (configEsteira.filtroEtapa && configEsteira.filtroEtapa !== "TODAS") {
          setFiltroEtapa(configEsteira.filtroEtapa);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do backlog:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Total de itens aguardando NF-e há mais de 48h
  const totalAtrasados48h = useMemo(() => {
    return pendentes.filter((item) => item.diasAguardandoNfe >= 2 && !temNfeAnexada(item)).length;
  }, [pendentes]);

  // Contadores cromáticos do Mini-Pipeline da bancada
  const totalSemNfe = useMemo(() => {
    return pendentes.filter((item) => !temNfeAnexada(item)).length;
  }, [pendentes]);

  const totalComNfe = useMemo(() => {
    return pendentes.filter((item) => temNfeAnexada(item)).length;
  }, [pendentes]);

  // Lista atual conforme aba, filtros e critério de ordenação
  const listaExibida = useMemo(() => {
    const base = activeTab === "pendentes" ? pendentes : concluidos;

    // 1. Filtragem por busca e critérios cromáticos de etapa
    const filtrados = base.filter((item) => {
      const term = searchQuery.toLowerCase().trim();
      const matchText =
        !term ||
        (item.conteudo && item.conteudo.toLowerCase().includes(term)) ||
        (item.destinatario && item.destinatario.toLowerCase().includes(term)) ||
        (item.mac && item.mac.toLowerCase().includes(term)) ||
        (Array.isArray(item.macs) && item.macs.some((m) => m && m.toLowerCase().includes(term))) ||
        (item.rastreio && item.rastreio.toLowerCase().includes(term)) ||
        (item.chamado && item.chamado.toLowerCase().includes(term)) ||
        (item.nfe && item.nfe.toLowerCase().includes(term)) ||
        (item.motivo && item.motivo.toLowerCase().includes(term));

      const matchTipo = tipoFiltro === "TODOS" || item.tipoEnvio === tipoFiltro;
      const matchAtraso = !apenasAtrasados48h || (activeTab === "pendentes" && item.diasAguardandoNfe >= 2 && !temNfeAnexada(item));

      // Filtro cromático por Etapa da Esteira
      const isComNfe = temNfeAnexada(item);
      const matchEtapa = (() => {
        if (activeTab !== "pendentes") return true;
        if (filtroEtapa === "SEM_NFE") return !isComNfe;
        if (filtroEtapa === "COM_NFE") return isComNfe;
        return true;
      })();

      return matchText && matchTipo && matchAtraso && matchEtapa;
    });

    const listaOrdenada = [...filtrados];

    // 2. Se nenhuma coluna foi clicada (padrão da bancada / manual se houver)
    if (!sortConfig.key || !sortConfig.direction) {
      if (ordemManualIds.length > 0) {
        listaOrdenada.sort((a, b) => {
          const idxA = ordemManualIds.indexOf(a.id);
          const idxB = ordemManualIds.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
      return listaOrdenada;
    }

    // 3. Ordenação ativa por coluna
    const { key, direction } = sortConfig;
    const multiplicador = direction === "asc" ? 1 : -1;

    listaOrdenada.sort((a, b) => {
      if (key === "data") {
        const timeA = obterTimestampData(a.data);
        const timeB = obterTimestampData(b.data);
        return (timeA - timeB) * multiplicador;
      }

      if (key === "chamado") {
        const numA = Number(String(a.chamado || "").replace(/\D/g, "")) || 0;
        const numB = Number(String(b.chamado || "").replace(/\D/g, "")) || 0;
        if (numA && numB) return (numA - numB) * multiplicador;
        return String(a.chamado || "").localeCompare(String(b.chamado || "")) * multiplicador;
      }

      if (key === "destinatario") {
        return String(a.destinatario || "").localeCompare(String(b.destinatario || "")) * multiplicador;
      }

      if (key === "motivo") {
        return String(a.motivo || "").localeCompare(String(b.motivo || "")) * multiplicador;
      }

      if (key === "tipoEnvio") {
        return String(a.tipoEnvio || "").localeCompare(String(b.tipoEnvio || "")) * multiplicador;
      }

      if (key === "nfe") {
        const aTem = temNfeAnexada(a) ? 1 : 0;
        const bTem = temNfeAnexada(b) ? 1 : 0;
        if (aTem !== bTem) return (aTem - bTem) * multiplicador;
        return (Number(b.diasAguardandoNfe || 0) - Number(a.diasAguardandoNfe || 0)) * multiplicador;
      }

      return 0;
    });

    return listaOrdenada;
  }, [
    activeTab,
    pendentes,
    concluidos,
    searchQuery,
    tipoFiltro,
    filtroEtapa,
    apenasAtrasados48h,
    sortConfig,
    ordemManualIds
  ]);

  // Itens que serão enviados para a função de exportação CSV
  const itensParaExportar = useMemo(() => {
    if (selectedIds.size > 0) {
      return listaExibida.filter((item) => selectedIds.has(item.id));
    }
    return listaExibida;
  }, [listaExibida, selectedIds]);

  const totalComNfeNaLista = useMemo(() => {
    return listaExibida.filter((item) => temNfeAnexada(item)).length;
  }, [listaExibida]);

  // Abertura do modal de conclusão rápida
  const abrirModalConcluir = (item) => {
    setItemParaConcluir(item);
    setModalConcluirData({
      rastreio: item.rastreio || "",
      nfe: item.nfe === "A ser informado" ? "" : item.nfe || "",
      valorFrete: item.valorFrete || ""
    });
  };

  const handleConfirmarConclusao = async (e) => {
    e.preventDefault();
    if (!itemParaConcluir) return;

    setConcluindoLoading(true);
    try {
      await updateEnvio(itemParaConcluir.id, {
        enviado: true,
        rastreio: modalConcluirData.rastreio.trim(),
        nfe: modalConcluirData.nfe.trim() || itemParaConcluir.nfe,
        valorFrete: modalConcluirData.valorFrete.trim() || itemParaConcluir.valorFrete || ""
      });

      setItemParaConcluir(null);
      await carregarDados();
    } catch (err) {
      console.error("Erro ao concluir envio:", err);
    } finally {
      setConcluindoLoading(false);
    }
  };

  const handleExcluir = async (id, chamado) => {
    if (window.confirm(`Confirma a exclusão do registro de envio ${chamado || ""}?`)) {
      try {
        await deleteEnvio(id);
        await carregarDados();
      } catch (err) {
        console.error("Erro ao excluir envio:", err);
      }
    }
  };

  const renderBadgeNfe = (item) => {
    const isPendente = !temNfeAnexada(item);

    if (!isPendente) {
      return (
        <button
          type="button"
          className={styles.btnNfeAmarelo}
          onClick={(e) => {
            e.stopPropagation();
            abrirModalNfe(item);
          }}
          title="NF-e vinculada. Clique para editar."
        >
          <FileCheck size={12} color="#854d0e" />
          <span className={styles.nfeAmareloTag}>NF</span>
          <span>{item.nfe}</span>
          <span className={styles.btnNfeEditTag}>Editar</span>
        </button>
      );
    }

    const dias = typeof item.diasAguardandoNfe === "number" ? item.diasAguardandoNfe : 0;

    if (dias >= 2) {
      return (
        <button
          type="button"
          className={styles.btnNfeSalmaoCritico}
          onClick={(e) => {
            e.stopPropagation();
            abrirModalNfe(item);
          }}
          title={`Aguardando NF-e há ${dias} dias (> 48h). Clique para anexar NF-e.`}
        >
          <AlertTriangle size={12} color="#dc2626" />
          <span>{dias}d (&gt;48h) • Falta NF-e</span>
        </button>
      );
    }

    if (dias === 1) {
      return (
        <button
          type="button"
          className={styles.btnNfeSalmao}
          onClick={(e) => {
            e.stopPropagation();
            abrirModalNfe(item);
          }}
          title="Aguardando NF-e há 1 dia. Clique para anexar NF-e."
        >
          <Clock size={12} color="#ea580c" />
          <span>1d • Falta NF-e</span>
        </button>
      );
    }

    // Para itens cadastrados hoje (0 dias)
    return (
      <button
        type="button"
        className={styles.btnNfeSalmao}
        onClick={(e) => {
          e.stopPropagation();
          abrirModalNfe(item);
        }}
        title="Aguardando NF-e (cadastrado hoje). Clique para anexar NF-e."
      >
        <Clock size={12} color="#ea580c" />
        <span>0d • Falta NF-e</span>
      </button>
    );
  };

  return (
    <div className={styles.container}>
      {/* Barra Superior de Abas e Atualização */}
      <div className={styles.topBar}>
        <div className={styles.tabList}>
          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "pendentes" ? styles.tabButtonActive : ""
            }`}
            onClick={() => setActiveTab("pendentes")}
          >
            <Clock size={16} />
            <span>Pendentes / Aguardando NF-e</span>
            <span
              className={`${styles.tabCount} ${
                activeTab === "pendentes"
                  ? totalAtrasados48h > 0
                    ? styles.tabCountAlert
                    : styles.tabCountActive
                  : ""
              }`}
            >
              {pendentes.length}
            </span>
          </button>

          <button
            type="button"
            className={`${styles.tabButton} ${
              activeTab === "concluidos" ? styles.tabButtonActive : ""
            }`}
            onClick={() => setActiveTab("concluidos")}
          >
            <PackageCheck size={16} />
            <span>Histórico Concluído</span>
            <span
              className={`${styles.tabCount} ${
                activeTab === "concluidos" ? styles.tabCountActive : ""
              }`}
            >
              {concluidos.length}
            </span>
          </button>
        </div>

        <div className={styles.actionsRight}>
          <button
            type="button"
            className={`${styles.btnExportCorreios} ${selectedIds.size > 0 ? styles.btnExportSelected : ""}`}
            onClick={() => exportarParaCsvCorreios(itensParaExportar)}
            title={
              selectedIds.size > 0
                ? `Exportar ${selectedIds.size} equipamento(s) selecionado(s) para os Correios`
                : "Exportar todos os registros visíveis para os Correios"
            }
            disabled={itensParaExportar.length === 0}
          >
            <Download size={14} />
            <span>
              {selectedIds.size > 0
                ? `Exportar Selecionados (${selectedIds.size}) - CSV`
                : `Exportar Correios (Todos - ${listaExibida.length})`}
            </span>
          </button>

          {onNavigateToNew && (
            <button
              type="button"
              className={styles.btnRefresh}
              style={{
                backgroundColor: "var(--vp-navy-dark)",
                color: "#ffffff",
                borderColor: "var(--vp-navy-dark)"
              }}
              onClick={onNavigateToNew}
              title="Cadastrar novo envio na bancada"
            >
              <Plus size={14} />
              <span>Novo Envio</span>
            </button>
          )}

          <button
            type="button"
            className={styles.btnRefresh}
            onClick={carregarDados}
            disabled={loading}
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Mini-Pipeline de Etapas da Bancada (Controle Cromático das Fases) */}
      {activeTab === "pendentes" && (
        <div className={styles.pipelineBar}>
          <div className={styles.pipelineHeader}>
            <span className={styles.pipelineLabel}>
              <Package size={14} color="var(--vp-navy-dark)" />
              Etapas:
            </span>
            <div className={styles.pipelineTabs}>
              <button
                type="button"
                className={`${styles.pipelinePill} ${
                  filtroEtapa === "TODAS" && !apenasAtrasados48h
                    ? styles.pipelinePillActiveTodas
                    : ""
                }`}
                onClick={() => {
                  setFiltroEtapa("TODAS");
                  setApenasAtrasados48h(false);
                }}
                title="Exibir toda a bancada de pendentes"
              >
                <Inbox size={13} />
                <span>Todas</span>
                <span className={styles.pipelineCount}>{pendentes.length}</span>
              </button>

              <button
                type="button"
                className={`${styles.pipelinePill} ${styles.pipelinePillSemNfe} ${
                  filtroEtapa === "SEM_NFE" && !apenasAtrasados48h
                    ? styles.pipelinePillActiveSemNfe
                    : ""
                }`}
                onClick={() => {
                  setFiltroEtapa("SEM_NFE");
                  setApenasAtrasados48h(false);
                }}
                title="Equipamentos testados/embalados na mesa aguardando emissão da NF-e"
              >
                <Clock size={13} />
                <span>1. Falta NF-e</span>
                <span className={styles.pipelineCount}>{totalSemNfe}</span>
              </button>

              <button
                type="button"
                className={`${styles.pipelinePill} ${styles.pipelinePillComNfe} ${
                  filtroEtapa === "COM_NFE" && !apenasAtrasados48h
                    ? styles.pipelinePillActiveComNfe
                    : ""
                }`}
                onClick={() => {
                  setFiltroEtapa("COM_NFE");
                  setApenasAtrasados48h(false);
                }}
                title="NF-e anexada! Caixas prontas para adicionar nos Correios ou exportar CSV"
              >
                <PackageCheck size={13} />
                <span>2. Pronto p/ Correios</span>
                <span className={styles.pipelineCount}>{totalComNfe}</span>
              </button>

              {totalAtrasados48h > 0 && (
                <button
                  type="button"
                  className={`${styles.pipelinePill} ${styles.pipelinePillCritico} ${
                    apenasAtrasados48h ? styles.pipelinePillActiveCritico : ""
                  }`}
                  onClick={() => {
                    setApenasAtrasados48h(!apenasAtrasados48h);
                    if (!apenasAtrasados48h) setFiltroEtapa("TODAS");
                  }}
                  title="Pacotes travados há mais de 48h sem NF-e"
                >
                  <AlertTriangle size={13} />
                  <span>Gargalo &gt;48h</span>
                  <span className={styles.pipelineCountAlert}>{totalAtrasados48h}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Gargalo na Aba de Pendentes */}
      {activeTab === "pendentes" && totalAtrasados48h > 0 && !apenasAtrasados48h && (
        <div className={styles.gargaloAlert}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertTriangle size={18} />
            <span>
              Atenção: <strong>{totalAtrasados48h} equipamento(s)</strong> estão
              aguardando NF-e há mais de 48 horas travando o despacho na bancada!
            </span>
          </div>

          <button
            type="button"
            className={styles.filterToggle}
            onClick={() => setApenasAtrasados48h(true)}
          >
            Filtrar Somente Gargalo (&gt;48h)
          </button>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por MAC, Rastreio, Destinatário, Ticket ou Conteúdo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterControls}>
          <select
            className={styles.filterSelect}
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
          >
            <option value="TODOS">Todos os Tipos de Envio</option>
            <option value="SEDEX">SEDEX</option>
            <option value="PAC">PAC</option>
            <option value="Retirada">Retirada</option>
            <option value="Transportadora">Transportadora</option>
            <option value="Motoboy">Motoboy</option>
          </select>

          {activeTab === "pendentes" && (
            <button
              type="button"
              className={`${styles.filterToggle} ${
                apenasAtrasados48h ? styles.filterToggleActive : ""
              }`}
              onClick={() => setApenasAtrasados48h(!apenasAtrasados48h)}
            >
              <AlertCircle size={14} />
              <span>Apenas &gt; 48h</span>
            </button>
          )}

          {(Boolean(searchQuery) || tipoFiltro !== "TODOS" || filtroEtapa !== "TODAS" || apenasAtrasados48h || sortConfig.key !== null) && (
            <button
              type="button"
              className={styles.filterToggle}
              style={{ color: "var(--vp-text-secondary)", gap: "4px" }}
              onClick={() => {
                setSearchQuery("");
                setTipoFiltro("TODOS");
                setFiltroEtapa("TODAS");
                setApenasAtrasados48h(false);
                setSortConfig({ key: null, direction: null });
                setOrdemManualIds([]);
                salvarConfiguracaoEsteira({
                  sortConfig: { key: null, direction: null },
                  ordemManualIds: [],
                  tipoFiltro: "TODOS",
                  filtroEtapa: "TODAS"
                });
              }}
              title="Redefinir busca, filtros e ordenação para o padrão da bancada"
            >
              <RotateCcw size={12} />
              <span>Redefinir</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Ações Rápidas de Lote (aparece quando há opções ou seleção) */}
      {activeTab === "pendentes" && listaExibida.length > 0 && (
        <div className={styles.batchActionBar}>
          <div className={styles.batchInfo}>
            <span>Fila da Bancada: <strong>{listaExibida.length} pacote(s)</strong></span>
            {selectedIds.size > 0 && (
              <span className={styles.badgeSelectedCount}>
                <Check size={12} />
                <span>{selectedIds.size} selecionado(s) para o lote</span>
              </span>
            )}
          </div>

          <div className={styles.batchShortcuts}>
            {totalComNfeNaLista > 0 && (
              <button
                type="button"
                className={styles.btnShortcutBatch}
                onClick={handleSelecionarApenasComNfe}
                title="Marcar apenas caixas prontas que já possuem NF-e"
              >
                <FileCheck size={13} color="var(--vp-emerald-dark)" />
                <span>Selecionar Prontos c/ NF-e ({totalComNfeNaLista})</span>
              </button>
            )}

            {selectedIds.size > 0 && (
              <button
                type="button"
                className={styles.btnShortcutClear}
                onClick={handleLimparSelecao}
                title="Desmarcar todos os cards"
              >
                <RotateCcw size={12} />
                <span>Limpar Seleção</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabela de Envios */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {/* NOVA COLUNA 1: SELEÇÃO & CONTADOR (#) */}
              <th className={styles.thSelect} title="Selecionar todos os visíveis">
                <div className={styles.thSelectWrapper}>
                  <input
                    type="checkbox"
                    className={styles.checkboxMaster}
                    checked={listaExibida.length > 0 && selectedIds.size === listaExibida.length}
                    onChange={handleToggleSelectAll}
                    title="Marcar / Desmarcar todos"
                  />
                  <span className={styles.thNumberLabel}>#</span>
                </div>
              </th>

              <th className={styles.thDrag}></th>

              {/* DATA COM ORDENAÇÃO REAL */}
              <th
                className={`${styles.th} ${styles.thSortable}`}
                onClick={() => handleSort("data")}
                title="Clique para ordenar por data (Mais recentes / Mais antigos / Padrão)"
              >
                <div className={styles.thContent}>
                  <span>Data</span>
                  {renderSortIcon("data")}
                </div>
              </th>

              {/* CHAMADO */}
              <th
                className={`${styles.th} ${styles.thSortable}`}
                onClick={() => handleSort("chamado")}
                title="Ordenar por número de chamado"
              >
                <div className={styles.thContent}>
                  <span>Chamado</span>
                  {renderSortIcon("chamado")}
                </div>
              </th>

              <th className={styles.th}>Conteúdo / MAC</th>

              {/* MOTIVO */}
              <th
                className={`${styles.th} ${styles.thSortable}`}
                onClick={() => handleSort("motivo")}
                title="Ordenar por motivo"
              >
                <div className={styles.thContent}>
                  <span>Motivo</span>
                  {renderSortIcon("motivo")}
                </div>
              </th>

              {/* DESTINATÁRIO */}
              <th
                className={`${styles.th} ${styles.thSortable}`}
                onClick={() => handleSort("destinatario")}
                title="Ordenar por cliente/operador"
              >
                <div className={styles.thContent}>
                  <span>Destinatário</span>
                  {renderSortIcon("destinatario")}
                </div>
              </th>

              {/* TIPO / RASTREIO */}
              <th
                className={`${styles.th} ${styles.thSortable}`}
                onClick={() => handleSort("tipoEnvio")}
                title="Ordenar por serviço de frete"
              >
                <div className={styles.thContent}>
                  <span>Tipo / Rastreio</span>
                  {renderSortIcon("tipoEnvio")}
                </div>
              </th>

              {/* STATUS NF-E */}
              <th
                className={`${styles.th} ${styles.thSortable}`}
                onClick={() => handleSort("nfe")}
                title="Ordenar por status da NF-e"
              >
                <div className={styles.thContent}>
                  <span>Status NF-e</span>
                  {renderSortIcon("nfe")}
                </div>
              </th>

              <th className={styles.th} style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: "center", padding: "2.5rem" }}>
                  Carregando registros de envios...
                </td>
              </tr>
            ) : listaExibida.length === 0 ? (
              <tr>
                <td colSpan="10" className={styles.emptyState}>
                  <Inbox className={styles.emptyIcon} />
                  <p>Nenhum registro encontrado para este filtro.</p>
                </td>
              </tr>
            ) : (
              listaExibida.map((item, index) => {
                const isSelected = selectedIds.has(item.id);
                const comNfe = temNfeAnexada(item);
                const isCritical =
                  activeTab === "pendentes" && item.diasAguardandoNfe >= 2 && !comNfe;
                const isFaltaNfe =
                  activeTab === "pendentes" && !comNfe && !isCritical;
                const isProntoCorreios =
                  activeTab === "pendentes" && comNfe;

                let trEtapaClass = "";
                if (isSelected) {
                  trEtapaClass = styles.trSelected;
                } else if (isCritical) {
                  trEtapaClass = styles.trEtapaCritico;
                } else if (isFaltaNfe) {
                  trEtapaClass = styles.trEtapaFaltaNfe;
                } else if (isProntoCorreios) {
                  trEtapaClass = styles.trEtapaProntoCorreios;
                }

                return (
                  <tr
                    key={item.id}
                    draggable={activeTab === "pendentes"}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`${styles.tr} ${trEtapaClass} ${
                      draggedIndex === index ? styles.trDragging : ""
                    }`}
                  >
                    {/* CÉLULA 1: CHECKBOX DE EXPORTAÇÃO + CONTADOR #1, #2, #3 */}
                    <td className={styles.tdSelect}>
                      <div className={styles.selectCellWrapper}>
                        <input
                          type="checkbox"
                          className={styles.checkboxRow}
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          title={`Selecionar #${index + 1} (${item.destinatario}) para exportar aos Correios`}
                        />
                        <span className={`${styles.badgeIndex} ${isSelected ? styles.badgeIndexSelected : ""}`}>
                          #{index + 1}
                        </span>
                      </div>
                    </td>

                    <td className={styles.tdDrag}>
                      <div className={styles.dragHandleWrapper}>
                        <div
                          className={styles.dragHandle}
                          title="Segure e arraste para mudar a posição na fila"
                        >
                          <GripVertical size={16} />
                        </div>
                        <div className={styles.miniArrows}>
                          <button
                            type="button"
                            disabled={index === 0}
                            className={styles.btnMiniArrow}
                            onClick={(e) => {
                              e.stopPropagation();
                              moverItem(index, -1);
                            }}
                            title="Mover para cima"
                          >
                            <ChevronUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={index === listaExibida.length - 1}
                            className={styles.btnMiniArrow}
                            onClick={(e) => {
                              e.stopPropagation();
                              moverItem(index, 1);
                            }}
                            title="Mover para baixo"
                          >
                            <ChevronDown size={11} />
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className={styles.td}>
                      <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatarDataBR(item.data)}
                      </span>
                    </td>

                    <td className={styles.td}>
                      {item.linkChamado ? (
                        <a
                          href={item.linkChamado}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkTicket}
                          title="Abrir chamado externo"
                        >
                          {item.chamado || "Link"}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        item.chamado || "-"
                      )}
                    </td>

                    <td className={styles.td}>
                      <div style={{ fontWeight: 600, color: "var(--vp-navy-dark)" }}>
                        {item.conteudo}
                      </div>
                      {(() => {
                        const macs = Array.isArray(item.macs) && item.macs.length > 0
                          ? item.macs
                          : item.mac
                          ? item.mac.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean)
                          : [];

                        if (macs.length === 0) {
                          return <div style={{ fontSize: "0.75rem", color: "var(--vp-text-dim)" }}>-</div>;
                        }
                        return (
                          <div style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                            <code className={styles.macCode}>{macs[0]}</code>
                            {macs.length > 1 && (
                              <span className={styles.badgeMacsCount}>+{macs.length - 1} MACs</span>
                            )}
                            <button
                              type="button"
                              className={styles.btnCopyTable}
                              onClick={(e) => {
                                e.stopPropagation();
                                copiarMacsParaErp(macs);
                              }}
                              title="Copiar MAC(s) no formato ERP (separados por -)"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    <td className={styles.td}>
                      <span className={styles.badgeMotivo} style={getBadgeStyle(item.motivo)}>
                        {item.motivo || "Indefinido"}
                      </span>
                    </td>

                    <td className={styles.td}>
                      <div style={{ fontWeight: 500 }}>{item.destinatario}</div>
                    </td>

                    <td className={styles.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                          {item.tipoEnvio || "SEDEX"}
                        </span>
                        {item.valorFrete && (
                          <span className={styles.badgeFrete} title="Valor do frete cotado">
                            {String(item.valorFrete).trim().startsWith("R$")
                              ? item.valorFrete
                              : `R$ ${item.valorFrete}`}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        {item.rastreio ? (
                          <span className={styles.rastreioCode} title="Código de rastreio">
                            {item.rastreio}
                          </span>
                        ) : isProntoCorreios ? (
                          <span className={styles.pillProntoCorreios} title="NF-e vinculada! Pronto para adicionar nos Correios">
                            <Package size={11} />
                            <span>Pronto p/ Correios</span>
                          </span>
                        ) : (
                          <span className={styles.textAguardandoNfe} title="Aguardando emissão da NF-e">
                            <Clock size={11} />
                            <span>Aguardando NF-e</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className={styles.td}>
                      {renderBadgeNfe(item)}
                    </td>

                    <td className={styles.td} style={{ textAlign: "right" }}>
                      <div className={styles.cellActions} style={{ justifyContent: "flex-end" }}>
                        {activeTab === "pendentes" && (
                          <button
                            type="button"
                            className={isProntoCorreios ? styles.btnConcluirPronto : styles.btnConcluirNormal}
                            onClick={() => abrirModalConcluir(item)}
                            title={
                              isProntoCorreios
                                ? "Pacote pronto! Clique para registrar código de rastreio e concluir"
                                : "Concluir envio ou preencher rastreio"
                            }
                          >
                            {isProntoCorreios ? <Send size={13} /> : <FileCheck size={13} />}
                            <span>{isProntoCorreios ? "Despachar" : "Concluir"}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className={styles.btnActionIcon}
                          onClick={() => setItemDetalhes(item)}
                          title="Ver detalhes completos"
                        >
                          <Eye size={14} />
                        </button>

                        {onEditItem && (
                          <button
                            type="button"
                            className={styles.btnActionIcon}
                            onClick={() => onEditItem(item)}
                            title="Editar registro"
                          >
                            <Edit size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          className={styles.btnActionIcon}
                          onClick={() => handleExcluir(item.id, item.chamado)}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Conclusão Rápida */}
      {itemParaConcluir && (
        <div className={styles.modalBackdrop} onClick={() => setItemParaConcluir(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PackageCheck size={18} color="var(--vp-emerald)" />
                <h3 className={styles.modalTitle}>Concluir Envio na Bancada</h3>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setItemParaConcluir(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmarConclusao} className={styles.modalForm}>
              <div className={styles.modalBody}>
                <div className={styles.modalItemSummary}>
                  <div><strong>Equipamento:</strong> {itemParaConcluir.conteudo}</div>
                  <div><strong>Destino:</strong> {itemParaConcluir.destinatario} ({itemParaConcluir.tipoEnvio})</div>
                  {itemParaConcluir.chamado && (
                    <div><strong>Chamado:</strong> {itemParaConcluir.chamado}</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--vp-text-secondary)" }}>
                    Código de Rastreio
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: QB123456789BR"
                    style={{
                      height: "38px",
                      padding: "0 0.75rem",
                      border: "1px solid var(--vp-border-default)",
                      borderRadius: "4px"
                    }}
                    value={modalConcluirData.rastreio}
                    onChange={(e) =>
                      setModalConcluirData((prev) => ({ ...prev, rastreio: e.target.value }))
                    }
                    autoFocus
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--vp-text-secondary)" }}>
                    Número da NF-e Emitida
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-009841"
                    style={{
                      height: "38px",
                      padding: "0 0.75rem",
                      border: "1px solid var(--vp-border-default)",
                      borderRadius: "4px"
                    }}
                    value={modalConcluirData.nfe}
                    onChange={(e) =>
                      setModalConcluirData((prev) => ({ ...prev, nfe: e.target.value }))
                    }
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--vp-text-secondary)" }}>
                      Valor do Frete (R$)
                    </label>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--vp-blue-primary)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                      onClick={() => abrirCalculoOficialCorreios(itemParaConcluir)}
                      title="Abrir tela oficial de cálculo dos Correios"
                    >
                      <Calculator size={13} /> Simular Correios
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 42,50 ou 0,00"
                    style={{
                      height: "38px",
                      padding: "0 0.75rem",
                      border: "1px solid var(--vp-border-default)",
                      borderRadius: "4px"
                    }}
                    value={modalConcluirData.valorFrete}
                    onChange={(e) =>
                      setModalConcluirData((prev) => ({ ...prev, valorFrete: e.target.value }))
                    }
                  />
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--vp-text-muted)" }}>
                  Ao confirmar, o status será marcado como <strong>Despachado / Concluído</strong> e movido para o histórico.
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setItemParaConcluir(null)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={concluindoLoading}
                  style={{
                    height: "36px",
                    padding: "0 1.25rem",
                    border: "none",
                    borderRadius: "4px",
                    background: "var(--vp-emerald)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                >
                  <CheckCircle2 size={16} />
                  {concluindoLoading ? "Concluindo..." : "Confirmar Envio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rápido: Anexar / Editar NF-e */}
      {itemModalNfe && (
        <div className={styles.modalBackdrop} onClick={() => setItemModalNfe(null)}>
          <div className={styles.modalCard} style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileCheck size={18} color="var(--vp-blue-primary)" />
                <h3 className={styles.modalTitle}>Anexar / Editar NF-e</h3>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setItemModalNfe(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarNfeRapido} className={styles.modalForm}>
              <div className={styles.modalBody}>
                <div className={styles.modalItemSummary}>
                  <div><strong>Equipamento:</strong> {itemModalNfe.conteudo}</div>
                  <div><strong>Destino:</strong> {itemModalNfe.destinatario} ({itemModalNfe.tipoEnvio})</div>
                  {itemModalNfe.chamado && (
                    <div><strong>Chamado:</strong> {itemModalNfe.chamado}</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.25rem" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--vp-navy-dark)" }}>
                    Número da NF-e Emitida
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-009841 ou 12845"
                    className={styles.modalInput}
                    value={valorInputNfe}
                    onChange={(e) => setValorInputNfe(e.target.value)}
                    autoFocus
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--vp-text-muted)" }}>
                    Ao anexar a NF-e, o card receberá tom destacado na bancada e aguardará apenas o rastreio para despacho final.
                  </span>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setItemModalNfe(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={salvandoNfe}
                >
                  <Save size={14} />
                  <span>{salvandoNfe ? "Salvando..." : "Salvar NF-e"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Registro */}
      {itemDetalhes && (
        <div className={styles.modalBackdrop} onClick={() => setItemDetalhes(null)}>
          <div className={`${styles.modalCard} ${styles.modalCardDetalhes}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Eye size={18} color="var(--vp-blue-primary)" />
                <h3 className={styles.modalTitle}>Detalhes do Envio</h3>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setItemDetalhes(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detalhesGrid}>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Data do Envio:</span>
                  <div style={{ fontWeight: 600 }}>{formatarDataBR(itemDetalhes.data)}</div>
                </div>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Chamado:</span>
                  <div>
                    {itemDetalhes.linkChamado ? (
                      <a
                        href={itemDetalhes.linkChamado}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkTicket}
                      >
                        {itemDetalhes.chamado || itemDetalhes.linkChamado}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      itemDetalhes.chamado || "Não informado"
                    )}
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Equipamento / Conteúdo:</span>
                  <div style={{ fontWeight: 600 }}>{itemDetalhes.conteudo}</div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  {(() => {
                    const macs = Array.isArray(itemDetalhes.macs) && itemDetalhes.macs.length > 0
                      ? itemDetalhes.macs
                      : itemDetalhes.mac
                      ? itemDetalhes.mac.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean)
                      : [];

                    return (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem", fontWeight: 700 }}>
                            MAC / Números de Série:
                          </span>
                          {macs.length > 0 && (
                            <button
                              type="button"
                              className={copiadoMacs ? styles.btnCopiarSucesso : styles.btnCopiarErp}
                              onClick={() => copiarMacsParaErp(macs)}
                              title="Copiar no formato do ERP (separados por ' - ')"
                            >
                              {copiadoMacs ? (
                                <>
                                  <Check size={13} /> Copiado no formato ERP!
                                </>
                              ) : (
                                <>
                                  <Copy size={13} /> Copiar para ERP {macs.length > 1 ? `(${macs.length} MACs)` : ""}
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div>
                          {macs.length === 0 ? (
                            <span style={{ color: "var(--vp-text-dim)", fontSize: "0.85rem" }}>Não informado</span>
                          ) : macs.length === 1 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <code className={styles.macCode}>{macs[0]}</code>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                              <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                                gap: "0.35rem",
                                maxHeight: "130px",
                                overflowY: "auto",
                                backgroundColor: "var(--vp-bg-main)",
                                border: "1px solid var(--vp-border-light)",
                                padding: "0.5rem",
                                borderRadius: "4px"
                              }}>
                                {macs.map((m, mIdx) => (
                                  <div key={mIdx} style={{ fontSize: "0.78rem", fontFamily: "monospace" }}>
                                    <strong style={{ color: "var(--vp-text-muted)", marginRight: "4px" }}>#{mIdx + 1}</strong>
                                    <code>{m}</code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Destinatário:</span>
                  <div style={{ fontWeight: 600 }}>{itemDetalhes.destinatario}</div>
                </div>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Motivo:</span>
                  <div style={{ marginTop: "2px" }}>
                    <span className={styles.badgeMotivo} style={getBadgeStyle(itemDetalhes.motivo)}>
                      {itemDetalhes.motivo || "Indefinido"}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Tipo de Envio:</span>
                  <div>{itemDetalhes.tipoEnvio}</div>
                </div>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Rastreio:</span>
                  <div style={{ fontFamily: "monospace", color: "var(--vp-blue-primary)", fontWeight: 600 }}>
                    {itemDetalhes.rastreio || "Sem rastreio"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>NF-e:</span>
                  <div>{renderBadgeNfe(itemDetalhes)}</div>
                </div>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Status Operacional:</span>
                  <div>
                    {itemDetalhes.enviado ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                        <CheckCircle2 size={12} /> Enviado / Concluído
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>
                        <Clock size={12} /> Pendente na Bancada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção Destacada: Cotação de Frete & Fiscal (Bitrix) */}
              <div className={styles.freteBox}>
                <div className={styles.freteHeaderRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Truck size={16} color="var(--vp-blue-primary)" />
                    <strong style={{ fontSize: "0.85rem", color: "var(--vp-navy-dark)" }}>
                      Cotação de Frete & Cobrança (Bitrix / Fiscal)
                    </strong>
                  </div>
                  <span className={styles.badgeFreteOrigem}>
                    Origem: VendPago ({CEP_ORIGEM_VENDPAGO})
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", fontSize: "0.82rem", marginTop: "0.4rem" }}>
                  <div>
                    <span style={{ color: "var(--vp-text-muted)", fontSize: "0.72rem" }}>Modalidade de Envio:</span>
                    <div style={{ fontWeight: 700, color: "var(--vp-navy-dark)" }}>
                      {itemDetalhes.tipoEnvio || "SEDEX"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--vp-text-muted)", fontSize: "0.72rem" }}>Valor do Frete Cotado:</span>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: itemDetalhes.valorFrete ? "#15803d" : "#b45309" }}>
                      {itemDetalhes.valorFrete
                        ? (String(itemDetalhes.valorFrete).trim().startsWith("R$")
                            ? itemDetalhes.valorFrete
                            : `R$ ${itemDetalhes.valorFrete}`)
                        : "Não informado / A calcular"}
                    </div>
                  </div>
                </div>

                <div className={styles.freteActionsRow}>
                  <button
                    type="button"
                    className={styles.btnSimularCorreiosModal}
                    onClick={() => abrirCalculoOficialCorreios(itemDetalhes)}
                    title="Abre a tela oficial dos Correios com o cálculo dos preços e prazos já processados para printar"
                  >
                    <ExternalLink size={13} />
                    <span>Abrir Cálculo Oficial nos Correios</span>
                  </button>

                  <button
                    type="button"
                    className={copiadoBitrix ? styles.btnCopiarBitrixSucesso : styles.btnCopiarBitrixModal}
                    onClick={() => copiarResumoBitrix(itemDetalhes)}
                    title="Copiar dados formatados para colar direto no chamado/tarefa do Bitrix"
                  >
                    {copiadoBitrix ? (
                      <>
                        <Check size={13} />
                        <span>Copiado para o Bitrix!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copiar Cobrança p/ Bitrix</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {itemDetalhes.itens && itemDetalhes.itens.length > 0 && (
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Itens Inclusos no Pacote:</span>
                  <div style={{ background: "var(--vp-bg-main)", padding: "0.5rem", borderRadius: "4px", fontSize: "0.85rem", marginTop: "2px" }}>
                    {itemDetalhes.itens.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "0.4rem" }}>
                        <strong>{it.qtd || 1}x</strong>
                        <span>{it.isCustom ? (it.nomeCustom || it.nome) : it.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {itemDetalhes.endereco && (
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Endereço de Destino:</span>
                  <div style={{ background: "var(--vp-bg-main)", padding: "0.5rem", borderRadius: "4px", fontSize: "0.85rem" }}>
                    {itemDetalhes.endereco}
                  </div>
                </div>
              )}

              {itemDetalhes.observacoes && (
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Observações Técnicas:</span>
                  <div style={{ background: "var(--vp-bg-main)", padding: "0.5rem", borderRadius: "4px", fontSize: "0.85rem" }}>
                    {itemDetalhes.observacoes}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setItemDetalhes(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

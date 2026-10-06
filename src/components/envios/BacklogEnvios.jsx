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
  Plus
} from "lucide-react";
import {
  getEnviosPendentes,
  getEnviosConcluidos,
  updateEnvio,
  deleteEnvio
} from "../../services/envioService";
import { MOTIVOS } from "../../constants/envioConfig";
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

export default function BacklogEnvios({ onEditItem = null, onNavigateToNew = null }) {
  const [activeTab, setActiveTab] = useState("pendentes"); // "pendentes" | "concluidos"
  const [pendentes, setPendentes] = useState([]);
  const [concluidos, setConcluidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");
  const [apenasAtrasados48h, setApenasAtrasados48h] = useState(false);

  // Modais de Ação Rápida
  const [itemParaConcluir, setItemParaConcluir] = useState(null);
  const [modalConcluirData, setModalConcluirData] = useState({
    rastreio: "",
    nfe: ""
  });
  const [concluindoLoading, setConcluindoLoading] = useState(false);

  const [itemDetalhes, setItemDetalhes] = useState(null);

  // Carrega lista de envios
  const carregarDados = async () => {
    setLoading(true);
    try {
      const [listPendentes, listConcluidos] = await Promise.all([
        getEnviosPendentes(),
        getEnviosConcluidos()
      ]);
      setPendentes(listPendentes);
      setConcluidos(listConcluidos);
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
    return pendentes.filter((item) => item.diasAguardandoNfe >= 2).length;
  }, [pendentes]);

  // Lista atual conforme aba e filtros
  const listaExibida = useMemo(() => {
    const base = activeTab === "pendentes" ? pendentes : concluidos;

    return base.filter((item) => {
      // Filtro de texto
      const term = searchQuery.toLowerCase().trim();
      const matchText =
        !term ||
        (item.conteudo && item.conteudo.toLowerCase().includes(term)) ||
        (item.destinatario && item.destinatario.toLowerCase().includes(term)) ||
        (item.mac && item.mac.toLowerCase().includes(term)) ||
        (item.rastreio && item.rastreio.toLowerCase().includes(term)) ||
        (item.chamado && item.chamado.toLowerCase().includes(term)) ||
        (item.nfe && item.nfe.toLowerCase().includes(term)) ||
        (item.motivo && item.motivo.toLowerCase().includes(term));

      // Filtro por tipo de envio
      const matchTipo = tipoFiltro === "TODOS" || item.tipoEnvio === tipoFiltro;

      // Filtro de gargalo > 48h
      const matchAtraso =
        !apenasAtrasados48h ||
        (activeTab === "pendentes" && item.diasAguardandoNfe >= 2);

      return matchText && matchTipo && matchAtraso;
    });
  }, [activeTab, pendentes, concluidos, searchQuery, tipoFiltro, apenasAtrasados48h]);

  // Abertura do modal de conclusão rápida
  const abrirModalConcluir = (item) => {
    setItemParaConcluir(item);
    setModalConcluirData({
      rastreio: item.rastreio || "",
      nfe: item.nfe === "A ser informado" ? "" : item.nfe || ""
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
        nfe: modalConcluirData.nfe.trim() || itemParaConcluir.nfe
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
    const nfeLower = String(item.nfe || "").trim().toLowerCase();
    const isPendente = nfeLower === "a ser informado" || nfeLower === "a ser informada" || !item.nfe;

    if (!isPendente) {
      return (
        <span className={styles.nfeCode} title="NF-e Emitida">
          {item.nfe}
        </span>
      );
    }

    if (item.diasAguardandoNfe >= 2) {
      return (
        <span
          className={`${styles.badge} ${styles.badgeDanger}`}
          title={`Aguardando emissão há ${item.diasAguardandoNfe} dias (> 48h)`}
        >
          <AlertTriangle size={12} />
          {item.diasAguardandoNfe}d aguardando (&gt;48h)
        </span>
      );
    }

    if (item.diasAguardandoNfe === 1) {
      return (
        <span
          className={`${styles.badge} ${styles.badgeWarning}`}
          title="Aguardando emissão há 1 dia (24h)"
        >
          <Clock size={12} />
          1d aguardando
        </span>
      );
    }

    return (
      <span className={`${styles.badge} ${styles.badgeNeutral}`}>
        <Clock size={12} />
        Aguardando NF-e
      </span>
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

      {/* Alerta de Gargalo na Aba de Pendentes */}
      {activeTab === "pendentes" && totalAtrasados48h > 0 && (
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
            className={`${styles.filterToggle} ${
              apenasAtrasados48h ? styles.filterToggleActive : ""
            }`}
            onClick={() => setApenasAtrasados48h(!apenasAtrasados48h)}
          >
            {apenasAtrasados48h ? "Exibir Todos" : "Filtrar Somente Gargalo (>48h)"}
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
        </div>
      </div>

      {/* Tabela de Envios */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Data</th>
              <th className={styles.th}>Chamado</th>
              <th className={styles.th}>Conteúdo / MAC</th>
              <th className={styles.th}>Motivo</th>
              <th className={styles.th}>Destinatário</th>
              <th className={styles.th}>Tipo / Rastreio</th>
              <th className={styles.th}>Status NF-e</th>
              <th className={styles.th}>QA Bancada</th>
              <th className={styles.th} style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", padding: "2.5rem" }}>
                  Carregando registros de envios...
                </td>
              </tr>
            ) : listaExibida.length === 0 ? (
              <tr>
                <td colSpan="9" className={styles.emptyState}>
                  <Inbox className={styles.emptyIcon} />
                  <p>Nenhum registro encontrado para este filtro.</p>
                </td>
              </tr>
            ) : (
              listaExibida.map((item) => {
                const isCritical =
                  activeTab === "pendentes" && item.diasAguardandoNfe >= 2;

                return (
                  <tr
                    key={item.id}
                    className={`${styles.tr} ${isCritical ? styles.trCritical : ""}`}
                  >
                    <td className={styles.td}>
                      <span style={{ fontWeight: 600 }}>{item.data}</span>
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
                      {item.mac ? (
                        <div style={{ marginTop: "3px" }}>
                          <code className={styles.macCode}>{item.mac}</code>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.75rem", color: "var(--vp-text-dim)" }}>
                          -
                        </div>
                      )}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                          {item.tipoEnvio || "SEDEX"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", fontFamily: "monospace", marginTop: "2px" }}>
                        {item.rastreio ? (
                          <span style={{ color: "var(--vp-blue-primary)", fontWeight: 600 }}>
                            {item.rastreio}
                          </span>
                        ) : (
                          <span style={{ color: "var(--vp-text-dim)" }}>Sem rastreio</span>
                        )}
                      </div>
                    </td>

                    <td className={styles.td}>
                      {renderBadgeNfe(item)}
                    </td>

                    <td className={styles.td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          className={`${styles.checkIndicator} ${
                            item.testado ? styles.checkOk : styles.checkMissing
                          }`}
                        >
                          <Check size={12} /> Testado
                        </span>
                        <span
                          className={`${styles.checkIndicator} ${
                            item.doubleCheck ? styles.checkOk : styles.checkMissing
                          }`}
                        >
                          <Check size={12} /> Double Check
                        </span>
                      </div>
                    </td>

                    <td className={styles.td} style={{ textAlign: "right" }}>
                      <div className={styles.cellActions} style={{ justifyContent: "flex-end" }}>
                        {activeTab === "pendentes" && (
                          <button
                            type="button"
                            className={styles.btnConcluirRapido}
                            onClick={() => abrirModalConcluir(item)}
                            title="Despachar equipamento e preencher rastreio/NF-e"
                          >
                            <FileCheck size={14} />
                            <span>Concluir Envio</span>
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
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
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

            <form onSubmit={handleConfirmarConclusao}>
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

                <div style={{ fontSize: "0.75rem", color: "var(--vp-text-muted)" }}>
                  Ao confirmar, o status será marcado como <strong>Despachado / Concluído</strong> e movido para o histórico.
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  style={{
                    height: "36px",
                    padding: "0 1rem",
                    border: "1px solid var(--vp-border-default)",
                    borderRadius: "4px",
                    background: "#fff",
                    cursor: "pointer"
                  }}
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

      {/* Modal de Detalhes do Registro */}
      {itemDetalhes && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard} style={{ maxWidth: "560px" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Data do Envio:</span>
                  <div style={{ fontWeight: 600 }}>{itemDetalhes.data}</div>
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

                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>Equipamento / Conteúdo:</span>
                  <div style={{ fontWeight: 600 }}>{itemDetalhes.conteudo}</div>
                </div>
                <div>
                  <span style={{ color: "var(--vp-text-muted)", fontSize: "0.75rem" }}>MAC / Serial:</span>
                  <div style={{ marginTop: "2px" }}>
                    <code className={styles.macCode}>{itemDetalhes.mac || "Não informado"}</code>
                  </div>
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

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem", paddingTop: "0.5rem", borderTop: "1px solid var(--vp-border-light)" }}>
                <span className={`${styles.checkIndicator} ${itemDetalhes.testado ? styles.checkOk : styles.checkMissing}`}>
                  <Check size={14} /> Testado na Bancada
                </span>
                <span className={`${styles.checkIndicator} ${itemDetalhes.doubleCheck ? styles.checkOk : styles.checkMissing}`}>
                  <Check size={14} /> Double Check Realizado
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                style={{
                  height: "36px",
                  padding: "0 1.25rem",
                  border: "1px solid var(--vp-border-default)",
                  borderRadius: "4px",
                  background: "#fff",
                  cursor: "pointer"
                }}
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

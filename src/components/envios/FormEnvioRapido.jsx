// src/components/envios/FormEnvioRapido.jsx
import React, { useState, useEffect } from "react";
import {
  PackagePlus,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Cpu,
  FileText,
  MapPin,
  Search,
  Box,
  ClipboardList,
  Check,
  Calculator
} from "lucide-react";
import { createEnvio, updateEnvio } from "../../services/envioService";
import {
  MOTIVOS,
  EQUIPAMENTOS_PADRAO,
  TIPOS_SERVICO_CORREIOS,
  equipamentoRequerMac,
  formatarMacOuSerial,
  abrirCalculoOficialCorreios,
  CEP_ORIGEM_VENDPAGO,
  formatarDataBR,
  dataParaInputDate
} from "../../constants/envioConfig";
import styles from "./FormEnvioRapido.module.css";

const createDefaultItem = (nome = EQUIPAMENTOS_PADRAO[0], qtd = 1) => {
  const requer = equipamentoRequerMac(nome);
  return {
    qtd,
    nome,
    isCustom: false,
    nomeCustom: "",
    requerMac: requer,
    macs: requer ? Array.from({ length: qtd }, () => "") : []
  };
};

const INITIAL_STATE = {
  data: new Date().toISOString().split("T")[0],
  itens: [createDefaultItem()],
  chamado: "",
  linkChamado: "",
  nfe: "",
  motivo: "Suporte",
  // Destinatário
  destinatario: "",
  cep: "",
  logradouro: "",
  numero: "",
  semNumero: false,
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  // Objeto Postagem Correios
  tipoEnvio: "SEDEX",
  valorFrete: "",
  centroCusto: "SUPORTE",
  pesoGramas: "500",
  dimensoes: "16x11x6",
  valorDeclarado: "",
  // Validações
  observacoes: "",
  enviado: false
};

export default function FormEnvioRapido({ initialData = null, onSuccess = null, onCancel = null }) {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
  const [loteModal, setLoteModal] = useState({ isOpen: false, itemIdx: null, text: "", ajustarQtd: true });

  useEffect(() => {
    if (initialData) {
      const itensCarregados = initialData.itens && initialData.itens.length > 0
        ? initialData.itens.map((it) => {
            const nomeFinal = it.isCustom ? (it.nomeCustom || "") : (it.nome || EQUIPAMENTOS_PADRAO[0]);
            const requer = it.requerMac !== undefined ? it.requerMac : equipamentoRequerMac(nomeFinal);
            const qtd = Math.max(1, Number(it.qtd) || 1);
            let macs = Array.isArray(it.macs) ? [...it.macs] : [];

            // Compatibilidade com registros legados com string única no root ou no item
            if (macs.length === 0 && requer) {
              const macOrigem = it.mac || initialData.mac || "";
              if (macOrigem) {
                const splits = macOrigem.split(/[\r\n,;]+/).map((s) => formatarMacOuSerial(s.trim())).filter(Boolean);
                macs = splits;
              }
            }

            if (requer) {
              while (macs.length < qtd) macs.push("");
              macs = macs.slice(0, qtd);
            } else {
              macs = [];
            }

            return {
              qtd,
              nome: it.nome || EQUIPAMENTOS_PADRAO[0],
              isCustom: Boolean(it.isCustom),
              nomeCustom: it.nomeCustom || "",
              requerMac: requer,
              macs
            };
          })
        : [
            (() => {
              const nome = initialData.conteudo || EQUIPAMENTOS_PADRAO[0];
              const requer = equipamentoRequerMac(nome);
              let macs = [];
              if (requer && initialData.mac) {
                macs = initialData.mac.split(/[\r\n,;]+/).map((s) => formatarMacOuSerial(s.trim())).filter(Boolean);
              }
              while (macs.length < 1) macs.push("");
              return {
                qtd: 1,
                nome,
                isCustom: true,
                nomeCustom: initialData.conteudo || "",
                requerMac: requer,
                macs: requer ? macs : []
              };
            })()
          ];

      setFormData({
        ...INITIAL_STATE,
        ...initialData,
        data: dataParaInputDate(initialData.data),
        motivo: initialData.motivo || "Suporte",
        tipoEnvio: initialData.tipoEnvio || "SEDEX",
        valorFrete: initialData.valorFrete || "",
        itens: itensCarregados
      });
    } else {
      setFormData(INITIAL_STATE);
    }
  }, [initialData]);

  // Atalho de teclado: F2 para preencher NF-e como 'A ser informado'
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        preencherNfePendente();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const buscarCep = async (cepValue) => {
    const cepLimpo = (cepValue || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf
        }));
      }
    } catch (err) {
      console.warn("Erro ao buscar CEP:", err);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (v.length > 5) v = `${v.slice(0, 5)}-${v.slice(5)}`;
    setFormData((prev) => ({ ...prev, cep: v }));
    if (v.replace(/\D/g, "").length === 8) {
      buscarCep(v);
    }
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      itens: [...prev.itens, createDefaultItem(EQUIPAMENTOS_PADRAO[0], 1)]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.itens.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const novos = [...prev.itens];
      const item = { ...novos[index] };

      if (field === "qtd") {
        const novaQtd = Math.max(1, Number(value) || 1);
        item.qtd = novaQtd;
        if (item.requerMac) {
          const macsAtuais = Array.isArray(item.macs) ? item.macs : [];
          item.macs = Array.from({ length: novaQtd }, (_, i) => macsAtuais[i] || "");
        }
      } else if (field === "nome") {
        item.nome = value;
        const requer = equipamentoRequerMac(value);
        item.requerMac = requer;
        item.macs = requer ? Array.from({ length: item.qtd || 1 }, (_, i) => (item.macs || [])[i] || "") : [];
      } else if (field === "nomeCustom") {
        item.nomeCustom = value;
        if (!item.requerMacManual) {
          const requer = equipamentoRequerMac(value);
          item.requerMac = requer;
          item.macs = requer ? Array.from({ length: item.qtd || 1 }, (_, i) => (item.macs || [])[i] || "") : [];
        }
      } else if (field === "isCustom") {
        item.isCustom = value;
        const nomeFinal = value ? item.nomeCustom : item.nome;
        const requer = equipamentoRequerMac(nomeFinal);
        item.requerMac = requer;
        item.macs = requer ? Array.from({ length: item.qtd || 1 }, (_, i) => (item.macs || [])[i] || "") : [];
      } else if (field === "requerMac") {
        item.requerMac = Boolean(value);
        item.requerMacManual = true;
        item.macs = value ? Array.from({ length: item.qtd || 1 }, (_, i) => (item.macs || [])[i] || "") : [];
      } else {
        item[field] = value;
      }

      novos[index] = item;
      return { ...prev, itens: novos };
    });
  };

  const handleMacChange = (itemIdx, slotIdx, valor) => {
    const formatado = formatarMacOuSerial(valor);
    setFormData((prev) => {
      const novos = [...prev.itens];
      const item = { ...novos[itemIdx] };
      const macs = [...(item.macs || [])];
      macs[slotIdx] = formatado;
      item.macs = macs;
      novos[itemIdx] = item;
      return { ...prev, itens: novos };
    });

    // Auto-avanço ao completar 12 hexadecimais (bip ou digitação)
    const hexPuro = valor.replace(/[^a-fA-F0-9]/g, "");
    if (hexPuro.length === 12) {
      setTimeout(() => {
        const nextInput = document.getElementById(`mac-input-${itemIdx}-${slotIdx + 1}`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }, 50);
    }
  };

  const handleMacKeyDown = (e, itemIdx, slotIdx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = document.getElementById(`mac-input-${itemIdx}-${slotIdx + 1}`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const handleMacPaste = (e, itemIdx, startSlotIdx) => {
    const pasteText = e.clipboardData?.getData("text");
    if (!pasteText) return;

    const tokens = pasteText
      .split(/[\r\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length > 1) {
      e.preventDefault();
      setFormData((prev) => {
        const novos = [...prev.itens];
        const item = { ...novos[itemIdx] };

        // Se colou mais MACs do que a quantidade e iniciou no primeiro slot, expande a quantidade!
        if (startSlotIdx === 0 && tokens.length > item.qtd) {
          item.qtd = tokens.length;
        }

        const macs = Array.from({ length: item.qtd }, (_, i) => (item.macs || [])[i] || "");
        tokens.forEach((token, offset) => {
          const targetIndex = startSlotIdx + offset;
          if (targetIndex < item.qtd) {
            macs[targetIndex] = formatarMacOuSerial(token);
          }
        });

        item.macs = macs;
        novos[itemIdx] = item;
        return { ...prev, itens: novos };
      });

      setStatusMessage({
        type: "success",
        text: `${tokens.length} MACs colados e distribuídos com sucesso no equipamento!`
      });
    }
  };

  const abrirModalLote = (itemIdx) => {
    const item = formData.itens[itemIdx];
    const macsExistentes = (item.macs || []).filter(Boolean).join("\n");
    setLoteModal({
      isOpen: true,
      itemIdx,
      text: macsExistentes,
      ajustarQtd: true
    });
  };

  const aplicarLote = () => {
    if (loteModal.itemIdx === null) return;

    const tokens = loteModal.text
      .split(/[\r\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      setLoteModal({ isOpen: false, itemIdx: null, text: "", ajustarQtd: true });
      return;
    }

    setFormData((prev) => {
      const novos = [...prev.itens];
      const item = { ...novos[loteModal.itemIdx] };

      if (loteModal.ajustarQtd && tokens.length > item.qtd) {
        item.qtd = tokens.length;
      }

      const macs = Array.from({ length: item.qtd }, (_, i) => (item.macs || [])[i] || "");
      tokens.forEach((token, i) => {
        if (i < item.qtd) {
          macs[i] = formatarMacOuSerial(token);
        }
      });

      item.macs = macs;
      novos[loteModal.itemIdx] = item;
      return { ...prev, itens: novos };
    });

    setStatusMessage({
      type: "success",
      text: `${tokens.length} MACs importados com sucesso em lote!`
    });
    setLoteModal({ isOpen: false, itemIdx: null, text: "", ajustarQtd: true });
  };

  const limparMacsItem = (itemIdx) => {
    setFormData((prev) => {
      const novos = [...prev.itens];
      const item = { ...novos[itemIdx] };
      item.macs = Array.from({ length: item.qtd }, () => "");
      novos[itemIdx] = item;
      return { ...prev, itens: novos };
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value
      };
      if (name === "tipoEnvio" && value === "Retirada na VendPago" && !prev.valorFrete) {
        updated.valorFrete = "0,00";
      }
      return updated;
    });
  };

  const handleSimularCorreios = () => {
    const cepLimpo = (formData.cep || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setStatusMessage({
        type: "error",
        text: "Informe um CEP de destino válido (8 dígitos) na Etapa 3 antes de simular o frete nos Correios."
      });
      return;
    }

    abrirCalculoOficialCorreios({
      cepDestino: formData.cep,
      tipoEnvio: formData.tipoEnvio,
      pesoGramas: formData.pesoGramas || "500",
      altura: "7",
      largura: "13",
      comprimento: "16"
    });
  };

  const preencherNfePendente = () => {
    setFormData((prev) => ({ ...prev, nfe: "A ser informado" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.destinatario.trim()) {
      setStatusMessage({ type: "error", text: "Informe o Nome do destinatário." });
      return;
    }

    const descricaoConteudo = formData.itens
      .map((it) => {
        const nomeFinal = it.isCustom ? (it.nomeCustom || "").trim() : it.nome;
        return `${it.qtd || 1}x ${nomeFinal}`;
      })
      .filter(Boolean)
      .join(" + ");

    if (!descricaoConteudo.trim()) {
      setStatusMessage({ type: "error", text: "Adicione ao menos um item ao pacote." });
      return;
    }

    // Validação estrita: cada unidade de terminal DEVE ter seu respectivo MAC informado
    for (let i = 0; i < formData.itens.length; i++) {
      const item = formData.itens[i];
      if (item.requerMac) {
        const nomeItem = item.isCustom ? (item.nomeCustom || `Item #${i + 1}`) : item.nome;
        const preenchidos = (item.macs || []).filter((m) => m && m.trim().length > 0);
        if (preenchidos.length < item.qtd) {
          const faltam = item.qtd - preenchidos.length;
          setStatusMessage({
            type: "error",
            text: `O terminal "${nomeItem}" possui ${item.qtd} unidade(s), mas faltam ${faltam} MAC(s) a preencher.`
          });
          return;
        }
      }
    }

    // Coleta todos os MACs formatados do pacote
    const todosMacs = [];
    formData.itens.forEach((it) => {
      if (it.requerMac && Array.isArray(it.macs)) {
        it.macs.forEach((m) => {
          const macFmt = formatarMacOuSerial(m);
          if (macFmt.trim()) {
            todosMacs.push(macFmt.trim());
          }
        });
      }
    });

    const logr = formData.logradouro || "";
    const num = formData.semNumero ? "S/N" : (formData.numero || "");
    const comp = formData.complemento ? ` - ${formData.complemento}` : "";
    const brr = formData.bairro || "";
    const cid = formData.cidade || "";
    const uf = formData.uf || "";
    const cep = formData.cep || "";
    const enderecoConsolidado = `${logr}${num ? ", " + num : ""}${comp} - ${brr}, ${cid} - ${uf}, CEP: ${cep}`.trim();

    const payload = {
      ...formData,
      data: formatarDataBR(formData.data),
      conteudo: descricaoConteudo,
      endereco: enderecoConsolidado,
      rastreio: initialData?.rastreio || "",
      centroCusto: (formData.motivo || "SUPORTE").toUpperCase(),
      macs: todosMacs,
      mac: todosMacs.length > 0 ? todosMacs.join(", ") : "",
      testado: true,
      doubleCheck: true
    };

    setLoading(true);
    setStatusMessage({ type: "", text: "" });

    try {
      if (initialData?.id) {
        await updateEnvio(initialData.id, payload);
        setStatusMessage({ type: "success", text: "Envio atualizado com sucesso!" });
      } else {
        await createEnvio(payload);
        setStatusMessage({ type: "success", text: "Pacote registrado e posicionado na fila de envio!" });
        setFormData({ ...INITIAL_STATE, data: formData.data, itens: [createDefaultItem()] });
      }

      if (onSuccess) setTimeout(() => onSuccess(), 600);
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: "error", text: "Erro ao gravar registro de envio." });
    } finally {
      setLoading(false);
    }
  };

  const motivoSelecionado = MOTIVOS[formData.motivo];

  return (
    <div className={styles.container}>
      {/* Cabeçalho */}
      <div className={styles.formHeader}>
        <div className={styles.headerTitleWrapper}>
          <div className={styles.headerIconBox}>
            <PackagePlus size={20} />
          </div>
          <div>
            <h2 className={styles.headerTitle}>
              {initialData ? "Editar Registro de Envio" : "Novo Registro de Envio (Bancada AT)"}
            </h2>
            <p className={styles.headerSubtitle}>
              Siga a esteira de 4 etapas com rastreabilidade individual de MACs por terminal
            </p>
          </div>
        </div>

        {initialData && onCancel && (
          <button type="button" onClick={onCancel} className={styles.btnSecondary}>
            <X size={15} /> Cancelar Edição
          </button>
        )}
      </div>

      {/* Régua de Fluxo Visual (Stepper da Esteira) */}
      <div className={styles.flowBar}>
        <div className={`${styles.flowStep} ${styles.flowStepBlue}`}>
          <span className={styles.stepNum}>1</span>
          <span className={styles.stepLabel}>Chamado & Triagem</span>
        </div>
        <div className={styles.flowArrow}>➔</div>

        <div className={`${styles.flowStep} ${styles.flowStepPurple}`}>
          <span className={styles.stepNum}>2</span>
          <span className={styles.stepLabel}>Itens & MACs</span>
        </div>
        <div className={styles.flowArrow}>➔</div>

        <div className={`${styles.flowStep} ${styles.flowStepGreen}`}>
          <span className={styles.stepNum}>3</span>
          <span className={styles.stepLabel}>Destinatário & CEP</span>
        </div>
        <div className={styles.flowArrow}>➔</div>

        <div className={`${styles.flowStep} ${styles.flowStepAmber}`}>
          <span className={styles.stepNum}>4</span>
          <span className={styles.stepLabel}>Expedição & Fiscal</span>
        </div>
      </div>

      {statusMessage.text && (
        <div className={statusMessage.type === "success" ? styles.bannerSuccess : styles.bannerError}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
          <button type="button" className={styles.bannerClose} onClick={() => setStatusMessage({ type: "", text: "" })}>
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formWrapper}>
        {/* ETAPA 1: ORIGEM & CHAMADO (AZUL) */}
        <section className={`${styles.cardSection} ${styles.sectionBlue}`}>
          <header className={styles.sectionHeader}>
            <div className={styles.stepBadge}>1</div>
            <FileText size={16} className={styles.sectionIcon} />
            <div>
              <h3 className={styles.sectionHeading}>Origem & Chamado de Suporte</h3>
              <span className={styles.sectionSub}>Identificação inicial da demanda e motivo do envio</span>
            </div>
          </header>

          <div className={styles.grid}>
            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Data do Pacote *</label>
              <input
                type="date"
                name="data"
                className={styles.input}
                value={formData.data}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Chamado / Ticket *</label>
              <input
                type="text"
                name="chamado"
                placeholder="#87911"
                className={styles.input}
                value={formData.chamado}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Motivo do Envio *</label>
              <select
                name="motivo"
                className={styles.select}
                value={formData.motivo}
                onChange={handleChange}
                style={{
                  borderColor: motivoSelecionado?.border,
                  backgroundColor: motivoSelecionado?.bg,
                  color: motivoSelecionado?.color,
                  fontWeight: 600
                }}
              >
                {Object.values(MOTIVOS).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Link do Chamado (CRM/Bitrix)</label>
              <input
                type="url"
                name="linkChamado"
                placeholder="https://..."
                className={styles.input}
                value={formData.linkChamado}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {/* ETAPA 2: BANCADA, ITENS & MACS (ROXO / TECH) */}
        <section className={`${styles.cardSection} ${styles.sectionPurple}`}>
          <header className={styles.sectionHeader}>
            <div className={styles.stepBadge}>2</div>
            <Cpu size={16} className={styles.sectionIcon} />
            <div style={{ flex: 1 }}>
              <h3 className={styles.sectionHeading}>Conteúdo do Pacote & MACs Individuais</h3>
              <span className={styles.sectionSub}>
                Cada terminal adicionado possui registro obrigatório de MAC
              </span>
            </div>
            <button type="button" className={styles.btnAddItem} onClick={handleAddItem}>
              <Plus size={14} /> Adicionar Item (+)
            </button>
          </header>

          {/* Lista de itens dinâmicos com bloco de MACs integrado */}
          <div className={styles.itemsList}>
            {formData.itens.map((item, idx) => {
              const preenchidos = (item.macs || []).filter((m) => m && m.trim().length > 0).length;
              const todosPreenchidos = item.requerMac && preenchidos === item.qtd && item.qtd > 0;

              return (
                <div key={idx} className={styles.itemRowWrapper}>
                  {/* Linha Principal do Item */}
                  <div className={styles.itemRow}>
                    <div className={styles.itemQtd}>
                      <label className={styles.subLabel}>Qtd</label>
                      <input
                        type="number"
                        min="1"
                        className={styles.inputQtd}
                        value={item.qtd}
                        onChange={(e) => handleItemChange(idx, "qtd", Number(e.target.value) || 1)}
                      />
                    </div>

                    <div className={styles.itemDesc}>
                      <div className={styles.labelRow}>
                        <label className={styles.subLabel}>Equipamento / Peça #{idx + 1}</label>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                          <label className={styles.checkboxInline}>
                            <input
                              type="checkbox"
                              checked={item.isCustom}
                              onChange={(e) => handleItemChange(idx, "isCustom", e.target.checked)}
                            />
                            Outro / Não listado
                          </label>

                          {item.isCustom && (
                            <label className={styles.checkboxInline} title="Define se este item personalizado exige coleta de MAC">
                              <input
                                type="checkbox"
                                checked={item.requerMac}
                                onChange={(e) => handleItemChange(idx, "requerMac", e.target.checked)}
                              />
                              Requer MAC / Serial
                            </label>
                          )}
                        </div>
                      </div>

                      {item.isCustom ? (
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="Digite o modelo ou acessório específico..."
                          value={item.nomeCustom}
                          onChange={(e) => handleItemChange(idx, "nomeCustom", e.target.value)}
                          required
                        />
                      ) : (
                        <select
                          className={styles.select}
                          value={item.nome}
                          onChange={(e) => handleItemChange(idx, "nome", e.target.value)}
                        >
                          {EQUIPAMENTOS_PADRAO.map((equip) => (
                            <option key={equip} value={equip}>{equip}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {formData.itens.length > 1 && (
                      <button
                        type="button"
                        className={styles.btnRemoveItem}
                        onClick={() => handleRemoveItem(idx)}
                        title="Remover este item do pacote"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* Subpainel de MACs: apenas para itens que exigem MAC (Terminais) */}
                  {item.requerMac && (
                    <div className={styles.macSection}>
                      <div className={styles.macSectionHeader}>
                        <div className={styles.macTitleGroup}>
                          <span className={styles.macTitle}>
                            Rastreabilidade por MAC / Serial ({preenchidos}/{item.qtd} preenchidos):
                          </span>
                          {todosPreenchidos ? (
                            <span className={styles.tagMacAllOk}>
                              <Check size={11} /> Todos informados
                            </span>
                          ) : (
                            <span className={styles.tagMacPending}>
                              Faltam {item.qtd - preenchidos} unidade(s)
                            </span>
                          )}
                        </div>

                        <div className={styles.macActionButtons}>
                          <button
                            type="button"
                            className={styles.btnLote}
                            onClick={() => abrirModalLote(idx)}
                            title="Colar lista de múltiplos MACs de uma planilha ou CRM"
                          >
                            <ClipboardList size={13} /> Colar em Lote ({item.qtd} un)
                          </button>

                          {preenchidos > 0 && (
                            <button
                              type="button"
                              className={styles.btnLimparMacs}
                              onClick={() => limparMacsItem(idx)}
                              title="Limpar todos os MACs preenchidos deste item"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Grade de slots de MACs (suporta de 1 a 50+ com scroll suave e preenchimento ágil) */}
                      <div className={styles.macGrid}>
                        {item.macs.map((macVal, slotIdx) => (
                          <div key={slotIdx} className={styles.macSlot}>
                            <span className={styles.macSlotNum}>#{slotIdx + 1}</span>
                            <input
                              id={`mac-input-${idx}-${slotIdx}`}
                              type="text"
                              className={`${styles.macInput} ${macVal ? styles.macInputFilled : ""}`}
                              placeholder="00:00:00:00:00:00"
                              value={macVal}
                              onChange={(e) => handleMacChange(idx, slotIdx, e.target.value)}
                              onKeyDown={(e) => handleMacKeyDown(e, idx, slotIdx)}
                              onPaste={(e) => handleMacPaste(e, idx, slotIdx)}
                            />
                          </div>
                        ))}
                      </div>

                      <div className={styles.macFooterHint}>
                        Dica: Bipe com o leitor direto ou cole uma coluna com todos os {item.qtd} MACs no campo #1 (avança automaticamente).
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ETAPA 3: DESTINATÁRIO & ENDEREÇO CORREIOS (ESMERALDA) */}
        <section className={`${styles.cardSection} ${styles.sectionGreen}`}>
          <header className={styles.sectionHeader}>
            <div className={styles.stepBadge}>3</div>
            <MapPin size={16} className={styles.sectionIcon} />
            <div>
              <h3 className={styles.sectionHeading}>Destinatário & Endereço de Entrega</h3>
              <span className={styles.sectionSub}>Dados no layout exato de importação da etiqueta dos Correios</span>
            </div>
          </header>

          <div className={styles.grid}>
            <div className={`${styles.fieldGroup} ${styles.col8}`}>
              <label className={styles.label}>Nome Completo / Razão Social *</label>
              <input
                type="text"
                name="destinatario"
                placeholder="Ex: MICHELE BOMFIM ANDRADE"
                className={styles.input}
                value={formData.destinatario}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col4}`}>
              <div className={styles.labelRow}>
                <label className={styles.label}>CEP *</label>
                {loadingCep && <span className={styles.tagCepLoading}>Buscando CEP...</span>}
              </div>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  name="cep"
                  placeholder="00000-000"
                  className={`${styles.input} ${styles.inputCepHighlight}`}
                  value={formData.cep}
                  onChange={handleCepChange}
                  onBlur={() => buscarCep(formData.cep)}
                  required
                />
                <button
                  type="button"
                  className={styles.btnIconInput}
                  onClick={() => buscarCep(formData.cep)}
                  title="Recarregar CEP no ViaCEP"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>

            <div className={`${styles.fieldGroup} ${styles.col7}`}>{/* Logradouro */}
              <label className={styles.label}>Endereço (Logradouro) *</label>
              <input
                type="text"
                name="logradouro"
                placeholder="Rua, Avenida, Praça..."
                className={styles.input}
                value={formData.logradouro}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col2}`}>
              <div className={styles.labelRow}>
                <label className={styles.label}>N.º *</label>
                <label className={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    name="semNumero"
                    checked={formData.semNumero}
                    onChange={handleChange}
                  />
                  S/N
                </label>
              </div>
              <input
                type="text"
                name="numero"
                disabled={formData.semNumero}
                className={styles.input}
                value={formData.semNumero ? "" : formData.numero}
                onChange={handleChange}
                placeholder="147"
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Complemento</label>
              <input
                type="text"
                name="complemento"
                placeholder="Sala, Apto, Galpão..."
                className={styles.input}
                value={formData.complemento}
                onChange={handleChange}
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col5}`}>
              <label className={styles.label}>Bairro *</label>
              <input
                type="text"
                name="bairro"
                placeholder="Bairro"
                className={styles.input}
                value={formData.bairro}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col5}`}>
              <label className={styles.label}>Cidade *</label>
              <input
                type="text"
                name="cidade"
                placeholder="Cidade"
                className={styles.input}
                value={formData.cidade}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col2}`}>
              <label className={styles.label}>UF *</label>
              <input
                type="text"
                name="uf"
                maxLength="2"
                placeholder="MG"
                className={styles.input}
                value={formData.uf}
                onChange={handleChange}
                required
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>
        </section>

        {/* ETAPA 4: EXPEDIÇÃO & CONTROLE FISCAL (ÂMBAR) */}
        <section className={`${styles.cardSection} ${styles.sectionAmber}`}>
          <header className={styles.sectionHeader}>
            <div className={styles.stepBadge}>4</div>
            <Box size={16} className={styles.sectionIcon} />
            <div>
              <h3 className={styles.sectionHeading}>Expedição & Controle Fiscal</h3>
              <span className={styles.sectionSub}>Modalidade de despacho, nota fiscal e dimensões do pacote</span>
            </div>
          </header>

          <div className={styles.grid}>
            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Serviço de Postagem</label>
              <select
                name="tipoEnvio"
                className={styles.select}
                value={formData.tipoEnvio}
                onChange={handleChange}
              >
                {TIPOS_SERVICO_CORREIOS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className={`${styles.fieldGroup} ${styles.col4}`}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Valor do Frete (R$)</label>
                <span className={styles.origemInfo}>Origem: {CEP_ORIGEM_VENDPAGO}</span>
              </div>
              <div className={styles.freteInputWrapper}>
                <input
                  type="text"
                  name="valorFrete"
                  placeholder="Ex: 38,50 ou 0,00"
                  className={styles.input}
                  value={formData.valorFrete}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className={styles.btnSimularFrete}
                  onClick={handleSimularCorreios}
                  title="Abrir tela oficial de cálculo dos Correios com CEP e peso já preenchidos"
                >
                  <Calculator size={14} />
                  <span>Simular Frete</span>
                </button>
              </div>
            </div>

            <div className={`${styles.fieldGroup} ${styles.col2}`}>
              <label className={styles.label}>Peso (g)</label>
              <input
                type="text"
                name="pesoGramas"
                placeholder="500"
                className={styles.input}
                value={formData.pesoGramas}
                onChange={handleChange}
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col3}`}>
              <label className={styles.label}>Valor Declarado (R$)</label>
              <input
                type="text"
                name="valorDeclarado"
                placeholder="1500.00"
                className={styles.input}
                value={formData.valorDeclarado}
                onChange={handleChange}
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.col6}`}>
              <div className={styles.labelRow}>
                <label className={styles.label}>
                  Nota Fiscal (NF-e)
                  {formData.nfe.toLowerCase() === "a ser informado" && (
                    <span className={styles.badgePendente}>Aguardando Emissão Fiscal</span>
                  )}
                </label>
              </div>
              <div className={styles.nfeContainer}>
                <input
                  type="text"
                  name="nfe"
                  placeholder="Número da NF-e (Ex: 155807)"
                  className={styles.input}
                  value={formData.nfe}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className={styles.btnAtalhoNfe}
                  onClick={preencherNfePendente}
                  title="Atalho rápido F2"
                >
                  <Zap size={14} /> [F2] A ser informado
                </button>
              </div>
            </div>

            <div className={`${styles.fieldGroup} ${styles.col6}`}>
              <label className={styles.label}>Observações Operacionais da Caixa</label>
              <input
                type="text"
                name="observacoes"
                placeholder="Orientação interna (Ex: enviar com fonte extra ou aguardar lote de produção)..."
                className={styles.input}
                value={formData.observacoes}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {/* Rodapé de Ações Finais */}
        <div className={styles.actionsBar}>
          <div className={styles.helperActions}>
            <span>Dica de Bancada:</span> Use <kbd className={styles.kbd}>Tab</kbd> para navegar e <kbd className={styles.kbd}>F2</kbd> para NF-e pendente.
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setFormData({ ...INITIAL_STATE, itens: [createDefaultItem()] })}
              className={styles.btnSecondary}
              disabled={loading}
            >
              <RotateCcw size={15} /> Limpar
            </button>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading}
            >
              <Save size={16} />
              <span>{loading ? "Gravando..." : initialData ? "Salvar Alterações" : "Gravar Pacote na Fila"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Modal Rápido de Colagem em Lote de MACs */}
      {loteModal.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ClipboardList size={18} className={styles.modalHeaderIcon} />
                <h4 className={styles.modalTitle}>
                  Importar MACs em Lote (Item #{loteModal.itemIdx + 1})
                </h4>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setLoteModal({ isOpen: false, itemIdx: null, text: "", ajustarQtd: true })}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalInstructions}>
                Cole abaixo a lista de MACs copiados de uma planilha Excel, Bitrix ou arquivo de texto (um por linha ou separados por vírgula):
              </p>

              <textarea
                className={styles.modalTextarea}
                rows={7}
                placeholder={"b0cbd85fd1c2\nb0cbd85fd1c3\nb0cbd85fd1c4\n..."}
                value={loteModal.text}
                onChange={(e) => setLoteModal((prev) => ({ ...prev, text: e.target.value }))}
                autoFocus
              />

              <div className={styles.modalFooterRow}>
                <span className={styles.badgeContadorModal}>
                  Detectados:{" "}
                  <strong>
                    {loteModal.text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean).length}
                  </strong>{" "}
                  MAC(s)
                </span>

                <label className={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={loteModal.ajustarQtd}
                    onChange={(e) => setLoteModal((prev) => ({ ...prev, ajustarQtd: e.target.checked }))}
                  />
                  Ajustar quantidade de unidades automaticamente se houver mais MACs
                </label>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setLoteModal({ isOpen: false, itemIdx: null, text: "", ajustarQtd: true })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={aplicarLote}
              >
                <Check size={16} /> Aplicar MACs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

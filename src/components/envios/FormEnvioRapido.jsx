import React, { useState, useEffect, useRef } from "react";
import {
  PackagePlus,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Save,
  CheckSquare,
  Square,
  ExternalLink,
  Tag,
  Truck,
  Cpu,
  FileText
} from "lucide-react";
import { createEnvio, updateEnvio } from "../../services/envioService";
import styles from "./FormEnvioRapido.module.css";

const TIPOS_ENVIO = [
  "SEDEX",
  "PAC",
  "Retirada",
  "Transportadora",
  "Motoboy",
  "Logística Reversa"
];

const MOTIVOS_COMUNS = [
  "Reparo Concluído",
  "Troca em Garantia",
  "Envio de Peças",
  "Devolução",
  "Demonstração",
  "Empréstimo Temporário",
  "Retorno de Calibração",
  "Descarte / Sucata"
];

const INITIAL_STATE = {
  data: new Date().toISOString().split("T")[0],
  rastreio: "",
  conteudo: "",
  mac: "",
  destinatario: "",
  testado: false,
  nfe: "",
  chamado: "",
  linkChamado: "",
  tipoEnvio: "SEDEX",
  endereco: "",
  motivo: "Reparo Concluído",
  observacoes: "",
  doubleCheck: false,
  enviado: false
};

export default function FormEnvioRapido({ initialData = null, onSuccess = null, onCancel = null }) {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
  const macInputRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        data: initialData.data || new Date().toISOString().split("T")[0],
        rastreio: initialData.rastreio || "",
        conteudo: initialData.conteudo || "",
        mac: initialData.mac || "",
        destinatario: initialData.destinatario || "",
        testado: Boolean(initialData.testado),
        nfe: initialData.nfe || "",
        chamado: initialData.chamado || "",
        linkChamado: initialData.linkChamado || "",
        tipoEnvio: initialData.tipoEnvio || "SEDEX",
        endereco: initialData.endereco || "",
        motivo: initialData.motivo || "Reparo Concluído",
        observacoes: initialData.observacoes || "",
        doubleCheck: Boolean(initialData.doubleCheck),
        enviado: Boolean(initialData.enviado)
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const preencherNfePendente = () => {
    setFormData((prev) => ({
      ...prev,
      nfe: "A ser informado"
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.conteudo.trim()) {
      setStatusMessage({
        type: "error",
        text: "Informe o conteúdo do pacote para continuar."
      });
      return;
    }

    if (!formData.destinatario.trim()) {
      setStatusMessage({
        type: "error",
        text: "Informe o destinatário ou operador responsável."
      });
      return;
    }

    setLoading(true);
    setStatusMessage({ type: "", text: "" });

    try {
      if (initialData && initialData.id) {
        await updateEnvio(initialData.id, formData);
        setStatusMessage({
          type: "success",
          text: `Envio atualizado com sucesso (${initialData.chamado || "Registro"}).`
        });
      } else {
        await createEnvio(formData);
        setStatusMessage({
          type: "success",
          text: `Registro de envio cadastrado com sucesso!`
        });

        // Mantém a data de hoje e reseta para o próximo item da bancada
        setFormData({
          ...INITIAL_STATE,
          data: formData.data || new Date().toISOString().split("T")[0]
        });

        if (macInputRef.current) {
          macInputRef.current.focus();
        }
      }

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 600);
      }
    } catch (err) {
      console.error("Erro ao salvar envio:", err);
      setStatusMessage({
        type: "error",
        text: "Erro ao salvar no banco de dados. Verifique a conexão."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_STATE);
    setStatusMessage({ type: "", text: "" });
  };

  return (
    <div className={styles.container}>
      <div className={styles.formHeader}>
        <div className={styles.headerTitleWrapper}>
          <PackagePlus className={styles.headerIcon} />
          <div>
            <h2 className={styles.headerTitle}>
              {initialData ? "Editar Registro de Envio" : "Registro Rápido de Envio (Bancada AT)"}
            </h2>
            <p className={styles.headerSubtitle}>
              Preenchimento ágil para triagem, liberação e controle de NF-e da Assistência Técnica
            </p>
          </div>
        </div>

        {initialData && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={styles.btnSecondary}
          >
            <X size={16} /> Cancelar Edição
          </button>
        )}
      </div>

      {statusMessage.text && (
        <div
          className={
            statusMessage.type === "success"
              ? styles.bannerSuccess
              : styles.bannerError
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {statusMessage.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setStatusMessage({ type: "", text: "" })}
            aria-label="Fechar mensagem"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Bloco 1: Identificação & Chamado */}
        <div className={styles.sectionTitle}>
          <FileText size={14} /> Dados Operacionais & Chamado
        </div>

        <div className={styles.grid}>
          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="data">
              Data de Registro <span className={styles.required}>*</span>
            </label>
            <input
              id="data"
              name="data"
              type="date"
              className={styles.input}
              value={formData.data}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="chamado">
              Chamado / Ticket
            </label>
            <input
              id="chamado"
              name="chamado"
              type="text"
              placeholder="#10492"
              className={styles.input}
              value={formData.chamado}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="linkChamado">
              Link do Chamado (URL)
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="linkChamado"
                name="linkChamado"
                type="url"
                placeholder="https://suporte.vendpago.com.br/ticket/..."
                className={styles.input}
                value={formData.linkChamado}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Equipamento & Fiscal */}
        <div className={styles.sectionTitle}>
          <Cpu size={14} /> Equipamento & Controle Fiscal
        </div>

        <div className={styles.grid}>
          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="conteudo">
              Conteúdo / Itens Enviados <span className={styles.required}>*</span>
            </label>
            <input
              id="conteudo"
              name="conteudo"
              type="text"
              placeholder="Ex: SmartPOS V2 + Fonte 9V + Bobinas"
              className={styles.input}
              value={formData.conteudo}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="mac">
              MAC / Número de Série
            </label>
            <input
              id="mac"
              name="mac"
              ref={macInputRef}
              type="text"
              placeholder="AA:BB:CC:11:22:33 ou S/N do POS"
              className={styles.input}
              value={formData.mac}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="nfe">
              <span>
                Nota Fiscal (NF-e)
                {formData.nfe.toLowerCase() === "a ser informado" && (
                  <span className={styles.badgePendente} style={{ marginLeft: "6px" }}>
                    Aguardando NF-e
                  </span>
                )}
              </span>
            </label>
            <div className={styles.nfeContainer}>
              <input
                id="nfe"
                name="nfe"
                type="text"
                placeholder="Número da NF ou use o atalho"
                className={styles.input}
                value={formData.nfe}
                onChange={handleChange}
              />
              <button
                type="button"
                className={styles.btnAtalhoNfe}
                onClick={preencherNfePendente}
                title="Preencher com 'A ser informado' (Atalho F2)"
              >
                <Zap size={14} /> A ser informado
              </button>
            </div>
          </div>

          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="motivo">
              Motivo do Envio <span className={styles.required}>*</span>
            </label>
            <select
              id="motivo"
              name="motivo"
              className={styles.select}
              value={formData.motivo}
              onChange={handleChange}
            >
              {MOTIVOS_COMUNS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bloco 3: Logística & Destino */}
        <div className={styles.sectionTitle}>
          <Truck size={14} /> Logística & Rastreamento
        </div>

        <div className={styles.grid}>
          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="destinatario">
              Destinatário / Operador Responsável <span className={styles.required}>*</span>
            </label>
            <input
              id="destinatario"
              name="destinatario"
              type="text"
              placeholder="Nome da Filial, Cliente ou Técnico"
              className={styles.input}
              value={formData.destinatario}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="tipoEnvio">
              Tipo de Envio
            </label>
            <select
              id="tipoEnvio"
              name="tipoEnvio"
              className={styles.select}
              value={formData.tipoEnvio}
              onChange={handleChange}
            >
              {TIPOS_ENVIO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="rastreio">
              Código de Rastreio
            </label>
            <input
              id="rastreio"
              name="rastreio"
              type="text"
              placeholder="Ex: QB123456789BR"
              className={styles.input}
              value={formData.rastreio}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col12}`}>
            <label className={styles.label} htmlFor="endereco">
              Endereço Completo de Destino
            </label>
            <input
              id="endereco"
              name="endereco"
              type="text"
              placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
              className={styles.input}
              value={formData.endereco}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col12}`}>
            <label className={styles.label} htmlFor="observacoes">
              Observações Técnicas da Bancada
            </label>
            <textarea
              id="observacoes"
              name="observacoes"
              placeholder="Informações adicionais sobre reparo, estado das peças ou orientações de despacho..."
              className={styles.textarea}
              value={formData.observacoes}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Bloco 4: Validação de Qualidade & Status */}
        <div className={styles.checkPanel}>
          <div className={styles.checkGroup}>
            <label className={`${styles.checkLabel} ${styles.checkLabelSuccess}`}>
              <input
                type="checkbox"
                name="testado"
                className={styles.checkboxInput}
                checked={formData.testado}
                onChange={handleChange}
              />
              <span>Testado na Bancada</span>
              <span className={styles.checkHelper}>(QA Funcional OK)</span>
            </label>

            <label className={`${styles.checkLabel} ${styles.checkLabelSuccess}`}>
              <input
                type="checkbox"
                name="doubleCheck"
                className={styles.checkboxInput}
                checked={formData.doubleCheck}
                onChange={handleChange}
              />
              <span>Double Check Realizado</span>
              <span className={styles.checkHelper}>(Conferência Física)</span>
            </label>
          </div>

          <div className={styles.checkGroup}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                name="enviado"
                className={styles.checkboxInput}
                checked={formData.enviado}
                onChange={handleChange}
              />
              <span style={{ color: formData.enviado ? "var(--vp-emerald-dark)" : "inherit" }}>
                Despachado / Concluído
              </span>
            </label>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className={styles.actionsBar}>
          <button
            type="button"
            onClick={handleReset}
            className={styles.btnSecondary}
            disabled={loading}
          >
            <RotateCcw size={16} /> Limpar
          </button>

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={loading}
          >
            <Save size={16} />
            <span>{loading ? "Gravando..." : initialData ? "Salvar Alterações" : "Salvar Registro"}</span>
            <span className={styles.keyboardHint}>(Enter)</span>
          </button>
        </div>
      </form>
    </div>
  );
}

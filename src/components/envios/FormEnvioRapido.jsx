import React, { useState, useEffect, useRef } from "react";
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
  Box
} from "lucide-react";
import { createEnvio, updateEnvio } from "../../services/envioService";
import {
  MOTIVOS,
  EQUIPAMENTOS_PADRAO,
  TIPOS_SERVICO_CORREIOS,
  formatarMacOuSerial
} from "../../constants/envioConfig";
import styles from "./FormEnvioRapido.module.css";

const INITIAL_ITEM = { qtd: 1, nome: EQUIPAMENTOS_PADRAO[0], isCustom: false, nomeCustom: "" };

const INITIAL_STATE = {
  data: new Date().toISOString().split("T")[0],
  itens: [INITIAL_ITEM],
  mac: "",
  chamado: "",
  linkChamado: "",
  nfe: "",
  motivo: "Suporte",
  // Destinatário no padrão oficial dos Correios
  destinatario: "",
  cep: "",
  logradouro: "",
  numero: "",
  semNumero: false,
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  cpfCnpj: "",
  celular: "",
  email: "",
  // Objeto Postagem Correios
  tipoEnvio: "SEDEX",
  centroCusto: "SUPORTE",
  pesoGramas: "500",
  dimensoes: "16x11x6",
  valorDeclarado: "",
  declararConteudo: true,
  // Validações da Bancada
  observacoes: "",
  testado: false,
  doubleCheck: false,
  enviado: false
};

export default function FormEnvioRapido({ initialData = null, onSuccess = null, onCancel = null }) {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
  const macInputRef = useRef(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...INITIAL_STATE,
        ...initialData,
        motivo: initialData.motivo || "Suporte",
        tipoEnvio: initialData.tipoEnvio || "SEDEX",
        itens: initialData.itens && initialData.itens.length > 0
          ? initialData.itens
          : [{ qtd: 1, nome: initialData.conteudo || EQUIPAMENTOS_PADRAO[0], isCustom: true, nomeCustom: initialData.conteudo || "" }]
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

  // Busca automática do CEP na API ViaCEP
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

  // Gerenciamento dinâmico dos Itens com botão "+"
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      itens: [...prev.itens, { qtd: 1, nome: EQUIPAMENTOS_PADRAO[0], isCustom: false, nomeCustom: "" }]
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
      novos[index] = { ...novos[index], [field]: value };
      return { ...prev, itens: novos };
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleMacChange = (e) => {
    setFormData((prev) => ({ ...prev, mac: formatarMacOuSerial(e.target.value) }));
  };

  const preencherNfePendente = () => {
    setFormData((prev) => ({ ...prev, nfe: "A ser informado" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.destinatario.trim()) {
      setStatusMessage({ type: "error", text: "Informe o Nome / Razão Social do destinatário." });
      return;
    }

    // Monta a descrição consolidada do conteúdo (ex: 1x Payblu... + 2x Kit Cabo...)
    const descricaoConteudo = formData.itens
      .map((it) => {
        const nomeFinal = it.isCustom ? (it.nomeCustom || "").trim() : it.nome;
        return `${it.qtd || 1}x ${nomeFinal}`;
      })
      .filter(Boolean)
      .join(" + ");

    if (!descricaoConteudo.trim()) {
      setStatusMessage({ type: "error", text: "Adicione ao menos um item válido ao pacote." });
      return;
    }

    // Monta endereço consolidado para relatórios e histórico
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
      conteudo: descricaoConteudo,
      endereco: enderecoConsolidado,
      rastreio: initialData?.rastreio || "", // Rastreio só é atribuído no despacho/conclusão!
      centroCusto: (formData.motivo || "SUPORTE").toUpperCase()
    };

    setLoading(true);
    setStatusMessage({ type: "", text: "" });

    try {
      if (initialData?.id) {
        await updateEnvio(initialData.id, payload);
        setStatusMessage({ type: "success", text: "Envio atualizado com sucesso!" });
      } else {
        await createEnvio(payload);
        setStatusMessage({ type: "success", text: "Pacote registrado e pronto para fila de postagem!" });
        setFormData({ ...INITIAL_STATE, data: formData.data });
        if (macInputRef.current) macInputRef.current.focus();
      }

      if (onSuccess) setTimeout(() => onSuccess(), 600);
    } catch (err) {
      console.error("Erro ao salvar envio:", err);
      setStatusMessage({ type: "error", text: "Erro ao salvar no banco de dados." });
    } finally {
      setLoading(false);
    }
  };

  const motivoSelecionado = MOTIVOS[formData.motivo];

  return (
    <div className={styles.container}>
      <div className={styles.formHeader}>
        <div className={styles.headerTitleWrapper}>
          <PackagePlus className={styles.headerIcon} />
          <div>
            <h2 className={styles.headerTitle}>
              {initialData ? "Editar Pacote de Envio" : "Registro de Pacote para Postagem (Bancada AT)"}
            </h2>
            <p className={styles.headerSubtitle}>
              Preparo rápido da caixa na bancada integrado com o layout oficial de postagem dos Correios
            </p>
          </div>
        </div>
        {initialData && onCancel && (
          <button type="button" onClick={onCancel} className={styles.btnSecondary}>
            <X size={16} /> Cancelar
          </button>
        )}
      </div>

      {statusMessage.text && (
        <div className={statusMessage.type === "success" ? styles.bannerSuccess : styles.bannerError}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
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
        {/* Bloco 1: Itens Enviados (Multi-itens dinâmico com +) */}
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitle}>
            <Cpu size={15} /> Conteúdo / Itens Enviados no Pacote
          </div>
          <button type="button" className={styles.btnAddItem} onClick={handleAddItem}>
            <Plus size={14} /> Adicionar Item (+)
          </button>
        </div>

        <div className={styles.itemsList}>
          {formData.itens.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
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
                  <label className={styles.subLabel}>Equipamento / Acessório #{idx + 1}</label>
                  <label className={styles.checkboxInline}>
                    <input
                      type="checkbox"
                      checked={item.isCustom}
                      onChange={(e) => handleItemChange(idx, "isCustom", e.target.checked)}
                    />
                    Outro / Não listado
                  </label>
                </div>

                {item.isCustom ? (
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Digite o nome customizado do item..."
                    value={item.nomeCustom}
                    onChange={(e) => handleItemChange(idx, "nomeCustom", e.target.value)}
                    required
                    autoFocus
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
                  title="Remover linha"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Bloco 2: Identificação Técnica, Fiscal & Chamado */}
        <div className={styles.sectionTitle} style={{ marginTop: "1rem" }}>
          <FileText size={15} /> Chamado & Controle Fiscal
        </div>

        <div className={styles.grid}>
          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="data">Data do Pacote *</label>
            <input
              id="data"
              type="date"
              name="data"
              className={styles.input}
              value={formData.data}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="mac">MAC / Número de Série</label>
            <input
              id="mac"
              ref={macInputRef}
              type="text"
              name="mac"
              placeholder="b0:cb:d8:5f:d1:c2"
              className={styles.input}
              value={formData.mac}
              onChange={handleMacChange}
              onBlur={handleMacChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="chamado">Chamado / Ticket</label>
            <input
              id="chamado"
              type="text"
              name="chamado"
              placeholder="#87911"
              className={styles.input}
              value={formData.chamado}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="motivo">Motivo do Envio *</label>
            <div className={styles.motivoSelectorWrapper}>
              <select
                id="motivo"
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
          </div>

          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="linkChamado">Link do Chamado (URL)</label>
            <input
              id="linkChamado"
              type="url"
              name="linkChamado"
              placeholder="https://vendpago.atlassian.net..."
              className={styles.input}
              value={formData.linkChamado}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col6}`}>
            <label className={styles.label} htmlFor="nfe">
              <span>Nota Fiscal (NF-e)</span>
              {formData.nfe.toLowerCase() === "a ser informado" && (
                <span className={styles.badgePendente}>Aguardando NF-e</span>
              )}
            </label>
            <div className={styles.nfeContainer}>
              <input
                id="nfe"
                type="text"
                name="nfe"
                placeholder="Número da NF-e"
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
        </div>

        {/* Bloco 3: Destinatário Padrão Oficial Correios */}
        <div className={styles.sectionTitle} style={{ marginTop: "1rem" }}>
          <MapPin size={15} /> Destinatário (Layout Oficial Correios)
        </div>

        <div className={styles.grid}>
          <div className={`${styles.fieldGroup} ${styles.col8}`}>
            <label className={styles.label} htmlFor="destinatario">Nome / Razão Social *</label>
            <input
              id="destinatario"
              type="text"
              name="destinatario"
              placeholder="Ex: Lavanderia Central Ltda"
              className={styles.input}
              value={formData.destinatario}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col4}`}>
            <label className={styles.label} htmlFor="cep">
              <span>CEP *</span>
              {loadingCep && <span style={{ fontSize: "0.7rem", color: "var(--vp-blue-primary)" }}>Buscando...</span>}
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="cep"
                type="text"
                name="cep"
                placeholder="00000-000"
                className={styles.input}
                value={formData.cep}
                onChange={handleCepChange}
                onBlur={() => buscarCep(formData.cep)}
              />
              <button
                type="button"
                className={styles.btnIconInput}
                onClick={() => buscarCep(formData.cep)}
                title="Recarregar CEP"
              >
                <Search size={14} />
              </button>
            </div>
          </div>

          <div className={`${styles.fieldGroup} ${styles.col7}`}>
            <label className={styles.label} htmlFor="logradouro">Endereço (Logradouro) *</label>
            <input
              id="logradouro"
              type="text"
              name="logradouro"
              placeholder="Rua / Av..."
              className={styles.input}
              value={formData.logradouro}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col2}`}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="numero">N.º *</label>
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
              id="numero"
              type="text"
              name="numero"
              disabled={formData.semNumero}
              className={styles.input}
              value={formData.semNumero ? "" : formData.numero}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="complemento">Complemento</label>
            <input
              id="complemento"
              type="text"
              name="complemento"
              placeholder="Sala, Bloco, Galpão"
              className={styles.input}
              value={formData.complemento}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col5}`}>
            <label className={styles.label} htmlFor="bairro">Bairro *</label>
            <input
              id="bairro"
              type="text"
              name="bairro"
              className={styles.input}
              value={formData.bairro}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col5}`}>
            <label className={styles.label} htmlFor="cidade">Cidade *</label>
            <input
              id="cidade"
              type="text"
              name="cidade"
              className={styles.input}
              value={formData.cidade}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col2}`}>
            <label className={styles.label} htmlFor="uf">UF *</label>
            <input
              id="uf"
              type="text"
              name="uf"
              maxLength="2"
              placeholder="PR"
              className={styles.input}
              value={formData.uf}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col4}`}>
            <label className={styles.label} htmlFor="cpfCnpj">CPF / CNPJ</label>
            <input
              id="cpfCnpj"
              type="text"
              name="cpfCnpj"
              placeholder="00.000.000/0000-00"
              className={styles.input}
              value={formData.cpfCnpj}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col4}`}>
            <label className={styles.label} htmlFor="celular">Celular</label>
            <input
              id="celular"
              type="text"
              name="celular"
              placeholder="(00) 00000-0000"
              className={styles.input}
              value={formData.celular}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col4}`}>
            <label className={styles.label} htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="contato@empresa.com"
              className={styles.input}
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Bloco 4: Objeto & Configurações da Postagem */}
        <div className={styles.sectionTitle} style={{ marginTop: "1rem" }}>
          <Box size={15} /> Objeto da Postagem (Pacote Correios)
        </div>

        <div className={styles.grid}>
          <div className={`${styles.fieldGroup} ${styles.col4}`}>
            <label className={styles.label} htmlFor="tipoEnvio">Serviço de Postagem</label>
            <select
              id="tipoEnvio"
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

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="centroCusto">C. Custos (Centro de Custo)</label>
            <input
              id="centroCusto"
              type="text"
              name="centroCusto"
              className={styles.input}
              value={(formData.motivo || "SUPORTE").toUpperCase()}
              readOnly
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col2}`}>
            <label className={styles.label} htmlFor="pesoGramas">Peso (g)</label>
            <input
              id="pesoGramas"
              type="text"
              name="pesoGramas"
              placeholder="500"
              className={styles.input}
              value={formData.pesoGramas}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col3}`}>
            <label className={styles.label} htmlFor="valorDeclarado">Valor Declarado (R$)</label>
            <input
              id="valorDeclarado"
              type="text"
              name="valorDeclarado"
              placeholder="Ex: 1500,00"
              className={styles.input}
              value={formData.valorDeclarado}
              onChange={handleChange}
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.col12}`}>
            <label className={styles.label} htmlFor="observacoes">Observações da Bancada</label>
            <textarea
              id="observacoes"
              name="observacoes"
              placeholder="Informações adicionais da assistência técnica..."
              className={styles.textarea}
              value={formData.observacoes}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Bloco 5: Checklist da Bancada */}
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
            </label>
          </div>
        </div>

        <div className={styles.actionsBar}>
          <button
            type="button"
            onClick={() => setFormData(INITIAL_STATE)}
            className={styles.btnSecondary}
            disabled={loading}
          >
            <RotateCcw size={16} /> Limpar
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            <Save size={16} />
            <span>{loading ? "Gravando..." : initialData ? "Salvar Alterações" : "Cadastrar na Fila de Postagem"}</span>
            <span className={styles.keyboardHint}>(Enter)</span>
          </button>
        </div>
      </form>
    </div>
  );
}

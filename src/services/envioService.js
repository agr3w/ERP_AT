import {
  collection,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebaseConfig";

const COLLECTION_NAME = "envios";
const LOCAL_STORAGE_KEY = "vendpago_erp_envios_v5";

/**
 * Calcula a diferença em dias entre a data de cadastro e a data atual para itens
 * aguardando NF-e.
 * Regra: se nfe === 'A ser informado', calcula a diferença entre data do cadastro e a data atual.
 *
 * @param {string|Date|Timestamp} dataCadastro - Data do envio (YYYY-MM-DD ou Date/Timestamp)
 * @param {string} nfe - Valor da NF-e
 * @returns {number} Dias aguardando NF-e (0 se não estiver aguardando)
 */
export function calcularDiasAguardandoNfe(dataCadastro, nfe) {
  const nfeNormalizado = String(nfe || "").trim().toLowerCase();
  const isAguardando =
    !nfeNormalizado ||
    nfeNormalizado === "a ser informado" ||
    nfeNormalizado === "a ser informada";

  if (!isAguardando) {
    return 0;
  }

  if (!dataCadastro) {
    return 0;
  }

  let dataOrigem;
  if (dataCadastro instanceof Timestamp) {
    dataOrigem = dataCadastro.toDate();
  } else if (typeof dataCadastro === "string") {
    // Trata formato dd/mm/yyyy, YYYY-MM-DD ou ISO
    if (dataCadastro.includes("T")) {
      dataOrigem = new Date(dataCadastro);
    } else if (dataCadastro.includes("/")) {
      const [dia, mes, ano] = dataCadastro.split("/").map(Number);
      dataOrigem = new Date(ano, mes - 1, dia);
    } else if (dataCadastro.includes("-")) {
      const parts = dataCadastro.split("-").map(Number);
      if (parts[0] > 1000) {
        dataOrigem = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        dataOrigem = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    } else {
      dataOrigem = new Date(dataCadastro);
    }
  } else if (dataCadastro instanceof Date) {
    dataOrigem = new Date(dataCadastro);
  } else {
    dataOrigem = new Date();
  }

  const hoje = new Date();
  // Zera horas para contar dias inteiros de calendário
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const origemZero = new Date(dataOrigem.getFullYear(), dataOrigem.getMonth(), dataOrigem.getDate());

  const diferencaMs = hojeZero.getTime() - origemZero.getTime();
  const dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

  return Math.max(0, dias);
}

/**
 * Normaliza e enriquece os dados de um envio com campos calculados
 */
function processarEnvioData(docId, rawData) {
  const dataEnvio = rawData.data || new Date().toISOString().split("T")[0];
  const nfeRaw = String(rawData.nfe || "").trim();
  const nfe = nfeRaw || "A ser informado";
  const diasAguardando = calcularDiasAguardandoNfe(dataEnvio, nfe);

  return {
    id: docId,
    ...rawData,
    data: dataEnvio,
    rastreio: rawData.rastreio || "",
    conteudo: rawData.conteudo || "",
    mac: rawData.mac || "",
    destinatario: rawData.destinatario || "",
    testado: Boolean(rawData.testado),
    nfe: nfe,
    chamado: rawData.chamado || "",
    linkChamado: rawData.linkChamado || "",
    tipoEnvio: rawData.tipoEnvio || "SEDEX",
    endereco: rawData.endereco || "",
    motivo: rawData.motivo || "Suporte",
    observacoes: rawData.observacoes || "",
    doubleCheck: Boolean(rawData.doubleCheck),
    enviado: Boolean(rawData.enviado),
    diasAguardandoNfe: diasAguardando,
    aguardandoMaisDe48h: diasAguardando >= 2,
    criadoEm: rawData.criadoEm || new Date().toISOString()
  };
}

// Limpeza proativa de qualquer resquício de dados mock/seed legados
if (typeof window !== "undefined" && window.localStorage) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const apenasReais = parsed.filter((item) => item && !String(item.id || "").startsWith("seed-"));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(apenasReais));
      }
    }
    ["vendpago_erp_envios_v1", "vendpago_erp_envios_v2", "vendpago_erp_envios_v3", "vendpago_erp_envios_v4"].forEach((k) => {
      localStorage.removeItem(k);
    });
  } catch {
    // Ignora em ambientes sem window
  }
}

// Funções de manipulação do fallback LocalStorage (ambiente limpo para produção)
function getLocalCache() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    const apenasReais = Array.isArray(parsed)
      ? parsed.filter((item) => item && !String(item.id || "").startsWith("seed-"))
      : [];
    if (Array.isArray(parsed) && apenasReais.length !== parsed.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(apenasReais));
    }
    return apenasReais;
  } catch (err) {
    console.error("Erro ao ler cache local:", err);
    return [];
  }
}

function saveLocalCache(list) {
  try {
    const apenasReais = Array.isArray(list)
      ? list.filter((item) => item && !String(item.id || "").startsWith("seed-"))
      : [];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(apenasReais));
  } catch (err) {
    console.error("Erro ao salvar cache local:", err);
  }
}

/**
 * Cria um novo registro de envio
 * @param {Object} envioData
 * @returns {Promise<Object>}
 */
export async function createEnvio(envioData) {
  const nfeFinal = String(envioData.nfe || "").trim() || "A ser informado";
  const diasAguardando = calcularDiasAguardandoNfe(envioData.data, nfeFinal);

  const payload = {
    ...envioData,
    nfe: nfeFinal,
    testado: Boolean(envioData.testado),
    doubleCheck: Boolean(envioData.doubleCheck),
    enviado: Boolean(envioData.enviado),
    diasAguardandoNfe: diasAguardando,
    aguardandoMaisDe48h: diasAguardando >= 2,
    criadoEm: new Date().toISOString()
  };

  // Tenta persistir no Firestore
  if (db) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...payload,
        criadoEmServer: serverTimestamp()
      });
      const createdItem = { id: docRef.id, ...payload };
      
      // Sincroniza cache local
      const current = getLocalCache();
      saveLocalCache([createdItem, ...current]);

      return createdItem;
    } catch (error) {
      console.warn("Firestore indisponível ou permissão pendente. Salvando em armazenamento local:", error);
    }
  }

  // Fallback LocalStorage
  const localId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const createdItem = { id: localId, ...payload };
  const current = getLocalCache();
  saveLocalCache([createdItem, ...current]);
  return createdItem;
}

/**
 * Atualiza um registro de envio existente
 * @param {string} id
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
export async function updateEnvio(id, updateData) {
  const dataEnvio = updateData.data || new Date().toISOString().split("T")[0];
  const nfeFinal = updateData.nfe !== undefined
    ? (String(updateData.nfe || "").trim() || "A ser informado")
    : undefined;
  const diasAguardando = calcularDiasAguardandoNfe(dataEnvio, nfeFinal !== undefined ? nfeFinal : updateData.nfe);

  const sanitizedUpdate = {
    ...updateData,
    ...(nfeFinal !== undefined ? { nfe: nfeFinal } : {}),
    diasAguardandoNfe: diasAguardando,
    aguardandoMaisDe48h: diasAguardando >= 2,
    atualizadoEm: new Date().toISOString()
  };

  if (db) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...sanitizedUpdate,
        atualizadoEmServer: serverTimestamp()
      });
    } catch (error) {
      console.warn("Firestore update falhou, atualizando cache local:", error);
    }
  }

  // Atualiza cache local
  const current = getLocalCache();
  const updatedList = current.map((item) =>
    item.id === id ? { ...item, ...sanitizedUpdate } : item
  );
  saveLocalCache(updatedList);

  const updatedItem = updatedList.find((i) => i.id === id) || { id, ...sanitizedUpdate };
  return updatedItem;
}

/**
 * Exclui um registro de envio
 * @param {string} id
 */
export async function deleteEnvio(id) {
  if (db) {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.warn("Firestore delete falhou, removendo do cache local:", error);
    }
  }
  const current = getLocalCache();
  saveLocalCache(current.filter((item) => item.id !== id));
  return true;
}

/**
 * Obtém todos os envios pendentes (enviado === false)
 * Recalcula dinamicamente os diasAguardandoNfe
 * @returns {Promise<Array>}
 */
export async function getEnviosPendentes() {
  let items = [];
  let consultouFirestore = false;

  if (db) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("enviado", "==", false)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        if (!String(d.id).startsWith("seed-")) {
          items.push(processarEnvioData(d.id, d.data()));
        }
      });
      consultouFirestore = true;
    } catch (error) {
      console.warn("Consulta Firestore pendentes falhou. Utilizando cache local:", error);
    }
  }

  // Se Firestore falhou (modo offline), usa o cache local
  if (!consultouFirestore) {
    const local = getLocalCache();
    items = local
      .filter((item) => !item.enviado && !String(item.id).startsWith("seed-"))
      .map((item) => processarEnvioData(item.id, item));
  }

  // Ordena por dias aguardando (maior gargalo primeiro) ou data
  return items.sort((a, b) => {
    if (b.diasAguardandoNfe !== a.diasAguardandoNfe) {
      return b.diasAguardandoNfe - a.diasAguardandoNfe;
    }
    return new Date(b.data || 0) - new Date(a.data || 0);
  });
}

/**
 * Obtém todos os envios concluídos (enviado === true)
 * @returns {Promise<Array>}
 */
export async function getEnviosConcluidos() {
  let items = [];
  let consultouFirestore = false;

  if (db) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("enviado", "==", true)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        if (!String(d.id).startsWith("seed-")) {
          items.push(processarEnvioData(d.id, d.data()));
        }
      });
      consultouFirestore = true;
    } catch (error) {
      console.warn("Consulta Firestore concluídos falhou. Utilizando cache local:", error);
    }
  }

  if (!consultouFirestore) {
    const local = getLocalCache();
    items = local
      .filter((item) => item.enviado && !String(item.id).startsWith("seed-"))
      .map((item) => processarEnvioData(item.id, item));
  }

  // Ordena por data decrescente (mais recentes primeiro)
  return items.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
}

/**
 * Obtém todos os registros cadastrados
 * @returns {Promise<Array>}
 */
export async function getAllEnvios() {
  let items = [];
  let consultouFirestore = false;

  if (db) {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      snapshot.forEach((d) => {
        if (!String(d.id).startsWith("seed-")) {
          items.push(processarEnvioData(d.id, d.data()));
        }
      });
      consultouFirestore = true;
    } catch (error) {
      console.warn("Consulta geral Firestore falhou. Utilizando cache local:", error);
    }
  }

  if (!consultouFirestore) {
    const local = getLocalCache();
    items = local
      .filter((item) => !String(item.id).startsWith("seed-"))
      .map((item) => processarEnvioData(item.id, item));
  }

  return items;
}

/**
 * Calcula métricas operacionais consolidadas para o Dashboard
 * - Total de envios no mês
 * - Cadência diária média
 * - Caixas travadas aguardando NF-e
 * - Caixas com atraso crítico (> 48h sem NF-e)
 * - Índice de Testados (%)
 * - Índice de Double Check (%)
 * - Motivos com maior volume de saídas
 * - Distribuição por modalidade de envio
 *
 * @returns {Promise<Object>}
 */
export async function getMetrics() {
  const todos = await getAllEnvios();
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  // Envios deste mês
  const enviosMes = todos.filter((item) => {
    if (!item.data) return false;
    let ano, mes;
    if (String(item.data).includes("/")) {
      const parts = item.data.split("/").map(Number);
      mes = parts[1];
      ano = parts[2];
    } else if (String(item.data).includes("-")) {
      const parts = item.data.split("-").map(Number);
      if (parts[0] > 1000) {
        ano = parts[0];
        mes = parts[1];
      } else {
        mes = parts[1];
        ano = parts[2];
      }
    }
    return ano === anoAtual && mes === mesAtual + 1;
  });

  const concluidosMes = enviosMes.filter((i) => i.enviado);
  const totalEnviosNoMes = concluidosMes.length;

  // Cadência diária média: total concluído no mês / dia do mês atual
  const diaDoMes = Math.max(1, agora.getDate());
  const cadenciaDiariaMedia = Number((totalEnviosNoMes / diaDoMes).toFixed(1));

  // Caixas travadas aguardando NF-e (pendentes com NF-e a ser informada)
  const pendentes = todos.filter((i) => !i.enviado);
  const travadasAguardandoNfe = pendentes.filter((i) => {
    const n = String(i.nfe || "").trim().toLowerCase();
    return n === "a ser informado" || n === "a ser informada" || n === "";
  });

  // Caixas com mais de 48h (dias >= 2) aguardando NF-e
  const aguardandoMais48h = travadasAguardandoNfe.filter(
    (i) => i.diasAguardandoNfe >= 2
  );

  // Índices de qualidade operacionais
  const totalRegistros = todos.length || 1;
  const totalTestados = todos.filter((i) => i.testado).length;
  const totalDoubleCheck = todos.filter((i) => i.doubleCheck).length;

  const indiceTestados = Math.round((totalTestados / totalRegistros) * 100);
  const indiceDoubleCheck = Math.round((totalDoubleCheck / totalRegistros) * 100);

  // Motivos com maior volume de saídas
  const motivosCount = {};
  todos.forEach((item) => {
    const motivo = (item.motivo || "Outro").trim();
    motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
  });

  const motivosRanking = Object.entries(motivosCount)
    .map(([motivo, count]) => ({
      motivo,
      quantidade: count,
      percentual: Math.round((count / totalRegistros) * 100)
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Distribuição por tipo de envio
  const tipoEnvioCount = {};
  todos.forEach((item) => {
    const tipo = (item.tipoEnvio || "SEDEX").trim();
    tipoEnvioCount[tipo] = (tipoEnvioCount[tipo] || 0) + 1;
  });

  const tipoEnvioRanking = Object.entries(tipoEnvioCount)
    .map(([tipo, count]) => ({
      tipo,
      quantidade: count,
      percentual: Math.round((count / totalRegistros) * 100)
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    totalGeral: todos.length,
    totalPendentes: pendentes.length,
    totalConcluidos: todos.filter((i) => i.enviado).length,
    totalEnviosNoMes,
    cadenciaDiariaMedia,
    caixasTravadasNfe: travadasAguardandoNfe.length,
    caixasAtraso48h: aguardandoMais48h.length,
    indiceTestados,
    indiceDoubleCheck,
    motivosRanking,
    tipoEnvioRanking,
    periodoReferencia: `${agora.toLocaleString("pt-BR", { month: "long" })} / ${anoAtual}`
  };
}

const COLLECTION_CONFIG = "configuracoes";
const DOC_ESTEIRA = "esteira_bancada";
const LOCAL_STORAGE_CONFIG_KEY = "vp_backlog_envios_prefs";

/**
 * Obtém a configuração global da esteira de envios (ordem e filtros) do Firestore
 * para que todos os operadores e deploys mantenham a mesma ordem.
 * @returns {Promise<Object>}
 */
export async function obterConfiguracaoEsteira() {
  if (db) {
    try {
      const docRef = doc(db, COLLECTION_CONFIG, DOC_ESTEIRA);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          sortConfig: data.sortConfig || { key: null, direction: null },
          ordemManualIds: Array.isArray(data.ordemManualIds) ? data.ordemManualIds : [],
          tipoFiltro: data.tipoFiltro || "TODOS",
          filtroEtapa: data.filtroEtapa || "TODAS"
        };
      }
    } catch (error) {
      console.warn("Consulta Firestore da esteira falhou. Usando preferências locais:", error);
    }
  }

  // Fallback cache local
  try {
    const salvo = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      return {
        sortConfig: parsed.sortConfig || { key: null, direction: null },
        ordemManualIds: Array.isArray(parsed.ordemManualIds) ? parsed.ordemManualIds : [],
        tipoFiltro: parsed.tipoFiltro || "TODOS",
        filtroEtapa: parsed.filtroEtapa || "TODAS"
      };
    }
  } catch {
    // Ignora
  }

  return {
    sortConfig: { key: null, direction: null },
    ordemManualIds: [],
    tipoFiltro: "TODOS",
    filtroEtapa: "TODAS"
  };
}

/**
 * Salva a configuração global da esteira de envios (ordem e filtros) no Firestore
 * @param {Object} config
 * @returns {Promise<boolean>}
 */
export async function salvarConfiguracaoEsteira(config) {
  const payload = {
    sortConfig: config.sortConfig || { key: null, direction: null },
    ordemManualIds: Array.isArray(config.ordemManualIds) ? config.ordemManualIds : [],
    tipoFiltro: config.tipoFiltro || "TODOS",
    filtroEtapa: config.filtroEtapa || "TODAS",
    atualizadoEm: new Date().toISOString()
  };

  // Atualiza cache local imediatamente
  try {
    const atual = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    const parsed = atual ? JSON.parse(atual) : {};
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify({ ...parsed, ...payload }));
  } catch {
    // Ignora
  }

  if (db) {
    try {
      const docRef = doc(db, COLLECTION_CONFIG, DOC_ESTEIRA);
      await setDoc(docRef, {
        ...payload,
        atualizadoEmServer: serverTimestamp()
      }, { merge: true });
      return true;
    } catch (error) {
      console.warn("Salvamento Firestore da esteira falhou:", error);
    }
  }

  return false;
}


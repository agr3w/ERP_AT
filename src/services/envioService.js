import {
  collection,
  addDoc,
  updateDoc,
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
const LOCAL_STORAGE_KEY = "vendpago_erp_envios_cache";

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
  if (!nfe) return 0;

  const nfeNormalizado = String(nfe).trim().toLowerCase();
  const isAguardando = nfeNormalizado === "a ser informado" || nfeNormalizado === "a ser informada";

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
    // Trata formato YYYY-MM-DD ou ISO
    if (dataCadastro.includes("T")) {
      dataOrigem = new Date(dataCadastro);
    } else {
      const [ano, mes, dia] = dataCadastro.split("-").map(Number);
      dataOrigem = new Date(ano, mes - 1, dia);
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
  const nfe = rawData.nfe || "";
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
    motivo: rawData.motivo || "Reparo Concluído",
    observacoes: rawData.observacoes || "",
    doubleCheck: Boolean(rawData.doubleCheck),
    enviado: Boolean(rawData.enviado),
    diasAguardandoNfe: diasAguardando,
    aguardandoMaisDe48h: diasAguardando >= 2,
    criadoEm: rawData.criadoEm || new Date().toISOString()
  };
}

// Dados iniciais para visualização imediata na bancada se o banco estiver vazio
const SEED_ENVIOS = [
  {
    id: "seed-1",
    data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 3 dias atrás (> 48h)
    rastreio: "",
    conteudo: "SmartPOS V2 + Fonte 9V",
    mac: "98:F4:AB:12:34:56",
    destinatario: "Filial SP - Central Logística",
    testado: true,
    nfe: "A ser informado",
    chamado: "#10842",
    linkChamado: "https://vendpago.atlassian.net/browse/AT-10842",
    tipoEnvio: "SEDEX",
    endereco: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
    motivo: "Troca em Garantia",
    observacoes: "Equipamento testado e aprovado. Aguardando emissão da NF fiscal pelo faturamento.",
    doubleCheck: true,
    enviado: false,
    criadoEm: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "seed-2",
    data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 1 dia atrás (< 48h)
    rastreio: "",
    conteudo: "Terminal MP35P",
    mac: "AA:11:BB:22:CC:33",
    destinatario: "Operação Curitiba",
    testado: true,
    nfe: "A ser informado",
    chamado: "#10855",
    linkChamado: "https://vendpago.atlassian.net/browse/AT-10855",
    tipoEnvio: "PAC",
    endereco: "Rua Marechal Deodoro, 450 - Centro, Curitiba - PR",
    motivo: "Reparo Concluído",
    observacoes: "Troca de display e bateria. Pacote pronto na bancada 3.",
    doubleCheck: false,
    enviado: false,
    criadoEm: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "seed-3",
    data: new Date().toISOString().split("T")[0], // Hoje
    rastreio: "QB987654321BR",
    conteudo: "Kit Cabos de Alimentação + Pinpad",
    mac: "70:85:C2:90:12:FF",
    destinatario: "Tech Solutions Campinas",
    testado: true,
    nfe: "NF-009481",
    chamado: "#10860",
    linkChamado: "https://vendpago.atlassian.net/browse/AT-10860",
    tipoEnvio: "SEDEX",
    endereco: "Rua Barão de Jaguara, 789 - Centro, Campinas - SP",
    motivo: "Envio de Peças",
    observacoes: "Despacho prioritário para cliente VIP.",
    doubleCheck: true,
    enviado: true,
    criadoEm: new Date().toISOString()
  },
  {
    id: "seed-4",
    data: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 4 dias atrás (> 48h)
    rastreio: "",
    conteudo: "Placa Mãe POS Android",
    mac: "E4:5F:01:88:99:AA",
    destinatario: "Bancada Terceirizada BH",
    testado: true,
    nfe: "A ser informado",
    chamado: "#10820",
    linkChamado: "https://vendpago.atlassian.net/browse/AT-10820",
    tipoEnvio: "Transportadora",
    endereco: "Av. Afonso Pena, 1500 - Savassi, Belo Horizonte - MG",
    motivo: "Devolução",
    observacoes: "Cobrar urgência do time fiscal referente à NF de remessa.",
    doubleCheck: true,
    enviado: false,
    criadoEm: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "seed-5",
    data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    rastreio: "BR849201948",
    conteudo: "POS D210 + Carregador",
    mac: "C8:2A:14:55:66:77",
    destinatario: "Retirada em Mãos - Técnico Carlos",
    testado: true,
    nfe: "NF-009450",
    chamado: "#10833",
    linkChamado: "https://vendpago.atlassian.net/browse/AT-10833",
    tipoEnvio: "Retirada",
    endereco: "Balcão Assistência Técnica VendPago - Sede",
    motivo: "Reparo Concluído",
    observacoes: "Retirado no balcão da assistência.",
    doubleCheck: true,
    enviado: true,
    criadoEm: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Funções de manipulação do fallback LocalStorage
function getLocalCache() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_ENVIOS));
      return SEED_ENVIOS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Erro ao ler cache local:", err);
    return SEED_ENVIOS;
  }
}

function saveLocalCache(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
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
  const diasAguardando = calcularDiasAguardandoNfe(envioData.data, envioData.nfe);

  const payload = {
    ...envioData,
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
  const diasAguardando = calcularDiasAguardandoNfe(dataEnvio, updateData.nfe);

  const sanitizedUpdate = {
    ...updateData,
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

  if (db) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("enviado", "==", false)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        items.push(processarEnvioData(d.id, d.data()));
      });
    } catch (error) {
      console.warn("Consulta Firestore pendentes falhou. Utilizando cache local:", error);
    }
  }

  if (items.length === 0) {
    const local = getLocalCache();
    items = local
      .filter((item) => !item.enviado)
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

  if (db) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("enviado", "==", true)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        items.push(processarEnvioData(d.id, d.data()));
      });
    } catch (error) {
      console.warn("Consulta Firestore concluídos falhou. Utilizando cache local:", error);
    }
  }

  if (items.length === 0) {
    const local = getLocalCache();
    items = local
      .filter((item) => item.enviado)
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

  if (db) {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      snapshot.forEach((d) => {
        items.push(processarEnvioData(d.id, d.data()));
      });
    } catch (error) {
      console.warn("Consulta geral Firestore falhou. Utilizando cache local:", error);
    }
  }

  if (items.length === 0) {
    const local = getLocalCache();
    items = local.map((item) => processarEnvioData(item.id, item));
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
    const [ano, mes] = item.data.split("-").map(Number);
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

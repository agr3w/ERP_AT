// src/services/envioAnalytics.js
import { MOTIVOS } from "../constants/envioConfig";

/**
 * Converte qualquer formato de data do envio para um objeto Date seguro
 */
export const parseDataEnvio = (dataVal, fallbackIso) => {
  if (dataVal) {
    if (typeof dataVal === "string") {
      const limpo = dataVal.trim();
      if (limpo.includes("/")) {
        const [d, m, y] = limpo.split("/").map(Number);
        if (d && m && y) return new Date(y, m - 1, d);
      }
      if (limpo.includes("-")) {
        const parts = limpo.split("-").map(Number);
        if (parts[0] > 1000) return new Date(parts[0], parts[1] - 1, parts[2]);
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    const parsed = new Date(dataVal);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (fallbackIso) {
    const parsed = new Date(fallbackIso);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

/**
 * Calcula o tempo de espera (dias de esteira entre o cadastro e a expedição)
 */
export const calcularLeadTimeDias = (item) => {
  const dataCriacao = parseDataEnvio(item.data, item.criadoEm);
  dataCriacao.setHours(0, 0, 0, 0);

  let dataFinal;
  if (item.enviado) {
    dataFinal = item.dataEnvioEfetivo ? new Date(item.dataEnvioEfetivo) : (item.atualizadoEm ? new Date(item.atualizadoEm) : new Date());
  } else {
    dataFinal = new Date();
  }
  dataFinal.setHours(0, 0, 0, 0);

  const diffMs = dataFinal.getTime() - dataCriacao.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, dias);
};

/**
 * Processa todos os dados de envios e monta os datasets completos para os gráficos do Chart.js
 * @param {Array} envios - Lista bruta de envios obtida do Firestore/serviço
 * @param {string} filtroTempo - '7dias' | 'mes' | 'ano' | 'geral'
 */
export function processarAnalyticsEnvios(envios = [], filtroTempo = "mes") {
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth(); // 0 a 11

  // 1. Filtragem pelo período selecionado
  const enviosFiltrados = envios.filter((item) => {
    const dataItem = parseDataEnvio(item.data, item.criadoEm);
    if (filtroTempo === "7dias") {
      const seteDiasAtras = new Date(agora);
      seteDiasAtras.setDate(agora.getDate() - 7);
      seteDiasAtras.setHours(0, 0, 0, 0);
      return dataItem >= seteDiasAtras;
    }
    if (filtroTempo === "mes") {
      return dataItem.getFullYear() === anoAtual && dataItem.getMonth() === mesAtual;
    }
    if (filtroTempo === "ano") {
      return dataItem.getFullYear() === anoAtual;
    }
    return true; // 'geral'
  });

  // 2. Métricas Gerais de Alto Nível (KPIs do Gestor)
  const totalPacotes = enviosFiltrados.length;
  const concluidos = enviosFiltrados.filter((i) => i.enviado);
  const pendentes = enviosFiltrados.filter((i) => !i.enviado);

  let totalEquipamentosUnidades = 0;
  enviosFiltrados.forEach((item) => {
    if (Array.isArray(item.itens) && item.itens.length > 0) {
      item.itens.forEach((it) => {
        totalEquipamentosUnidades += Number(it.qtd) || 1;
      });
    } else {
      totalEquipamentosUnidades += 1;
    }
  });

  // Lead Time Médio (dias)
  const leadTimes = concluidos.map(calcularLeadTimeDias);
  const mediaLeadTimeDias = leadTimes.length > 0
    ? Number((leadTimes.reduce((acc, c) => acc + c, 0) / leadTimes.length).toFixed(1))
    : 0;

  // 3. Top Equipamentos Mais Enviados (Ranking de Peças & Terminais)
  const equipamentosMap = {};
  enviosFiltrados.forEach((item) => {
    if (Array.isArray(item.itens) && item.itens.length > 0) {
      item.itens.forEach((it) => {
        const nomeLimpo = it.isCustom ? (it.nomeCustom || "Item Personalizado").trim() : (it.nome || "Terminal Payblu").trim();
        const qtd = Number(it.qtd) || 1;
        equipamentosMap[nomeLimpo] = (equipamentosMap[nomeLimpo] || 0) + qtd;
      });
    } else if (item.conteudo) {
      const nome = item.conteudo.trim();
      equipamentosMap[nome] = (equipamentosMap[nome] || 0) + 1;
    }
  });

  const equipamentosRanking = Object.entries(equipamentosMap)
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 7); // Top 7 mais frequentes

  const chartTopEquipamentos = {
    labels: equipamentosRanking.map((e) => e.nome.length > 25 ? e.nome.substring(0, 25) + "..." : e.nome),
    datasets: [
      {
        label: "Unidades Despachadas",
        data: equipamentosRanking.map((e) => e.qtd),
        backgroundColor: [
          "#001e40",
          "#0056b5",
          "#3a5f94",
          "#059669",
          "#0284c7",
          "#475569",
          "#64748b"
        ],
        borderRadius: 4,
        borderSkipped: false
      }
    ]
  };

  // 4. Evolução Temporal (Volume por Dia / Semana / Mês / Ano)
  let labelsTempo = [];
  let dataRegistrados = [];
  let dataDespachados = [];

  if (filtroTempo === "7dias") {
    // Últimos 7 dias cronológicos
    for (let i = 6; i >= 0; i--) {
      const d = new Date(agora);
      d.setDate(agora.getDate() - i);
      const diaStr = String(d.getDate()).padStart(2, "0");
      const mesStr = String(d.getMonth() + 1).padStart(2, "0");
      const label = `${diaStr}/${mesStr}`;
      labelsTempo.push(label);

      const dZero = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const doDia = envios.filter((it) => {
        const dt = parseDataEnvio(it.data, it.criadoEm);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime() === dZero;
      });

      dataRegistrados.push(doDia.length);
      dataDespachados.push(doDia.filter((it) => it.enviado).length);
    }
  } else if (filtroTempo === "mes") {
    // Dias do mês atual (do dia 1 até o último dia do mês ou hoje)
    const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    for (let dia = 1; dia <= ultimoDiaMes; dia++) {
      labelsTempo.push(`${String(dia).padStart(2, "0")}`);
      const doDia = enviosFiltrados.filter((it) => {
        const dt = parseDataEnvio(it.data, it.criadoEm);
        return dt.getDate() === dia;
      });
      dataRegistrados.push(doDia.length);
      dataDespachados.push(doDia.filter((it) => it.enviado).length);
    }
  } else if (filtroTempo === "ano") {
    // 12 meses do ano
    const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    labelsTempo = nomesMeses;
    for (let m = 0; m < 12; m++) {
      const doMes = enviosFiltrados.filter((it) => {
        const dt = parseDataEnvio(it.data, it.criadoEm);
        return dt.getMonth() === m;
      });
      dataRegistrados.push(doMes.length);
      dataDespachados.push(doMes.filter((it) => it.enviado).length);
    }
  } else {
    // 'geral': Agrupamento por mês dos últimos registros
    const mesesPassados = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const aNum = d.getFullYear();
      const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      labelsTempo.push(`${nomesMeses[mIdx]}/${String(aNum).slice(2)}`);

      const doPeriodo = envios.filter((it) => {
        const dt = parseDataEnvio(it.data, it.criadoEm);
        return dt.getFullYear() === aNum && dt.getMonth() === mIdx;
      });
      dataRegistrados.push(doPeriodo.length);
      dataDespachados.push(doPeriodo.filter((it) => it.enviado).length);
    }
  }

  const chartEvolucaoTemporal = {
    labels: labelsTempo,
    datasets: [
      {
        label: "Registrados na Bancada",
        data: dataRegistrados,
        borderColor: "#0056b5",
        backgroundColor: "rgba(0, 86, 181, 0.08)",
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        label: "Despachados / Concluídos",
        data: dataDespachados,
        borderColor: "#059669",
        backgroundColor: "rgba(5, 150, 105, 0.08)",
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  // 5. Motivos de Envio (Doughnut Chart)
  const motivosCount = {
    Locação: 0,
    Comercial: 0,
    Suporte: 0,
    Manutenção: 0
  };

  enviosFiltrados.forEach((it) => {
    const m = (it.motivo || "Suporte").trim();
    if (motivosCount[m] !== undefined) {
      motivosCount[m]++;
    } else {
      motivosCount.Suporte++;
    }
  });

  const chartMotivos = {
    labels: ["Locação", "Comercial", "Suporte", "Manutenção"],
    datasets: [
      {
        data: [
          motivosCount.Locação,
          motivosCount.Comercial,
          motivosCount.Suporte,
          motivosCount.Manutenção
        ],
        backgroundColor: [
          MOTIVOS.Locação?.color || "#1d4ed8",
          MOTIVOS.Comercial?.color || "#15803d",
          MOTIVOS.Suporte?.color || "#b45309",
          MOTIVOS.Manutenção?.color || "#b91c1c"
        ],
        borderWidth: 2,
        borderColor: "#ffffff"
      }
    ]
  };

  // 6. Tempo de Espera / Lead Time por Faixa (Bar Chart)
  const faixasEspera = {
    "Mesmo Dia (0d)": 0,
    "1 Dia (24h)": 0,
    "2 a 3 Dias": 0,
    "Mais de 3 Dias (>72h)": 0
  };

  enviosFiltrados.forEach((it) => {
    const dias = calcularLeadTimeDias(it);
    if (dias === 0) faixasEspera["Mesmo Dia (0d)"]++;
    else if (dias === 1) faixasEspera["1 Dia (24h)"]++;
    else if (dias <= 3) faixasEspera["2 a 3 Dias"]++;
    else faixasEspera["Mais de 3 Dias (>72h)"]++;
  });

  const chartTempoEspera = {
    labels: Object.keys(faixasEspera),
    datasets: [
      {
        label: "Pacotes",
        data: Object.values(faixasEspera),
        backgroundColor: [
          "#059669", // Verde (Rápido)
          "#3a5f94", // Azul (Normal)
          "#d97706", // Âmbar (Atenção)
          "#ba1a1a"  // Vermelho (Crítico / Gargalo)
        ],
        borderRadius: 4
      }
    ]
  };

  // 7. Modalidades de Frete / Canais de Envio
  const modalidadeMap = {};
  enviosFiltrados.forEach((it) => {
    const t = (it.tipoEnvio || "SEDEX").trim();
    modalidadeMap[t] = (modalidadeMap[t] || 0) + 1;
  });

  const chartModalidades = {
    labels: Object.keys(modalidadeMap),
    datasets: [
      {
        label: "Envios",
        data: Object.values(modalidadeMap),
        backgroundColor: [
          "#0056b5",
          "#001e40",
          "#059669",
          "#b45309",
          "#475569",
          "#64748b"
        ],
        borderRadius: 4
      }
    ]
  };

  return {
    totalPacotes,
    totalConcluidos: concluidos.length,
    totalPendentes: pendentes.length,
    totalEquipamentosUnidades,
    mediaLeadTimeDias,
    equipamentoTop: equipamentosRanking[0] ? `${equipamentosRanking[0].nome} (${equipamentosRanking[0].qtd} un)` : "Nenhum",
    taxaEnvioNoDia: totalPacotes > 0 ? Math.round((faixasEspera["Mesmo Dia (0d)"] / totalPacotes) * 100) : 0,
    gargaloCritico: faixasEspera["Mais de 3 Dias (>72h)"],
    chartEvolucaoTemporal,
    chartTopEquipamentos,
    chartMotivos,
    chartTempoEspera,
    chartModalidades
  };
}

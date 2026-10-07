// src/constants/envioConfig.js

export const MOTIVOS = {
  Locação: { id: 'Locação', label: 'Locação', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  Comercial: { id: 'Comercial', label: 'Comercial', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  Suporte: { id: 'Suporte', label: 'Suporte', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  Manutenção: { id: 'Manutenção', label: 'Manutenção', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' }
};

export const EQUIPAMENTOS_PADRAO = [
  'Terminal Payblu E1223 - 3.3.9 - MDB',
  'Terminal Payblu E1223 - 4.1.1 - MDB',
  'Terminal Payblu E1223 - 2.1.2 - Pulso',
  'Terminal Payblu E1223 - 2.1.2 - Pulso IL',
  'Terminal PayBlu Cypress - 2.0.12 - MDB',
  'Terminal PayBlu Cypress - 2.0.9 - MDB',
  'Terminal VendTEF com cartão SD',
  'Kit Cabo MDB-Y',
  'Kit Cabo SpeedQueen IL',
  'Kit Cabo Moedeiro 10 vias',
  'Kit Cabo Moedeiro 16 vias',
  'Kit Cabo BL700 / P70',
  'Kit Cabo M5',
  'Fonte Auxiliar SpeedQueen',
  'Moderninha PagBank'
];

export const TIPOS_SERVICO_CORREIOS = [
  'SEDEX',
  'PAC',
  'Retirada na VendPago',
  'Transportadora',
  'Motoboy',
  'Logística Reversa'
];

export const CEP_ORIGEM_VENDPAGO = '81270-230';

/**
 * Converte qualquer formato de data (YYYY-MM-DD, ISO, Timestamp, Date) para o padrão brasileiro dd/mm/yyyy
 */
export const formatarDataBR = (dataVal) => {
  if (!dataVal) return '-';
  if (typeof dataVal === 'string') {
    const limpo = dataVal.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpo)) return limpo;
    const isoMatch = limpo.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${dd}/${mm}/${yyyy}`;
    }
    const brHyphenMatch = limpo.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (brHyphenMatch) {
      const [, dd, mm, yyyy] = brHyphenMatch;
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  try {
    const d = new Date(dataVal);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch {
    // fallback
  }
  return String(dataVal);
};

/**
 * Converte data em dd/mm/yyyy ou ISO para YYYY-MM-DD (compatível com input HTML type="date")
 */
export const dataParaInputDate = (dataVal) => {
  if (!dataVal) return new Date().toISOString().split('T')[0];
  if (typeof dataVal === 'string') {
    const limpo = dataVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
    const brMatch = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      const [, dd, mm, yyyy] = brMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  try {
    const d = new Date(dataVal);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch {
    // fallback
  }
  return new Date().toISOString().split('T')[0];
};

/**
 * Abre diretamente a tela oficial de cálculo de preços e prazos dos Correios
 * com os dados já preenchidos (origem VendPago, destino cliente, dimensões e peso)
 */
export const abrirCalculoOficialCorreios = ({
  cepDestino = '',
  cep = '',
  endereco = '',
  tipoEnvio = 'SEDEX',
  pesoGramas = '500',
  altura = '7',
  largura = '13',
  comprimento = '16'
} = {}) => {
  if (typeof document === 'undefined') return;

  let rawCep = cepDestino || cep || '';
  if (!rawCep && endereco) {
    const match = String(endereco).match(/\b\d{5}-?\d{3}\b/);
    if (match) rawCep = match[0];
  }

  const cepLimpo = String(rawCep || '').replace(/\D/g, '');
  if (!cepLimpo || cepLimpo.length < 8) {
    alert('Informe um CEP de destino válido antes de calcular o frete.');
    return;
  }

  const isPac = String(tipoEnvio).toUpperCase().includes('PAC');
  const servicoCod = isPac ? '04510' : '04014';

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const dataHoje = `${dd}/${mm}/${yyyy}`;

  const pesoNumKg = (Number(pesoGramas) || 300) / 1000;
  let pesoVal = '0.3';
  if (pesoNumKg <= 0.3) pesoVal = '0.3';
  else if (pesoNumKg <= 1) pesoVal = '1';
  else if (pesoNumKg <= 2) pesoVal = '2';
  else pesoVal = String(Math.min(30, Math.ceil(pesoNumKg)));

  const baseFields = {
    data: dataHoje,
    dataAtual: dataHoje,
    cepOrigem: CEP_ORIGEM_VENDPAGO,
    cepDestino: cepLimpo,
    servico: servicoCod,
    compararServico: 'S',
    Selecao: '',
    Formato: '1',
    embalagem1: 'outraEmbalagem1',
    Altura: String(altura || '7'),
    Largura: String(largura || '13'),
    Comprimento: String(comprimento || '16'),
    Diametro: '',
    peso: pesoVal,
    Selecao31: '', proCod_in_31: '', nomeEmbalagemCaixa: '', TipoEmbalagem31: '',
    Selecao32: '', proCod_in_32: '', TipoEmbalagem32: '',
    Selecao33: '', proCod_in_33: '', TipoEmbalagem33: '',
    Selecao34: '', proCod_in_34: '', TipoEmbalagem34: '',
    Selecao1: '', proCod_in_1: '', Selecao2: '', proCod_in_2: '',
    Selecao3: '', proCod_in_3: '', Selecao4: '', proCod_in_4: '',
    Selecao5: '', proCod_in_5: '', Selecao6: '', proCod_in_6: '',
    Selecao7: '', proCod_in_7: '', Selecao14: '', proCod_in_14: '',
    Selecao15: '', proCod_in_15: '', Selecao16: '', proCod_in_16: '',
    Selecao17: '', proCod_in_17: '', Selecao18: '', proCod_in_18: '',
    Selecao19: '', proCod_in_19: '', Selecao20: '', proCod_in_20: '',
    Selecao8: '', proCod_in_8: '', nomeEmbalagemEnvelope: '', TipoEmbalagem8: '',
    Selecao9: '', proCod_in_9: '', Selecao10: '', proCod_in_10: '',
    Selecao11: '', proCod_in_11: '', Selecao12: '', proCod_in_12: '', TipoEmbalagem12: '',
    Selecao13: '', proCod_in_13: '', Selecao21: '', proCod_in_21: '',
    Selecao22: '', proCod_in_22: '', TipoEmbalagem22: '',
    Selecao23: '', proCod_in_23: '', Selecao24: '', proCod_in_24: '',
    Selecao25: '', proCod_in_25: '', Selecao26: '', proCod_in_26: '',
    Selecao27: '', proCod_in_27: '', Selecao28: '', proCod_in_28: '',
    Selecao29: '', proCod_in_29: '', Selecao30: '', proCod_in_30: '',
    MaoPropria: '', avisoRecebimento: '', ckValorDeclarado: '', valorDeclarado: '',
    Calcular: 'Calcular'
  };

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://www2.correios.com.br/sistemas/precosPrazos/prazos.cfm';
  form.target = '_blank';
  form.style.display = 'none';

  Object.entries(baseFields).forEach(([key, val]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = val;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => {
    if (document.body.contains(form)) {
      document.body.removeChild(form);
    }
  }, 1500);
};

/**
 * Determina se o equipamento é um terminal ou equipamento que obriga coleta de MAC / Serial
 */
export const equipamentoRequerMac = (nome) => {
  if (!nome) return false;
  const n = String(nome).toLowerCase().trim();
  return (
    n.includes('terminal') ||
    n.includes('payblu') ||
    n.includes('cypress') ||
    n.includes('pos') ||
    n.includes('vendtef') ||
    n.includes('moderninha') ||
    n.includes('leitor')
  );
};

/**
 * Extrai automaticamente o número do deal/chamado a partir de URLs do Bitrix24
 * Ex: https://vendpago.bitrix24.com.br/crm/deal/details/155909/ -> "155909"
 * Se for digitado apenas o número "155909", monta o link padrão automaticamente.
 */
export const extrairDadosChamadoBitrix = (valor) => {
  if (!valor) return { chamado: "", linkChamado: "" };
  const str = String(valor).trim();

  // 1. Detecta URL do Bitrix com /details/NUMERO/ ou /deal/NUMERO/
  const matchUrl = str.match(/details\/(\d+)/i) || str.match(/deal\/(\d+)/i);
  if (matchUrl) {
    const id = matchUrl[1];
    return {
      chamado: id,
      linkChamado: str.startsWith("http") ? str : `https://${str}`
    };
  }

  // 2. Se colou apenas os dígitos (ex: "155909" ou "#155909")
  const apenasNumeros = str.replace(/\D/g, "");
  if (apenasNumeros.length >= 4) {
    return {
      chamado: apenasNumeros,
      linkChamado: `https://vendpago.bitrix24.com.br/crm/deal/details/${apenasNumeros}/`
    };
  }

  return {
    chamado: str,
    linkChamado: str.startsWith("http") ? str : ""
  };
};

export const formatarMacOuSerial = (valor) => {
  if (!valor) return '';
  const limpo = valor.trim();
  const hexPuro = limpo.replace(/[^a-fA-F0-9]/g, '');
  if (hexPuro.length === 12) {
    return hexPuro.match(/.{1,2}/g).join(':').toLowerCase();
  }
  return valor;
};

/**
 * Utilitário de sanitização para respeitar estritamente os tipos do Correios
 */
const sanitize = (val, maxLen = null, numericOnly = false) => {
  if (!val) return '';
  let str = String(val).trim().replace(/;/g, ' '); // Semicolon quebra CSV
  if (numericOnly) {
    str = str.replace(/\D/g, '');
  }
  if (maxLen && str.length > maxLen) {
    str = str.substring(0, maxLen).trim();
  }
  return str;
};

/**
 * Exportador CSV 100% aderente ao layout VENDPAGO_AT da AGF
 */
export const exportarParaCsvCorreios = (envios = []) => {
  if (!envios.length) return;

  // Cabeçalho compatível com Linhas de Cabeçalho = 1
  const cabecalho = [
    'Nome',
    'Endereco',
    'Numero',
    'Complemento',
    'Bairro',
    'Cidade',
    'UF',
    'CEP',
    'Servico',
    'Peso_g',
    'Nota_Fiscal',
    'Valor_Decl',
    'Descricao_Conteudo',
    'Quantidade'
  ];

  const linhas = envios.map((item) => {
    // 1. Destino C(55)
    const nome = sanitize(item.destinatario, 55);

    // 2. Endereço C(55)
    const endereco = sanitize(item.logradouro || item.endereco, 55);

    // 3. Número N(6)
    const numero = item.semNumero ? '0' : sanitize(item.numero, 6, true) || '0';

    // 4. Complemento C(55)
    const complemento = sanitize(item.complemento, 55);

    // 5. Bairro C(55)
    const bairro = sanitize(item.bairro, 55);

    // 6. Cidade C(40)
    const cidade = sanitize(item.cidade, 40);

    // 7. UF C(2)
    const uf = sanitize(item.uf, 2).toUpperCase();

    // 8. CEP N(8) - Somente os 8 números, sem hífen
    const cep = sanitize(item.cep, 8, true);

    // 9. Serviço C(15) - Ex: SEDEX ou PAC
    const servico = sanitize(item.tipoEnvio || 'SEDEX', 15);

    // 10. Peso N(5.0) - Inteiro em gramas
    const peso = sanitize(item.pesoGramas || '500', 5, true) || '500';

    // 11. Nota Fiscal C(15)
    const nfeVal = item.nfe && item.nfe.toLowerCase() !== 'a ser informado'
      ? item.nfe
      : (item.chamado || '');
    const nfe = sanitize(nfeVal, 15);

    // 12. Valor Declarado N(9.2) - Duas casas decimais
    const valorDeclRaw = String(item.valorDeclarado || '1500.00').replace(',', '.').replace(/[^\d.]/g, '');
    const valorDecl = Number(valorDeclRaw || 0).toFixed(2);

    // 13. Descrição do Conteúdo C(40) - Trava rígida de 40 caracteres
    // Prioriza montar resumo curto e informativo para caber nos 40 chars
    let descCurta = '';
    if (Array.isArray(item.itens) && item.itens.length > 0) {
      descCurta = item.itens
        .map((it) => {
          const nomeFinal = it.isCustom ? (it.nomeCustom || '').trim() : it.nome;
          // Abrevia termos longos para otimizar os 40 caracteres
          const abreviado = nomeFinal
            .replace(/Terminal /i, '')
            .replace(/Kit /i, '')
            .replace(/Fonte Auxiliar /i, 'Fonte ');
          return `${it.qtd || 1}x ${abreviado}`;
        })
        .filter(Boolean)
        .join(' + ');
    } else {
      descCurta = item.conteudo || '';
    }
    const descricao = sanitize(descCurta, 40);

    // 14. Quantidade N(6)
    const totalQtd = Array.isArray(item.itens) && item.itens.length > 0
      ? item.itens.reduce((acc, cur) => acc + (Number(cur.qtd) || 1), 0)
      : 1;

    return [
      `"${nome}"`,
      `"${endereco}"`,
      `"${numero}"`,
      `"${complemento}"`,
      `"${bairro}"`,
      `"${cidade}"`,
      `"${uf}"`,
      `"${cep}"`,
      `"${servico}"`,
      `"${peso}"`,
      `"${nfe}"`,
      `"${valorDecl}"`,
      `"${descricao}"`,
      `"${totalQtd}"`
    ].join(';');
  });

  // Codificação com BOM UTF-8 (\uFEFF) para preservar acentuação no Windows
  const csvCompleto = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\r\n');
  const blob = new Blob([csvCompleto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `LOTE_CORREIOS_VENDPAGO_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Gera mensagem padronizada para cobrança de frete a ser colada diretamente na tarefa do Bitrix
 */
export const gerarTextoCobrancaBitrix = (item) => {
  if (!item) return '';
  const numChamado = item.chamado ? `#${item.chamado}` : 'Não informado';
  const dest = item.destinatario || 'Cliente';
  const mod = item.tipoEnvio || 'SEDEX';
  const frete = item.valorFrete ? `R$ ${item.valorFrete}` : 'A calcular / Pendente';
  
  let rawCep = item.cep || '';
  if (!rawCep && item.endereco) {
    const match = String(item.endereco).match(/\b\d{5}-?\d{3}\b/);
    if (match) rawCep = match[0];
  }
  const cepDest = rawCep || 'Não informado';
  const itensDesc = item.conteudo || (Array.isArray(item.itens) ? item.itens.map(i => `${i.qtd}x ${i.nome}`).join(' + ') : 'Equipamentos AT');

  return [
    `📦 COTAÇÃO DE FRETE - ASSISTÊNCIA TÉCNICA`,
    `• Data do Envio: ${formatarDataBR(item.data)}`,
    `• Chamado / Ticket: ${numChamado}`,
    `• Destinatário: ${dest}`,
    `• Modalidade: ${mod}`,
    `• Valor do Frete: ${frete}`,
    `• CEP Destino: ${cepDest}`,
    `• Origem: VendPago Curitiba/PR (${CEP_ORIGEM_VENDPAGO})`,
    `• Itens: ${itensDesc}`,
    ...(item.linkChamado ? [`• Link do Chamado: ${item.linkChamado}`] : [])
  ].join('\n');
};


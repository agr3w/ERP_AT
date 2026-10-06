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

export const formatarMacOuSerial = (valor) => {
  if (!valor) return '';
  const limpo = valor.trim();
  const hexPuro = limpo.replace(/[^a-fA-F0-9]/g, '');
  if (hexPuro.length === 12 && !limpo.includes(':') && !limpo.includes('-')) {
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

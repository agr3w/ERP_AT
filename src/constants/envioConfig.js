// src/constants/envioConfig.js

export const MOTIVOS = {
  Locação: {
    id: 'Locação',
    label: 'Locação',
    color: '#1d4ed8',       // Azul vibrante
    bg: '#dbeafe',          // Azul suave
    border: '#93c5fd'
  },
  Comercial: {
    id: 'Comercial',
    label: 'Comercial',
    color: '#15803d',       // Verde floresta
    bg: '#dcfce7',          // Verde suave
    border: '#86efac'
  },
  Suporte: {
    id: 'Suporte',
    label: 'Suporte',
    color: '#b45309',       // Âmbar / Laranja
    bg: '#fef3c7',          // Âmbar suave
    border: '#fcd34d'
  },
  Manutenção: {
    id: 'Manutenção',
    label: 'Manutenção',
    color: '#b91c1c',       // Vermelho alerta
    bg: '#fee2e2',          // Vermelho suave
    border: '#fca5a5'
  }
};

// Equipamentos reais da Assistência Técnica VendPago
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

/**
 * Converte 12 hexadecimais puros em MAC formatado (xx:xx:xx:xx:xx:xx)
 */
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
 * Gera arquivo CSV compatível com o layout de Importação do sistema Correios
 * Colunas: Descrição;Nome;Registro;API (PPN);Nota Fiscal;CEP;UF;Endereço (Logradouro);n.o;S/N;Bairro;Adic;Vlr Decl;C Custos
 */
export const exportarParaCsvCorreios = (envios = []) => {
  if (!envios || !envios.length) return;

  const colunas = [
    'Descrição',
    'Nome',
    'Registro',
    'API (PPN)',
    'Nota Fiscal',
    'CEP',
    'UF',
    'Endereço (Logradouro)',
    'n.o',
    'S/N',
    'Bairro',
    'Adic',
    'Vlr Decl',
    'C Custos'
  ];

  const linhas = envios.map((item) => {
    // Monta a descrição com base nos itens detalhados ou no conteúdo geral
    let desc = '';
    if (item.itens && Array.isArray(item.itens) && item.itens.length > 0) {
      desc = item.itens
        .map((it) => {
          const nomeFinal = it.isCustom ? (it.nomeCustom || '').trim() : it.nome;
          return `${it.qtd || 1}x ${nomeFinal}`;
        })
        .filter(Boolean)
        .join(' + ');
    } else {
      desc = item.conteudo || '';
    }
    desc = desc.replace(/;/g, ' - ');

    const nome = (item.destinatario || item.nomeDestinatario || '').replace(/;/g, ' ');
    const nfe = item.nfe && item.nfe.toLowerCase() !== 'a ser informado' ? item.nfe : (item.chamado || '');
    const cep = (item.cep || '').replace(/\D/g, '');
    const uf = (item.uf || '').toUpperCase();
    const logradouro = (item.logradouro || item.endereco || '').replace(/;/g, ' ');
    const num = item.semNumero ? '' : (item.numero || 'S/N');
    const sn = item.semNumero ? 'S' : 'N';
    const bairro = (item.bairro || '').replace(/;/g, ' ');
    const cCustos = (item.centroCusto || item.motivo || 'SUPORTE').toUpperCase();
    const vlrDecl = item.valorDeclarado || '';

    return [
      `"${desc}"`,
      `"${nome}"`,
      `""`,
      `""`,
      `"${nfe}"`,
      `"${cep}"`,
      `"${uf}"`,
      `"${logradouro}"`,
      `"${num}"`,
      `"${sn}"`,
      `"${bairro}"`,
      `""`,
      `"${vlrDecl}"`,
      `"${cCustos}"`
    ].join(';');
  });

  const conteudoCsv = '\uFEFF' + [colunas.join(';'), ...linhas].join('\r\n');
  const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `LOTE_CORREIOS_VENDPAGO_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

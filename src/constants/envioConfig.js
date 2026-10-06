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

export const EQUIPAMENTOS_PADRAO = [
  'Roteador Wi-Fi 6 AX3000',
  'ONU GPON Bridge',
  'ONU GPON Wi-Fi',
  'Switch Gigabit 8 Portas',
  'Switch Gigabit 24 Portas',
  'Rádio PTP / PTMP 5GHz',
  'Fonte PoE 24V / 48V',
  'Patch Cord Cat6',
  'Conversor de Mídia'
];

/**
 * Converte strings hexadecimais de 12 dígitos (ex: b0cbd85fd1c2)
 * automaticamente para o formato MAC padrão (b0:cb:d8:5f:d1:c2).
 */
export const formatarMacOuSerial = (valor) => {
  if (!valor) return '';
  const limpo = valor.trim();
  const hexPuro = limpo.replace(/[^a-fA-F0-9]/g, '');

  // Detecta se é exatamente um MAC cru sem formatação
  if (hexPuro.length === 12 && !limpo.includes(':') && !limpo.includes('-')) {
    return hexPuro.match(/.{1,2}/g).join(':').toLowerCase();
  }

  return valor;
};

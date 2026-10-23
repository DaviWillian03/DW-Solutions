import type { Random } from './random.js';

// Catálogo FICTÍCIO de aparelhos simulados (nomes comerciais reais, dados inventados).
export const MODELS = [
  { manufacturer: 'samsung', model: 'Galaxy A15', weight: 18, android: [13, 14, 15] },
  { manufacturer: 'samsung', model: 'Galaxy A25', weight: 22, android: [14, 15] },
  { manufacturer: 'samsung', model: 'Galaxy A35', weight: 12, android: [14, 15] },
  { manufacturer: 'samsung', model: 'Galaxy Tab Active5', weight: 6, android: [14, 15] },
  { manufacturer: 'samsung', model: 'Galaxy A14', weight: 4, android: [12, 13] },
  { manufacturer: 'motorola', model: 'moto g34', weight: 14, android: [13, 14] },
  { manufacturer: 'motorola', model: 'moto g54', weight: 14, android: [13, 14, 15] },
  { manufacturer: 'motorola', model: 'moto g84', weight: 6, android: [14, 15] },
  { manufacturer: 'motorola', model: 'moto e22', weight: 4, android: [12] },
] as const;

export type Manufacturer = (typeof MODELS)[number]['manufacturer'];

/** Patch de segurança plausível para a versão (versões antigas tendem a patches mais velhos). */
export function securityPatchFor(rnd: Random, android: number, now: Date): string {
  const monthsBack = { 12: [6, 14], 13: [3, 9], 14: [1, 5], 15: [0, 2] }[android] ?? [1, 6];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - rnd.int(monthsBack[0]!, monthsBack[1]!));
  return d.toISOString().slice(0, 10);
}

export function serialFor(rnd: Random, manufacturer: Manufacturer): string {
  const alnum = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const tail = Array.from({ length: 7 }, () => rnd.pick([...alnum])).join('');
  return `SIM-${manufacturer === 'samsung' ? 'R5C' : 'ZY2'}${tail}`;
}

export const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Larissa',
  'Marcos',
  'Natália',
  'Otávio',
  'Paula',
  'Rafael',
  'Sabrina',
  'Thiago',
  'Vanessa',
  'Wagner',
  'Yasmin',
  'Caio',
  'Débora',
  'Eduardo',
  'Fernanda',
  'Gustavo',
  'Helena',
  'Igor',
  'Juliana',
  'Leonardo',
];
export const LAST_NAMES = [
  'Almeida',
  'Barbosa',
  'Cardoso',
  'Duarte',
  'Esteves',
  'Ferraz',
  'Gomes',
  'Holanda',
  'Inácio',
  'Jardim',
  'Lacerda',
  'Moraes',
  'Nogueira',
  'Oliveira',
  'Pacheco',
  'Queiroz',
  'Ribeiro',
  'Siqueira',
  'Teixeira',
  'Vasconcelos',
];

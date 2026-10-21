import type { ComponentType } from 'react';
import type { CertificateTemplate } from '../../types';
import type { TemplateProps } from './shared';
import { ClassicoTemplate } from './templates/Classico';
import { OndasAzuisTemplate } from './templates/OndasAzuis';
import { VioletaTemplate } from './templates/Violeta';
import { DouradoTemplate } from './templates/Dourado';
import { MinimalistaTemplate } from './templates/Minimalista';

export interface TemplateInfo {
  id: CertificateTemplate;
  nome: string;
  descricao: string;
  Component: ComponentType<TemplateProps>;
}

/** Modelos disponíveis, pela ordem em que aparecem na escolha. */
export const CERTIFICATE_TEMPLATES: TemplateInfo[] = [
  { id: 'classico', nome: 'Clássico', descricao: 'Moldura dupla azul-marinho, sóbrio e formal.', Component: ClassicoTemplate },
  { id: 'ondas_azuis', nome: 'Ondas Azuis', descricao: 'Fundo azul-claro, ondas, medalha e nome em caligrafia.', Component: OndasAzuisTemplate },
  { id: 'violeta', nome: 'Violeta Moderno', descricao: 'Ondas em degradê violeta, com marca da instituição.', Component: VioletaTemplate },
  { id: 'dourado', nome: 'Dourado Elegante', descricao: 'Fundo creme, molduras e selo dourados.', Component: DouradoTemplate },
  { id: 'minimalista', nome: 'Minimalista', descricao: 'Faixa lateral verde com código e dados de emissão.', Component: MinimalistaTemplate },
];

export function templateById(id: string | undefined): TemplateInfo {
  return CERTIFICATE_TEMPLATES.find((t) => t.id === id) ?? CERTIFICATE_TEMPLATES[0];
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/courses/Modal';
import { CourseTypeBadge } from '../../components/courses/CourseTypeBadge';
import { ErrorState, LoadingState } from '../../components/courses/States';
import { CertificateDocument } from '../../components/certificates/CertificateDocument';
import { certificateService } from '../../services/certificates';
import { Eye, FilePlus2, MessageCircle } from 'lucide-react';
import { EmitDialog } from '../../components/certificates/EmitDialog';
import { fmtDate } from '../../lib/certificates';
import { studentLink, whatsappMessage, whatsappNumber, whatsappUrl } from '../../lib/whatsapp';
import type { Certificate } from '../../types';

/** O certificado só é válido depois de o formando pagar a taxa. */
type CertSituation = 'pago' | 'por_pagar' | 'anulado';
/** «correcao»: o formando pediu uma correcção dos dados, ainda por resolver. */
type StateFilter = 'todos' | CertSituation | 'correcao';

function situationOf(c: Pick<Certificate, 'estado' | 'pago_em'>): CertSituation {
  if (c.estado === 'anulado') return 'anulado';
  return c.pago_em ? 'pago' : 'por_pagar';
}

const SITUATION_STYLE: Record<CertSituation, { label: string; className: string }> = {
  pago: { label: 'Pago', className: 'bg-accent-100 text-accent-700' },
  por_pagar: { label: 'Por pagar', className: 'bg-amber-100 text-amber-800' },
  anulado: { label: 'Anulado', className: 'bg-red-100 text-red-700' },
};

function StateBadge({ cert }: { cert: Pick<Certificate, 'estado' | 'pago_em'> }) {
  const { label, className } = SITUATION_STYLE[situationOf(cert)];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

function CorrectionBadge() {
  return (
    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
      Correcção pedida
    </span>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-MZ');
}

/** Nota nos técnico-profissionais; carga horária nos de participação. */
function resultado(c: Certificate): string {
  return c.tipo === 'tecnico_profissional' ? `${c.nota} valores` : `${c.carga_horaria}h`;
}

const filterClass =
  'w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-soft';

export function UserCertificates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const courseFilter = searchParams.get('curso') ?? '';
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [stateFilter, setStateFilter] = useState<StateFilter>('todos');
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [viewing, setViewing] = useState<Certificate | null>(null);
  const [emitOpen, setEmitOpen] = useState(false);
  const [annulling, setAnnulling] = useState<Certificate | null>(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Carrega todos: o filtro por curso é local, para a lista de cursos estar sempre completa.
      setCerts(await certificateService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar certificados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const courses = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of certs) byId.set(c.curso_id, c.curso_nome);
    return [...byId]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  }, [certs]);

  /** O curso fica no URL (?curso=), para o link vindo da página do curso continuar a funcionar. */
  function setCourseFilter(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('curso', id);
    else next.delete('curso');
    setSearchParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter(
      (c) =>
        (!courseFilter || c.curso_id === courseFilter) &&
        (stateFilter === 'todos' ||
          (stateFilter === 'correcao' ? Boolean(c.correcao) : situationOf(c) === stateFilter)) &&
        (!q ||
          c.codigo.toLowerCase().includes(q) ||
          c.formando_nome.toLowerCase().includes(q) ||
          c.curso_nome.toLowerCase().includes(q)),
    );
  }, [certs, search, stateFilter, courseFilter]);

  async function handleAnnul() {
    if (!annulling || saving) return;
    if (motivo.trim().length < 3) {
      toast.error('Indique o motivo da anulação (mín. 3 caracteres).');
      return;
    }
    setSaving(true);
    try {
      const updated = await certificateService.annul(annulling.id, motivo.trim());
      // Anular fecha o pedido de correcção; o contacto não vem na resposta.
      setCerts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated, correcao: null } : c)));
      toast.success(`Certificado ${updated.codigo} anulado. A nota/matrícula do formando fica de novo editável.`);
      setAnnulling(null);
      setMotivo('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao anular o certificado.');
    } finally {
      setSaving(false);
    }
  }

  /** O formando pediu uma correcção, mas os dados estão certos: fecha o pedido (o formando pode pagar). */
  async function handleResolveCorrection(c: Certificate) {
    if (resolving) return;
    setResolving(true);
    try {
      await certificateService.resolveCorrection(c.id);
      const update = (x: Certificate) => (x.id === c.id ? { ...x, correcao: null } : x);
      setCerts((prev) => prev.map(update));
      setSelected((prev) => (prev ? update(prev) : prev));
      toast.success('Pedido de correcção fechado. Contacte o formando a explicar que os dados estão correctos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao fechar o pedido de correcção.');
    } finally {
      setResolving(false);
    }
  }

  const filtersActive = Boolean(search.trim() || courseFilter || stateFilter !== 'todos');

  /** Abre o WhatsApp de quem envia (a instituição) com a mensagem pronta e regista o envio. */
  async function sendWhatsapp(c: Certificate, numero: string) {
    window.open(whatsappUrl(numero, whatsappMessage(c)), '_blank', 'noopener');
    try {
      const em = await certificateService.markWhatsappSent(c.id);
      const update = (x: Certificate) => (x.id === c.id ? { ...x, whatsapp_enviado_em: em } : x);
      setCerts((prev) => prev.map(update));
      setSelected((prev) => (prev ? update(prev) : prev));
    } catch {
      // O envio em si já aconteceu no WhatsApp; falhar o registo não deve bloquear.
    }
  }

  async function copyMessage(c: Certificate) {
    try {
      await navigator.clipboard.writeText(whatsappMessage(c));
      toast.success('Mensagem com o link copiada.');
    } catch {
      toast.error(`Não foi possível copiar. Link: ${studentLink(c.acesso_token)}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">Certificados</h1>
          <p className="mt-1 text-sm text-slate-500">
            Emita os certificados dos cursos terminados, consulte-os, envie o link aos formandos e anule quando for preciso.
          </p>
        </div>
        <Button onClick={() => setEmitOpen(true)} className="w-full sm:w-auto">
          <FilePlus2 size={16} /> Emitir certificados
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_16rem_12rem]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por código ou formando"
          aria-label="Pesquisar certificados"
          className={`${filterClass} placeholder:text-muted sm:col-span-2 lg:col-span-1`}
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          aria-label="Filtrar por curso"
          className={filterClass}
        >
          <option value="">Todos os cursos</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          aria-label="Filtrar por estado"
          className={filterClass}
        >
          <option value="todos">Todos os estados</option>
          <option value="por_pagar">Por pagar</option>
          <option value="pago">Pagos</option>
          <option value="anulado">Anulados</option>
          <option value="correcao">Correcção pedida</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="A carregar certificados..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={certs.length === 0 ? 'Ainda sem certificados' : 'Sem resultados'}
            description={
              certs.length === 0
                ? 'Use «Emitir certificados» para emitir, de uma vez, os de todos os formandos elegíveis de um curso terminado.'
                : 'Nenhum certificado corresponde aos filtros.'
            }
            action={
              certs.length === 0 ? (
                <Button onClick={() => setEmitOpen(true)}>
                  <FilePlus2 size={16} /> Emitir certificados
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-soft/50 text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Formando</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Curso</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Código</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Nota / carga</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Emitido em</th>
                  <th className="px-4 py-3 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    onClick={() => setSelected(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(c);
                      }
                    }}
                    aria-label={`Ver detalhes do certificado ${c.codigo}`}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-soft/40 focus:bg-soft/40 focus:outline-none"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{c.formando_nome}</p>
                      {/* Em ecrãs pequenos o curso aparece por baixo do nome. */}
                      <p className="mt-0.5 text-xs text-muted md:hidden">{c.curso_nome}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{c.curso_nome}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 lg:table-cell">{c.codigo}</td>
                    <td className="hidden px-4 py-3 tabular-nums text-slate-600 sm:table-cell">{resultado(c)}</td>
                    <td className="hidden px-4 py-3 tabular-nums text-slate-600 sm:table-cell">
                      {fmtDateTime(c.emitido_em)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <StateBadge cert={c} />
                        {c.correcao && <CorrectionBadge />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            {filtered.length} {filtered.length === 1 ? 'certificado' : 'certificados'}
            {filtersActive && ` de ${certs.length}`}
          </p>
        </div>
      )}

      <Modal open={selected !== null} title="Detalhes do certificado" onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-base font-semibold text-ink">{selected.formando_nome}</p>
                <p className="mt-0.5 break-words text-sm text-muted">{selected.curso_nome}</p>
              </div>
              <StateBadge cert={selected} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Código</dt>
                <dd className="mt-0.5 font-mono font-semibold text-ink">{selected.codigo}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Tipo</dt>
                <dd className="mt-0.5">
                  <CourseTypeBadge tipo={selected.tipo} />
                </dd>
              </div>
              {selected.tipo === 'tecnico_profissional' && (
                <div>
                  <dt className="text-xs text-muted">Nota</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-ink">{selected.nota} valores</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted">Carga horária</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">{selected.carga_horaria}h</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Período</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {fmtDate(selected.data_abertura)} a {fmtDate(selected.data_encerramento)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Emitido em</dt>
                <dd className="mt-0.5 font-semibold text-ink">{fmtDateTime(selected.emitido_em)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Taxa do formando</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {selected.taxa_valor} MT ·{' '}
                  {selected.pago_em
                    ? `pago em ${fmtDateTime(selected.pago_em)}${selected.pago_herdado_de ? ' (no certificado anterior)' : ''}`
                    : 'por pagar'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Link enviado por WhatsApp</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {selected.whatsapp_enviado_em ? fmtDateTime(selected.whatsapp_enviado_em) : 'Ainda não'}
                </dd>
              </div>
            </dl>
            {selected.correcao && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  Correcção pedida pelo formando em {fmtDateTime(selected.correcao.criado_em)}
                </p>
                <blockquote className="mt-1.5 border-l-2 border-amber-300 pl-3 text-sm italic text-amber-900/80">
                  {selected.correcao.mensagem}
                </blockquote>
                <p className="mt-2 text-xs text-amber-900">
                  Para corrigir: anule este certificado, corrija os dados e emita-o de novo. Envie depois o link novo ao
                  formando{selected.pago_em ? '; o pagamento passa para o certificado novo' : ''}. Enquanto o pedido estiver
                  aberto, o formando não pode pagar.
                </p>
                <button
                  type="button"
                  onClick={() => void handleResolveCorrection(selected)}
                  disabled={resolving}
                  className="mt-2 text-sm font-semibold text-amber-900 hover:underline disabled:opacity-60"
                >
                  Os dados estão correctos: fechar o pedido
                </button>
              </div>
            )}
            {selected.estado === 'emitido' && !selected.pago_em && (
              <SendPanel
                cert={selected}
                onWhatsapp={(numero) => void sendWhatsapp(selected, numero)}
                onCopy={() => void copyMessage(selected)}
              />
            )}
            {selected.estado === 'anulado' && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                Anulado em {selected.anulado_em ? fmtDateTime(selected.anulado_em) : '-'}: {selected.motivo_anulacao}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {selected.estado === 'emitido' && (
                <button
                  onClick={() => {
                    setAnnulling(selected);
                    setSelected(null);
                  }}
                  className="inline-flex items-center justify-center rounded-button border border-line px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Anular
                </button>
              )}
              <button
                onClick={() => {
                  setViewing(selected);
                  setSelected(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-button bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-950"
              >
                <Eye size={16} /> Ver certificado
              </button>
            </div>
          </div>
        )}
      </Modal>

      <EmitDialog open={emitOpen} onClose={() => setEmitOpen(false)} onEmitted={() => void load()} />

      <Modal
        open={viewing !== null}
        title="Certificado"
        size="xl"
        onClose={() => {
          setSelected(viewing);
          setViewing(null);
        }}
      >
        {viewing && <CertificateViewer cert={viewing} />}
      </Modal>

      <Modal open={annulling !== null} title="Anular certificado" onClose={() => (saving ? null : setAnnulling(null))}>
        {annulling && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">
              Anular o certificado <strong className="font-mono text-brand-950">{annulling.codigo}</strong> de{' '}
              <strong className="text-brand-950">{annulling.formando_nome}</strong>? A verificação pública passa a indicar
              «anulado». O registo não é apagado e pode emitir um novo certificado depois de corrigir os dados.
              {annulling.pago_em && ' O formando já pagou: o pagamento passa para o certificado que emitir a seguir.'}
            </p>
            <div className="space-y-1.5">
              <label htmlFor="motivo" className="block text-sm font-medium text-brand-950">
                Motivo <span className="text-red-600">*</span>
              </label>
              <textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: Nota lançada incorrectamente"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAnnulling(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleAnnul} loading={saving}>
                Anular certificado
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Envio do link ao formando pelo WhatsApp da instituição (sem API: abre o WhatsApp com a mensagem pronta). */
function SendPanel({
  cert,
  onWhatsapp,
  onCopy,
}: {
  cert: Certificate;
  onWhatsapp: (numero: string) => void;
  onCopy: () => void;
}) {
  const numero = whatsappNumber(cert.formando_contacto);
  return (
    <div className="rounded-lg border border-line bg-soft/40 p-3">
      <p className="text-sm font-semibold text-ink">Enviar o link ao formando</p>
      <p className="mt-0.5 text-xs text-muted">
        {numero
          ? `Abre o WhatsApp com a mensagem pronta para ${cert.formando_contacto}. Só tem de carregar em enviar.`
          : 'O formando não tem um contacto moçambicano válido. Copie a mensagem e envie-a por outro meio, ou corrija o contacto em Dados.'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {numero && (
          <button
            type="button"
            onClick={() => onWhatsapp(numero)}
            className="inline-flex items-center justify-center gap-2 rounded-button bg-[#1FA855] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#178C46]"
          >
            <MessageCircle size={16} /> {cert.whatsapp_enviado_em ? 'Reenviar por WhatsApp' : 'Enviar por WhatsApp'}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center justify-center rounded-button border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-soft"
        >
          Copiar mensagem
        </button>
      </div>
    </div>
  );
}

/**
 * Visualização do certificado pela instituição, sem opção de imprimir ou guardar:
 * só o formando o obtém, depois de pagar.
 */
function CertificateViewer({ cert }: { cert: Certificate }) {
  return (
    <div className="space-y-3">
      <style>{'@media print { .cert-frame { display: none !important; } }'}</style>
      <div onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        <CertificateDocument cert={cert} className="rounded-lg border border-line" />
      </div>
      <p className="text-xs text-muted">
        {cert.pago_em
          ? 'Só para consulta. O formando imprime ou guarda o certificado a partir do link que recebeu.'
          : 'Só para consulta. O certificado fica disponível ao formando depois de pagar a taxa.'}
      </p>
    </div>
  );
}

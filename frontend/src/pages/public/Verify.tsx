import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleAlert, CircleCheck, CircleX, Search, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { certificateService } from '../../services/certificates';
import { fmtDate } from '../../lib/certificates';
import { COURSE_TYPE_LABELS, type PublicVerification } from '../../types';

type Result = { kind: 'ok'; cert: PublicVerification } | { kind: 'not_found'; message: string } | null;

export function VerifyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCode = searchParams.get('codigo') ?? '';
  const [code, setCode] = useState(queryCode);
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);

  // O código no URL (?codigo=) é a fonte: permite partilhar o link de verificação.
  useEffect(() => {
    setCode(queryCode);
    if (!queryCode) {
      setResult(null);
      return;
    }
    let active = true;
    setLoading(true);
    certificateService
      .verify(queryCode)
      .then((cert) => active && setResult({ kind: 'ok', cert }))
      .catch((e) => active && setResult({ kind: 'not_found', message: e instanceof Error ? e.message : 'Certificado não encontrado.' }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [queryCode]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 animate-fade-up">
      <div className="text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-900 text-white">
          <ShieldCheck size={24} />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-brand-950">Verificar certificado</h1>
        <p className="mt-2 text-slate-600">Introduza o código único do certificado para consultar a sua autenticidade.</p>
      </div>

      <Card className="mt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c) setSearchParams({ codigo: c });
          }}
          className="space-y-4"
        >
          <Input
            label="Código do certificado"
            placeholder="Ex.: CERT-AB23CD45"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            <Search size={16} /> Consultar
          </Button>
        </form>

        {result?.kind === 'not_found' && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <p>{result.message}</p>
          </div>
        )}

        {result?.kind === 'ok' && <VerificationResult cert={result.cert} />}
      </Card>
    </div>
  );
}

function VerificationResult({ cert }: { cert: PublicVerification }) {
  if (!cert.pago) {
    // Sem pagamento não se mostram os dados do formando: só que o código existe.
    const anulado = cert.estado === 'anulado';
    return (
      <div className={`mt-6 rounded-xl border p-4 ${anulado ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`} role="status">
        <p className={`flex items-center gap-2 font-bold ${anulado ? 'text-red-700' : 'text-amber-800'}`}>
          {anulado ? <CircleX size={18} /> : <CircleAlert size={18} />}
          {anulado ? 'Certificado anulado' : 'Certificado pendente de pagamento'}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          {anulado
            ? 'Este certificado foi anulado pela instituição e não é válido.'
            : 'O certificado foi emitido mas ainda não é válido: o formando tem de pagar a taxa através do link que recebeu.'}
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Curso" value={cert.curso_nome} />
          <Field label="Emitido por" value={cert.emissor_nome} />
        </dl>
      </div>
    );
  }
  const valido = cert.estado === 'emitido';
  return (
    <div className={`mt-6 rounded-xl border p-4 ${valido ? 'border-accent-500/40 bg-accent-50' : 'border-red-200 bg-red-50'}`} role="status">
      <p className={`flex items-center gap-2 font-bold ${valido ? 'text-accent-700' : 'text-red-700'}`}>
        {valido ? <CircleCheck size={18} /> : <CircleX size={18} />}
        {valido
          ? 'Certificado válido'
          : `Certificado anulado${cert.anulado_em ? ` em ${new Date(cert.anulado_em).toLocaleDateString('pt-MZ')}` : ''}`}
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <Field label="Formando" value={cert.formando_nome} />
        <Field label="Curso" value={cert.curso_nome} />
        <Field label="Tipo" value={COURSE_TYPE_LABELS[cert.tipo]} />
        <Field label="Carga horária" value={`${cert.carga_horaria} horas`} />
        {cert.tipo === 'tecnico_profissional' && <Field label="Classificação" value={`${cert.nota} valores`} />}
        <Field label="Período" value={`${fmtDate(cert.data_abertura)} a ${fmtDate(cert.data_encerramento)}`} />
        <Field label="Emitido por" value={cert.emissor_nome} />
        <Field label="Emitido em" value={new Date(cert.emitido_em).toLocaleDateString('pt-MZ')} />
      </dl>
      <Link to={`/certificado/${cert.codigo}`} className="mt-4 inline-block text-sm font-semibold text-brand-900 hover:underline">
        Ver certificado
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-brand-950">{value}</dd>
    </div>
  );
}

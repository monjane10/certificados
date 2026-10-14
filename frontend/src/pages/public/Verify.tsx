import { useState } from 'react';
import { Info, Search, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function VerifyPage() {
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);

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
            setSubmitted(true);
          }}
          className="space-y-4"
        >
          <Input
            label="Código do certificado"
            placeholder="Ex.: ML-ABC123"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setSubmitted(false);
            }}
            required
          />
          <Button type="submit" className="w-full">
            <Search size={16} /> Consultar
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>
              {submitted
                ? 'A funcionalidade de validação será disponibilizada numa fase posterior. O código que introduziu não foi verificado - guarde-o para utilização futura.'
                : 'A funcionalidade de validação será disponibilizada numa fase posterior. Nesta sprint apresentamos apenas a interface.'}
            </span>
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Área reservada para apresentar o resultado da verificação.
        </div>
      </Card>
    </div>
  );
}

/** «Diploma.mz» com o «.mz» destacado (a cor muda conforme o fundo). */
export function BrandName({ className = '', suffixClass = 'text-emerald-600' }: { className?: string; suffixClass?: string }) {
  return (
    <span className={className}>
      Diploma<span className={suffixClass}>.mz</span>
    </span>
  );
}

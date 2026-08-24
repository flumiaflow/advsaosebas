export function formatCNPJ(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 14);
  if (raw.length > 12) return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
  if (raw.length > 8) return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
  if (raw.length > 5) return raw.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
  if (raw.length > 2) return raw.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
  return raw;
}

export function formatCPF(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  if (raw.length > 9) return raw.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
  if (raw.length > 6) return raw.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
  if (raw.length > 3) return raw.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
  return raw;
}

export function formatDocument(value: string): string {
  const raw = value.replace(/\D/g, '');
  return raw.length <= 11 ? formatCPF(value) : formatCNPJ(value);
}

export function maskCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
}

export function isDocCpf(doc: string): boolean {
  return (doc || '').replace(/\D/g, '').length === 11;
}

export function getDisplayName(est: any, clientName?: string): string {
  return est?.alias || est?.razaoSocial || clientName || 'Empresa Monitorada';
}

import { useState } from 'react';
import { STOCK } from '../lib/format';
import { Modal } from '../components/ui';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy-800 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StockBadge({ status, qty }) {
  const s = STOCK[status] || STOCK.in_stock;
  return (
    <span className={s.cls}>
      {s.label}
      {qty !== undefined && <span className="ml-1 opacity-70">({qty})</span>}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'navy', hint, onClick }) {
  const tones = {
    navy: 'bg-navy-50 text-navy-800',
    maroon: 'bg-maroon-50 text-maroon-700',
    gold: 'bg-gold-100 text-gold-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={`card flex items-center gap-4 p-4 text-left ${onClick ? 'transition hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-navy-900">{value}</p>
        {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
      </div>
    </Comp>
  );
}

/** Promise-based confirm dialog: const [confirm, dialog] = useConfirm(); if (await confirm('...')) ... */
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (message, { title = 'Please confirm', danger = true, okText = 'Yes, continue' } = {}) =>
    new Promise((resolve) => setState({ message, title, danger, okText, resolve }));
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <Modal
      open={Boolean(state)}
      onClose={() => close(false)}
      title={state?.title}
      size="max-w-md"
      footer={
        <>
          <button className="btn-outline" onClick={() => close(false)}>Cancel</button>
          <button className={state?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)}>
            {state?.okText}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{state?.message}</p>
    </Modal>
  );
  return [confirm, dialog];
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex w-fit items-center gap-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-maroon-700' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-slate-700">{label}</span>}
    </label>
  );
}

export function FilterBar({ children }) {
  return <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">{children}</div>;
}

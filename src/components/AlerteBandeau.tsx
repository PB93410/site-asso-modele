import { useEffect, useState } from 'react';
import { MODULES } from '../data/asso';

type Alerte = { id: string; libelle: string; cours: string; date: string; message: string };

export default function AlerteBandeau() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);

  useEffect(() => {
    if (!MODULES.alertes) return;
    let stop = false;
    const charger = () => {
      fetch('/api/alertes?action=liste')
        .then((r) => (r.ok ? r.json() : { alertes: [] }))
        .then((d) => {
          if (!stop) setAlertes(Array.isArray(d.alertes) ? d.alertes : []);
        })
        .catch(() => {});
    };
    charger();
    const t = window.setInterval(charger, 5 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  if (!MODULES.alertes || !alertes.length) return null;

  return (
    <div className="fixed left-0 right-0 top-[56px] sm:top-[72px] z-[55] bg-amber-50 border-b border-amber-200 shadow-sm">
      <div className="content-max-width py-3 space-y-2">
        {alertes.map((a) => (
          <p key={a.id} className="font-body text-[15px] sm:text-[16px] text-amber-950 leading-snug">
            <strong>{a.libelle}.</strong> {a.cours}
            {a.date ? ` (${a.date})` : ''}. {a.message}
          </p>
        ))}
      </div>
    </div>
  );
}

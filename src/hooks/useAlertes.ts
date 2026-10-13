import { useEffect, useState } from 'react';
import { MODULES } from '../data/asso';

export type AlertePublique = { id: string; libelle: string; cours: string; date: string; message: string };

/** Alertes actives (module `alertes`), rechargées toutes les 5 minutes. */
export function useAlertes(): AlertePublique[] {
  const [alertes, setAlertes] = useState<AlertePublique[]>([]);
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
  return MODULES.alertes ? alertes : [];
}

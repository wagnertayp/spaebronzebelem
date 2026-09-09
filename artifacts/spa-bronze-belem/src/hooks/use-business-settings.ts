import { useEffect, useState } from 'react';

const STORAGE_KEY = 'spa-bronze-settings';

const readAdministrator = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).administrator || 'Wagner' : 'Wagner';
  } catch {
    return 'Wagner';
  }
};

export function useBusinessSettings() {
  const [administrator, setAdministrator] = useState(readAdministrator);

  useEffect(() => {
    const refresh = () => setAdministrator(readAdministrator());
    window.addEventListener('storage', refresh);
    window.addEventListener('spa-settings-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('spa-settings-updated', refresh);
    };
  }, []);

  const initials = administrator
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? '')
    .join('') || 'W';

  return { administrator, initials };
}
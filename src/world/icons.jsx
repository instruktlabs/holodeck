// Stroke icons for the world interface. Decorative: every control that uses one
// also carries a visible label or an aria-label.
const PATHS={
  chat:<path d="M4 5h16v11H9l-5 4z"/>,
  book:<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></>,
  board:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></>,
  layers:<><path d="m12 3 9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></>,
  pulse:<path d="M3 12h4l3-7 4 14 3-7h4"/>,
  clock:<><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></>,
  plug:<><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/></>,
  mic:<><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
  send:<path d="M12 19V5m-6 6 6-6 6 6"/>,
  stop:<rect x="7" y="7" width="10" height="10" rx="2"/>,
  close:<path d="m6 6 12 12M18 6 6 18"/>,
  up:<path d="m6 15 6-6 6 6"/>,
  down:<path d="m6 9 6 6 6-6"/>,
  right:<path d="m9 6 6 6-6 6"/>,
  check:<path d="m5 12 4 4 10-10"/>,
  eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:<><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9 9 0 0 0 4.4-1.1"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  enter:<path d="M7 17 17 7M9 7h8v8"/>,
  refresh:<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>,
};
export function Icon({name,size=18,...props}){
  return <svg className="hd-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...props}>{PATHS[name]}</svg>;
}

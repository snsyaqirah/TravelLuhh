// Standalone dev entry: http://localhost:<port>/dev/iso-kit.html (query: theme=dark, tier=lite, svg=1, section=…).
import { createRoot } from 'react-dom/client';
import IsoKit from '@/pages/dev/IsoKit';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<IsoKit />);

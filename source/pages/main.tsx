import React from 'react';
import { createRoot } from 'react-dom/client';
import Roadbook from '../app/page';
import '../app/globals.css';
import '../app/theme.css';
import '../app/theme-map.css';
import '../app/responsive.css';
createRoot(document.getElementById('root')!).render(<Roadbook />);

// Entry point: mounts the React app into <div id="root"> from index.html.
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind + colour variables (light/dark)

createRoot(document.getElementById('root')!).render(<App />);

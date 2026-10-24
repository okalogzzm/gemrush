/* ジェムラッシュ：起動の入口 */
import './styles/index.css';
import { init } from './app/controller.ts';
import { registerServiceWorker } from './pwa.ts';

init();
registerServiceWorker();

import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import {loadCloudStudentPrefs, saveCloudStudentPrefs} from './firebasePrefs.ts';
import {deriveCloudDocId, isValidCloudDocId, normalizeStudentId, verifyStudentHash, verifyStudentId} from './studentAllowlist.ts';

declare global {
  interface Window {
    __INONU_AUTH__?: {
      normalizeStudentId: typeof normalizeStudentId;
      verifyStudentId: typeof verifyStudentId;
      verifyStudentHash: typeof verifyStudentHash;
      deriveCloudDocId: typeof deriveCloudDocId;
      isValidCloudDocId: typeof isValidCloudDocId;
      loadCloudStudentPrefs: typeof loadCloudStudentPrefs;
      saveCloudStudentPrefs: typeof saveCloudStudentPrefs;
    };
  }
}

window.__INONU_AUTH__ = {
  normalizeStudentId,
  verifyStudentId,
  verifyStudentHash,
  deriveCloudDocId,
  isValidCloudDocId,
  loadCloudStudentPrefs,
  saveCloudStudentPrefs,
};
window.dispatchEvent(new Event('inonu-auth-ready'));

registerSW({
  immediate: true,
});

createRoot(document.getElementById('root')!).render(<App />);

import { useCallback, useState } from 'react';
import { ColdStart } from './components/ColdStart';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [backendReady, setBackendReady] = useState(false);

  const handleReady = useCallback(() => {
    setBackendReady(true);
  }, []);

  return (
    <>
      {!backendReady && <ColdStart onReady={handleReady} />}
      <Dashboard />
    </>
  );
}

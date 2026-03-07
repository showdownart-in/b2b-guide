import { ToastProvider } from './Toast';
import { OnboardForm } from './components/OnboardForm';

function App() {
  return (
    <ToastProvider>
      <header className="header">
        <h1>B2B Onboarding</h1>
        <p className="subtitle">Company + contact → Approve & Sync to Shopify</p>
      </header>

      <main className="main">
        <section className="section active">
          <OnboardForm />
        </section>
      </main>
    </ToastProvider>
  );
}

export default App;

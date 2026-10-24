import React from 'react';
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(document.getElementById('root')!);

async function mountStudy() {
  // Load only the selected study's global stylesheet: the older ledger page
  // scrolls as a document, while Connected gear uses the original full-screen layout.
  if (new URLSearchParams(window.location.search).get('study') === 'ledger') {
    const { default: TimechainStudy } = await import('./Study');
    root.render(<React.StrictMode><TimechainStudy /></React.StrictMode>);
    return;
  }

  const [{ default: App }] = await Promise.all([
    import('../App'),
    import('../styles.css'),
  ]);
  root.render(
    <React.StrictMode>
      <App initialFormStyle="gear" initialView="grid" initialPanelsHidden={true} />
    </React.StrictMode>,
  );
}

void mountStudy().catch(error => {
  console.error('Unable to load the design study', error);
  root.render(<main role="alert"><p>The design study could not load. Please reload this page.</p><a href="/">Return to Bitcoin / A network in time</a></main>);
});

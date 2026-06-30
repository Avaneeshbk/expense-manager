import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import { Sidebar } from "@/components/Sidebar";
import { Page, PageHeader } from "@/components/ui";
import { OverviewPage } from "@/pages/Overview";
import { LedgerPage } from "@/pages/Ledger";
import { InsightsPage } from "@/pages/Insights";
import { SettingsPage } from "@/pages/Settings";
import { useLocation } from "react-router-dom";

function PageTitle() {
  const loc = useLocation();
  const titles: Record<string, { title: string; sub: string }> = {
    "/":         { title: "Overview",  sub: "How your money is moving." },
    "/ledger":   { title: "Ledger",    sub: "Every entry you've logged." },
    "/insights": { title: "Insights",  sub: "Patterns across your spending." },
    "/settings": { title: "Settings",  sub: "Budgets and preferences." },
  };
  const t = titles[loc.pathname] || { title: "Ledger", sub: "" };
  return <PageHeader title={t.title} subtitle={t.sub} />;
}

function Shell() {
  return (
    <div className="min-h-full flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Page>
          <PageTitle />
          <Routes>
            <Route path="/"         element={<OverviewPage />} />
            <Route path="/ledger"   element={<LedgerPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*"         element={<OverviewPage />} />
          </Routes>
        </Page>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ThemeProvider>
  );
}

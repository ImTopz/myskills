import { useState } from "react";
import { Layout, type PageType } from "@/components/layout/Layout";
import { StorePage } from "@/pages/StorePage";
import { InstalledPage } from "@/pages/InstalledPage";
import { CreatePage } from "@/pages/CreatePage";
import { SettingsPage } from "@/pages/SettingsPage";

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>("store");

  const renderPage = () => {
    switch (currentPage) {
      case "store":
        return <StorePage />;
      case "installed":
        return <InstalledPage />;
      case "create":
        return <CreatePage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <StorePage />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default App;

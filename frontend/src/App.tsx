import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import TopNav from "./components/TopNav";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Check from "./pages/Check";
import Checking from "./pages/Checking";
import Report from "./pages/Report";
import About from "./pages/About";
import DemoTransfer from "./pages/DemoTransfer";
import DemoLinks from "./pages/DemoLinks";
import Dashboard from "./pages/Dashboard";

function Shell() {
  const { pathname } = useLocation();
  const isChecking = pathname === "/checking";
  const isDemo = pathname.startsWith("/demo/");
  const hideFooter = isChecking || pathname.startsWith("/check") || isDemo;
  const hideNav = isDemo;

  return (
    <>
      {!hideNav && <TopNav />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/check" element={<Check />} />
        <Route path="/checking" element={<Checking />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/about" element={<About />} />
        <Route path="/demo/transfer" element={<DemoTransfer />} />
        <Route path="/demo/links" element={<DemoLinks />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      {!hideFooter && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

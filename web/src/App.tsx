import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MasterPegawai from "./pages/MasterPegawai";
import MasterLayanan from "./pages/MasterLayanan";
import InputBooking from "./pages/InputBooking";
import BookedList from "./pages/BookedList";
import LaporanKeuangan from "./pages/LaporanKeuangan";
import LaporanPegawai from "./pages/LaporanPegawai";
import DataUser from "./pages/DataUser";
import HakAkses from "./pages/HakAkses";
import SettingKomisi from "./pages/SettingKomisi";
import DataCabang from "./pages/DataCabang";
import NotFound from "./pages/NotFound";
import PublicBooking from "./pages/PublicBooking";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/book" element={<PublicBooking />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/master/pegawai" element={<MasterPegawai />} />
            <Route path="/master/layanan" element={<MasterLayanan />} />
            <Route path="/booking/input" element={<InputBooking />} />
            <Route path="/booking/list" element={<BookedList />} />
            <Route path="/laporan/keuangan" element={<LaporanKeuangan />} />
            <Route path="/laporan/pegawai" element={<LaporanPegawai />} />
            <Route path="/user/data" element={<DataUser />} />
            <Route path="/user/akses" element={<HakAkses />} />
            <Route path="/setting/komisi" element={<SettingKomisi />} />
            <Route path="/setting/cabang" element={<DataCabang />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

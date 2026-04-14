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
import MasterProduk from "./pages/MasterProduk";
import InputBooking from "./pages/InputBooking";
import BookedList from "./pages/BookedList";
import RiwayatTransaksi from "./pages/RiwayatTransaksi";
import LaporanKeuangan from "./pages/LaporanKeuangan";
import LaporanPegawai from "./pages/LaporanPegawai";
import LaporanStok from "./pages/LaporanStok";
import MutasiStok from "./pages/MutasiStok";
import CustomerMember from "./pages/CustomerMember";
import DataUser from "./pages/DataUser";
import HakAkses from "./pages/HakAkses";
import SettingKomisi from "./pages/SettingKomisi";
import SettingLoyalty from "./pages/SettingLoyalty";
import DataCabang from "./pages/DataCabang";
import NotFound from "./pages/NotFound";
import PublicBooking from "./pages/PublicBooking";
import KasirPembayaran from "./pages/KasirPembayaran";
import TvQueue from "./pages/TvQueue";

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
          <Route path="/tv" element={<TvQueue />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/master/pegawai" element={<MasterPegawai />} />
            <Route path="/master/layanan" element={<MasterLayanan />} />
            <Route path="/master/produk" element={<MasterProduk />} />
            <Route path="/booking/input" element={<InputBooking />} />
            <Route path="/booking/list" element={<BookedList />} />
            <Route path="/transaksi/riwayat" element={<RiwayatTransaksi />} />
            <Route path="/laporan/keuangan" element={<LaporanKeuangan />} />
            <Route path="/laporan/pegawai" element={<LaporanPegawai />} />
            <Route path="/laporan/stok" element={<LaporanStok />} />
            <Route path="/laporan/mutasi-stok" element={<MutasiStok />} />
            <Route path="/kasir/pembayaran" element={<KasirPembayaran />} />
            <Route path="/customer" element={<CustomerMember />} />
            <Route path="/user/data" element={<DataUser />} />
            <Route path="/user/akses" element={<HakAkses />} />
            <Route path="/setting/komisi" element={<SettingKomisi />} />
            <Route path="/setting/loyalty" element={<SettingLoyalty />} />
            <Route path="/setting/cabang" element={<DataCabang />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "Error", description: "Username dan password harus diisi", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const payload = await api.login(username, password);
      localStorage.setItem("auth_token", payload.token);
      localStorage.setItem("auth_user", JSON.stringify(payload.user));
      toast({ title: "Berhasil", description: "Login berhasil!" });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Login gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[url('/login-bg.jpg')] bg-no-repeat bg-center bg-cover md:bg-contain opacity-80 blur-sm" style={{backgroundSize: 'cover', backgroundPosition: 'center'}} />
      {/* Overlay gelap transparan agar teks tetap jelas */}
      <div className="absolute inset-0 -z-10 bg-black/30" />
      {/* Hapus gradasi orange terang di kiri */}
      <div className="absolute -z-10 -top-24 -left-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
      <div className="absolute -z-10 -bottom-28 -right-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-black/90 flex items-center justify-center mx-auto mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-black/90">Barbershop</h1>
          <p className="text-black/80 text-sm mt-1">Management System</p>
        </div>

        <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Masukkan username"
                  value={username}
                  autoUppercase={false}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={password}
                    autoUppercase={false}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Memproses..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

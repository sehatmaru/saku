"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Bell,
  BotMessageSquare,
  Check,
  ChevronDown,
  Download,
  FolderPlus,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Trash2,
  Zap,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFinanceStore } from "@/store/use-finance-store";
import type { Budget, Transaction, TransactionType } from "@/types/finance";
import { parseWhatsAppMessage } from "@/features/whatsapp/parse-message";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  archiveBudget as archiveRemoteBudget,
  createBudget as createRemoteBudget,
  createTransaction as createRemoteTransaction,
  loadFinanceData,
  softDeleteTransaction,
  updateBudget as updateRemoteBudget,
  updateTransaction as updateRemoteTransaction,
  upsertRemoteCategory
} from "@/lib/supabase-finance";

type View = "dashboard" | "transactions" | "budgets" | "analytics" | "whatsapp";

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Beranda", icon: LayoutDashboard },
  { id: "transactions", label: "Transaksi", icon: ReceiptText },
  { id: "budgets", label: "Budget", icon: PiggyBank },
  { id: "analytics", label: "Ringkasan", icon: BarChart3 },
  { id: "whatsapp", label: "WhatsApp", icon: BotMessageSquare }
];

const chartColors = ["#21e58f", "#22d3ee", "#ffb020", "#ff6b4a", "#a3e635", "#f472b6"];

const trendChartConfig = {
  income: { label: "Pemasukan", color: "#21e58f" },
  expense: { label: "Pengeluaran", color: "#22d3ee" }
} satisfies ChartConfig;

const barChartConfig = {
  value: { label: "Pengeluaran", color: "#21e58f" }
} satisfies ChartConfig;

function SakuChartTooltip({ active, payload, label, config }: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; value?: unknown; color?: string }>;
  label?: string | number;
  config: ChartConfig;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {label && <div className="font-medium">{label}</div>}
      <div className="grid gap-1.5">
        {payload.map((entry, i) => {
          const key = String(entry.name ?? "");
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: entry.color ?? "currentColor" }} />
              <span className="text-muted-foreground">{config[key]?.label ?? key}</span>
              <span className="ml-auto font-mono font-medium tabular-nums">
                {formatCurrency(Number(entry.value))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const emptyForm = {
  id: "",
  type: "expense" as TransactionType,
  categoryId: "cat-food",
  amount: "",
  notes: "",
  transactionDate: new Date().toISOString().slice(0, 10)
};

const emptyBudgetDraft = {
  id: "",
  categoryId: "cat-food",
  amount: "",
  period: "monthly" as Budget["period"]
};

function IconButton({
  tooltip,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={tooltip} {...props} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </TooltipRoot>
  );
}

export function DashboardShell() {
  const router = useRouter();
  const {
    categories,
    transactions,
    budgets,
    activePeriod,
    setActivePeriod,
    replaceFinanceData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addBudget,
    updateBudget,
    archiveBudget,
    upsertCategory
  } = useFinanceStore();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [form, setForm] = useState(emptyForm);
  const [whatsAppText, setWhatsAppText] = useState("Makan siang Rp68.000 kategori Makan");
  const [toast, setToast] = useState(
    isSupabaseConfigured ? "Memeriksa sesi akun..." : "Beranda siap dipakai."
  );
  const [budgetDraft, setBudgetDraft] = useState(emptyBudgetDraft);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", type: "expense" as TransactionType });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const remoteReady = Boolean(isSupabaseConfigured && supabase && user);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const activeBudgets = useMemo(() => budgets.filter((budget) => !budget.archivedAt), [budgets]);

  const refreshFinance = useCallback(
    async (userId: string) => {
      setDataLoading(true);
      try {
        const data = await loadFinanceData(userId);
        replaceFinanceData(data);

        setForm((current) => {
          const nextCategory =
            data.categories.find((category) => category.id === current.categoryId && category.type === current.type) ??
            data.categories.find((category) => category.type === current.type);
          return nextCategory ? { ...current, categoryId: nextCategory.id } : current;
        });
        setBudgetDraft((current) => {
          const nextCategory =
            data.categories.find((category) => category.id === current.categoryId && category.type === "expense") ??
            data.categories.find((category) => category.type === "expense");
          return nextCategory ? { ...current, categoryId: nextCategory.id } : current;
        });
        setToast("Data Saku tersinkron.");
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.error(error);
        setToast("Gagal memuat data Saku. Coba beberapa saat lagi.");
      } finally {
        setDataLoading(false);
      }
    },
    [replaceFinanceData]
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setToast("Sesi akun belum valid. Silakan login ulang.");
        }
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setToast("Gagal memeriksa sesi akun. Silakan login ulang.");
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        replaceFinanceData({ categories: [], transactions: [], budgets: [] });
        setToast("Sesi keluar. Silakan login untuk membuka data Saku.");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [replaceFinanceData]);

  useEffect(() => {
    if (user?.id) {
      void refreshFinance(user.id);
    }
  }, [refreshFinance, user?.id]);

  useEffect(() => {
    if (isSupabaseConfigured && !authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  const metrics = useMemo(() => {
    const income = transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expense = transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const saving = income - expense;
    const budgetTotal = activeBudgets.reduce((total, budget) => total + budget.amount, 0);
    const budgetSpent = activeBudgets.reduce(
      (total, budget) => total + getBudgetSpent(budget, transactions),
      0
    );

    return {
      income,
      expense,
      saving,
      budgetTotal,
      budgetUsage: budgetTotal ? Math.round((budgetSpent / budgetTotal) * 100) : 0
    };
  }, [activeBudgets, transactions]);

  const categoryExpenseData = useMemo(() => {
    return categories
      .filter((category) => category.type === "expense")
      .map((category) => ({
        name: category.name,
        value: transactions
          .filter((transaction) => transaction.categoryId === category.id && transaction.type === "expense")
          .reduce((total, transaction) => total + transaction.amount, 0)
      }))
      .filter((item) => item.value > 0)
      .map((item, index) => ({ ...item, fill: chartColors[index % chartColors.length] }));
  }, [categories, transactions]);

  const trendData = useMemo(() => {
    const now = new Date();

    if (activePeriod === "week") {
      const dow = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);

      const labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
      return labels.map((label, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const day = transactions.filter((t) => t.transactionDate === dateStr);
        return {
          day: label,
          income: day.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expense: day.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
        };
      });
    }

    if (activePeriod === "month") {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

      return Array.from({ length: daysInMonth }, (_, i) => {
        const dateStr = `${prefix}-${String(i + 1).padStart(2, "0")}`;
        const day = transactions.filter((t) => t.transactionDate === dateStr);
        return {
          day: String(i + 1),
          income: day.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
          expense: day.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
        };
      });
    }

    const year = now.getFullYear();
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return months.map((label, i) => {
      const prefix = `${year}-${String(i + 1).padStart(2, "0")}`;
      const month = transactions.filter((t) => t.transactionDate.startsWith(prefix));
      return {
        day: label,
        income: month.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: month.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      };
    });
  }, [transactions, activePeriod]);

  const parsedMessage = useMemo(() => parseWhatsAppMessage(whatsAppText), [whatsAppText]);

  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLoading) return;

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setToast("Nominal harus lebih dari 0.");
      return;
    }

    const payload = {
      type: form.type,
      categoryId: form.categoryId,
      amount,
      notes: form.notes || "Tanpa catatan",
      transactionDate: form.transactionDate
    };

    setActionLoading(true);
    try {
      if (remoteReady && user) {
        if (form.id) {
          await updateRemoteTransaction(user.id, form.id, payload);
          setToast("Transaksi diperbarui.");
        } else {
          await createRemoteTransaction(user.id, payload);
          setToast("Transaksi baru tersimpan.");
        }
        await refreshFinance(user.id);
      } else if (form.id) {
        updateTransaction(form.id, payload);
        setToast("Transaksi diperbarui.");
      } else {
        addTransaction(payload);
        setToast("Transaksi baru tersimpan.");
      }

      setForm(emptyForm);
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(error);
      setToast("Transaksi gagal disimpan. Coba beberapa saat lagi.");
    } finally {
      setActionLoading(false);
    }
  }

  function editTransaction(transaction: Transaction) {
    setForm({
      id: transaction.id,
      type: transaction.type,
      categoryId: transaction.categoryId,
      amount: String(transaction.amount),
      notes: transaction.notes,
      transactionDate: transaction.transactionDate
    });
  }

  async function submitBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLoading) return;

    const amount = Number(budgetDraft.amount);
    if (!amount || amount <= 0) {
      setToast("Budget harus lebih dari 0.");
      return;
    }

    const payload = {
      categoryId: budgetDraft.categoryId,
      amount,
      period: budgetDraft.period
    };

    setActionLoading(true);
    try {
      if (remoteReady && user) {
        if (budgetDraft.id) {
          await updateRemoteBudget(user.id, budgetDraft.id, payload);
          setToast("Budget diperbarui.");
        } else {
          await createRemoteBudget(user.id, payload);
          setToast("Budget baru tersimpan.");
        }
        await refreshFinance(user.id);
      } else if (budgetDraft.id) {
        updateBudget(budgetDraft.id, payload);
        setToast("Budget diperbarui.");
      } else {
        addBudget(payload);
        setToast("Budget baru dibuat.");
      }
      setBudgetDraft({ ...emptyBudgetDraft, categoryId: budgetDraft.categoryId });
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(error);
      setToast("Budget gagal disimpan. Coba beberapa saat lagi.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmWhatsAppTransaction() {
    if (actionLoading) return;

    if (!parsedMessage) {
      setToast("Format WhatsApp belum terbaca. Sertakan nominal seperti Rp68.000.");
      return;
    }

    setActionLoading(true);
    try {
      if (remoteReady && user) {
        const category = await upsertRemoteCategory(user.id, parsedMessage.categoryName, parsedMessage.type);
        await createRemoteTransaction(user.id, {
          amount: parsedMessage.amount,
          type: parsedMessage.type,
          categoryId: category.id,
          notes: parsedMessage.notes,
          transactionDate: new Date().toISOString().slice(0, 10),
          source: "whatsapp"
        });
        await refreshFinance(user.id);
        setToast("Input WhatsApp tersimpan.");
      } else {
        const category = upsertCategory(parsedMessage.categoryName, parsedMessage.type);
        addTransaction({
          amount: parsedMessage.amount,
          type: parsedMessage.type,
          categoryId: category.id,
          notes: parsedMessage.notes,
          transactionDate: new Date().toISOString().slice(0, 10),
          source: "whatsapp"
        });
        setToast("Input WhatsApp berhasil dibuat menjadi transaksi.");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(error);
      setToast("Input WhatsApp gagal disimpan. Coba beberapa saat lagi.");
    } finally {
      setActionLoading(false);
    }
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLoading) return;

    const name = categoryDraft.name.trim();
    if (!name) {
      setToast("Nama kategori wajib diisi.");
      return;
    }

    setActionLoading(true);
    try {
      if (remoteReady && user) {
        await upsertRemoteCategory(user.id, name, categoryDraft.type);
        await refreshFinance(user.id);
        setToast("Kategori tersimpan.");
      } else {
        upsertCategory(name, categoryDraft.type);
        setToast("Kategori tersimpan.");
      }
      setCategoryDraft({ ...categoryDraft, name: "" });
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(error);
      setToast("Kategori gagal disimpan. Coba beberapa saat lagi.");
    } finally {
      setActionLoading(false);
    }
  }

  async function removeTransaction(id: string) {
    if (actionLoading) return;

    setActionLoading(true);
    try {
      if (remoteReady && user) {
        await softDeleteTransaction(user.id, id);
        await refreshFinance(user.id);
        setToast("Transaksi dihapus.");
      } else {
        deleteTransaction(id);
        setToast("Transaksi dihapus.");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(error);
      setToast("Transaksi gagal dihapus. Coba beberapa saat lagi.");
    } finally {
      setActionLoading(false);
    }
  }

  async function archiveSelectedBudget(id: string) {
    if (actionLoading) return;

    setActionLoading(true);
    try {
      if (remoteReady && user) {
        await archiveRemoteBudget(user.id, id);
        await refreshFinance(user.id);
        setToast("Budget diarsipkan.");
      } else {
        archiveBudget(id);
        setToast("Budget diarsipkan.");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(error);
      setToast("Budget gagal diarsipkan. Coba beberapa saat lagi.");
    } finally {
      setActionLoading(false);
    }
  }

  function editBudget(budget: Budget) {
    setActiveView("budgets");
    setBudgetDraft({
      id: budget.id,
      categoryId: budget.categoryId,
      amount: String(budget.amount),
      period: budget.period
    });
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    replaceFinanceData({ categories: [], transactions: [], budgets: [] });
    setToast("Berhasil keluar. Silakan login untuk membuka data Saku.");
    router.replace("/login");
  }

  function exportData() {
    const payload = JSON.stringify({ categories, transactions, budgets }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "saku-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Data transaksi diekspor sebagai JSON.");
  }

  return (
    <main className="saku-shell saku-noise min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 border-r border-white/10 bg-zinc-950 p-4 text-white shadow-2xl lg:block">
          <Brand />
          <nav className="mt-8 space-y-1">
            {navigation.map((item) => (
              <NavButton
                key={item.id}
                active={activeView === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => setActiveView(item.id)}
              />
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-white/60 bg-background/72 px-4 backdrop-blur-2xl dark:border-white/10 md:px-6">
            <div className="flex items-center gap-3">
              <Button aria-label="Menu" title="Menu" variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Saku pribadi</p>
                <h1 className="text-xl font-extrabold md:text-2xl">{pageTitle(activeView)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {authLoading ? (
                <Button variant="secondary" className="hidden sm:inline-flex" disabled>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cek sesi
                </Button>
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="hidden sm:inline-flex">
                      {user.email?.split("@")[0] ?? "Akun"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportData}>
                      <Download className="h-4 w-4" />
                      Ekspor data
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4" />
                      Keluar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="secondary" className="hidden sm:inline-flex">
                  <Link href="/login">
                    <LogIn className="h-4 w-4" />
                    Masuk
                  </Link>
                </Button>
              )}
              {!user && (
                <IconButton tooltip="Ekspor data" variant="outline" onClick={exportData}>
                  <Download className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </header>

          <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
            {activeView === "dashboard" && (
              <>
                <Alert className="border-white/70 bg-card/78 dark:border-white/10">
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <span className="font-semibold">
                      {dataLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {toast}
                        </span>
                      ) : toast}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={remoteReady ? "success" : "warning"}>
                        {remoteReady ? "Tersinkron" : "Data aktif"}
                      </Badge>
                      <Badge variant={metrics.budgetUsage > 80 ? "warning" : "success"}>
                        Budget {metrics.budgetUsage}%
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>

                <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                  <div className="overflow-hidden rounded-lg border border-zinc-950 bg-zinc-950 text-white shadow-pop dark:border-white/10">
                    <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:p-6">
                      <div className="max-w-2xl">
                        <Badge className="bg-lime-300 text-zinc-950">Cek arus uang</Badge>
                        <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-normal md:text-4xl">
                          Uang masuk rapi, pengeluaran tetap kebaca.
                        </h2>
                        <p className="mt-3 max-w-xl text-sm font-medium text-zinc-300">
                          Saku ngerangkum transaksi, budget, dan input WhatsApp dalam satu tempat yang cepat dipakai.
                        </p>
                      </div>
                      <div className="grid min-w-52 content-center gap-3">
                        <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-lime-200">
                            <TrendingUp className="h-4 w-4" />
                            Sisa aman
                          </div>
                          <p className="mt-2 text-2xl font-extrabold">{formatCurrency(metrics.saving)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-lime-300 p-3 text-zinc-950">
                            <p className="text-xs font-bold uppercase tracking-wider">Pemasukan</p>
                            <p className="mt-1 font-extrabold">{formatCompactCurrency(metrics.income)}</p>
                          </div>
                          <div className="rounded-lg bg-cyan-300 p-3 text-zinc-950">
                            <p className="text-xs font-bold uppercase tracking-wider">Pengeluaran</p>
                            <p className="mt-1 font-extrabold">{formatCompactCurrency(metrics.expense)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-white/[0.06] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.2em] text-zinc-300 md:flex md:items-center md:gap-4 md:tracking-[0.24em]">
                      <span>Catat manual</span>
                      <span className="text-lime-300">Pantau budget</span>
                      <span>Baca WhatsApp</span>
                      <span className="text-cyan-300">Ringkasan cepat</span>
                    </div>
                  </div>

                  <Card className="border-accent/35 bg-accent/12">
                    <CardHeader>
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <CardTitle>Sinyal pengeluaran</CardTitle>
                      <CardDescription>Budget terpakai masih di zona aman bulan ini.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between gap-3">
                        <p className="text-4xl font-extrabold">{metrics.budgetUsage}%</p>
                        <Badge variant={metrics.budgetUsage > 80 ? "warning" : "success"}>
                          {metrics.budgetUsage > 80 ? "Perlu rem" : "Aman"}
                        </Badge>
                      </div>
                      <Progress value={metrics.budgetUsage} className="mt-4 h-3" />
                    </CardContent>
                  </Card>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Pemasukan"
                    value={formatCurrency(metrics.income)}
                    helper="+12% dari periode lalu"
                    icon={ArrowUpCircle}
                    tone="lime"
                  />
                  <MetricCard
                    title="Pengeluaran"
                    value={formatCurrency(metrics.expense)}
                    helper="Termasuk input WhatsApp"
                    icon={ArrowDownCircle}
                    tone="cyan"
                  />
                  <MetricCard
                    title="Sisa Bersih"
                    value={formatCurrency(metrics.saving)}
                    helper={metrics.saving >= 0 ? "Arus uang positif" : "Perlu evaluasi"}
                    icon={WalletCards}
                    tone="coral"
                  />
                  <MetricCard
                    title="Budget Terpakai"
                    value={`${metrics.budgetUsage}%`}
                    helper={formatCurrency(metrics.budgetTotal)}
                    icon={PiggyBank}
                    tone="pink"
                  />
                </section>
              </>
            )}

            {(activeView === "dashboard" || activeView === "analytics") && (
              <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>Tren kas</CardTitle>
                      <CardDescription>Pemasukan dan pengeluaran dalam periode aktif.</CardDescription>
                    </div>
                    <PeriodSwitch activePeriod={activePeriod} onChange={setActivePeriod} />
                  </CardHeader>
                  <CardContent className="h-80">
                    <ChartContainer config={trendChartConfig} className="h-full w-full">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="income" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.42} />
                            <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="expense" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.34} />
                            <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} />
                        <ChartTooltip content={(props) => <SakuChartTooltip {...props} config={trendChartConfig} />} />
                        <Area dataKey="income" stroke="var(--color-income)" fill="url(#income)" strokeWidth={2.5} />
                        <Area dataKey="expense" stroke="var(--color-expense)" fill="url(#expense)" strokeWidth={2.5} />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pengeluaran kategori</CardTitle>
                    <CardDescription>Komposisi pengeluaran aktif.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ChartContainer config={{}} className="h-full w-full">
                      <PieChart>
                        <Pie
                          data={categoryExpenseData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={64}
                          outerRadius={104}
                          paddingAngle={3}
                        />
                        <ChartTooltip content={(props) => <SakuChartTooltip {...props} config={{}} />} />
                      </PieChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </section>
            )}

            {(activeView === "dashboard" || activeView === "transactions") && (
              <TransactionList
                transactions={transactions}
                categoryById={categoryById}
                onEdit={editTransaction}
                onDelete={removeTransaction}
              />
            )}

            {(activeView === "dashboard" || activeView === "transactions") && (
              <CategoryManager
                categories={categories}
                draft={categoryDraft}
                onChange={setCategoryDraft}
                onSubmit={submitCategory}
                loading={actionLoading}
              />
            )}

            {(activeView === "dashboard" || activeView === "budgets") && (
              <section className="grid gap-4 xl:grid-cols-[1.25fr_0.85fr]">
                <BudgetList
                  budgets={activeBudgets}
                  transactions={transactions}
                  categoryById={categoryById}
                  onEdit={editBudget}
                  onArchive={archiveSelectedBudget}
                />
                <BudgetForm
                  categories={categories}
                  draft={budgetDraft}
                  onChange={setBudgetDraft}
                  onSubmit={submitBudget}
                  loading={actionLoading}
                />
              </section>
            )}

            {activeView === "analytics" && (
              <Card>
                <CardHeader>
                  <CardTitle>Perbandingan kategori</CardTitle>
                  <CardDescription>Nilai pengeluaran per kategori untuk membaca pola belanja.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ChartContainer config={barChartConfig} className="h-full w-full">
                    <BarChart data={categoryExpenseData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} />
                      <ChartTooltip content={(props) => <SakuChartTooltip {...props} config={barChartConfig} />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {(activeView === "dashboard" || activeView === "whatsapp") && (
              <WhatsAppPanel
                text={whatsAppText}
                parsedMessage={parsedMessage}
                onTextChange={setWhatsAppText}
                onConfirm={confirmWhatsAppTransaction}
                loading={actionLoading}
              />
            )}

            <div className="lg:hidden">
              <TransactionForm
                categories={categories}
                form={form}
                onChange={setForm}
                onSubmit={submitTransaction}
                loading={actionLoading}
              />
            </div>
          </div>
        </section>
      </div>

      <FloatingTransactionPanel
        categories={categories}
        form={form}
        onChange={setForm}
        onSubmit={submitTransaction}
        loading={actionLoading}
      />

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-white/10 bg-zinc-950 px-2 py-2 text-white shadow-2xl lg:hidden">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => setActiveView(item.id)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold text-zinc-400",
                activeView === item.id && "bg-lime-300 text-zinc-950"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-lime-300 text-zinc-950 shadow-pop">
        <WalletCards className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-extrabold">Saku</p>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Catatan uang</p>
      </div>
    </div>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: typeof LayoutDashboard;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-extrabold text-zinc-400 transition-all hover:-translate-y-0.5 hover:bg-white/8 hover:text-white",
        active && "bg-lime-300 text-zinc-950 shadow-pop hover:bg-lime-300 hover:text-zinc-950"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof WalletCards;
  tone: "lime" | "cyan" | "coral" | "pink";
}) {
  const tones = {
    lime: "from-lime-300/28 via-card to-card text-lime-600 dark:text-lime-300",
    cyan: "from-cyan-300/28 via-card to-card text-cyan-600 dark:text-cyan-300",
    coral: "from-orange-300/30 via-card to-card text-orange-600 dark:text-orange-300",
    pink: "from-pink-300/26 via-card to-card text-pink-600 dark:text-pink-300"
  };

  return (
    <Card className={cn("overflow-hidden bg-gradient-to-br", tones[tone])}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/60 text-current shadow-sm dark:bg-white/10">
          <Icon className="h-5 w-5" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-extrabold tracking-normal text-foreground">{value}</p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function PeriodSwitch({
  activePeriod,
  onChange
}: {
  activePeriod: "week" | "month" | "year";
  onChange: (period: "week" | "month" | "year") => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-md border bg-background/60 p-1 text-sm shadow-sm">
      {(["week", "month", "year"] as const).map((period) => (
        <button
          key={period}
          type="button"
          className={cn(
            "rounded px-3 py-1 font-extrabold text-muted-foreground transition-all",
            activePeriod === period && "bg-zinc-950 text-lime-200 dark:bg-lime-300 dark:text-zinc-950"
          )}
          onClick={() => onChange(period)}
        >
          {period === "week" ? "Minggu" : period === "month" ? "Bulan" : "Tahun"}
        </button>
      ))}
    </div>
  );
}

function TransactionForm({
  categories,
  form,
  onChange,
  onSubmit,
  loading,
  bare = false
}: {
  categories: ReturnType<typeof useFinanceStore.getState>["categories"];
  form: typeof emptyForm;
  onChange: (form: typeof emptyForm) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  bare?: boolean;
}) {
  const filteredCategories = categories.filter((category) => category.type === form.type);

  const formContent = (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-md border bg-background/60 text-sm font-extrabold transition-all hover:-translate-y-0.5",
              form.type === type &&
                "border-zinc-950 bg-zinc-950 text-lime-200 shadow-pop dark:border-lime-300 dark:bg-lime-300 dark:text-zinc-950"
            )}
            onClick={() =>
              onChange({
                ...form,
                type,
                categoryId: categories.find((category) => category.type === type)?.id ?? form.categoryId
              })
            }
          >
            {type === "expense" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
            {type === "expense" ? "Keluar" : "Masuk"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Nominal</Label>
        <Input
          id="amount"
          inputMode="numeric"
          type="number"
          min="1"
          placeholder="100000"
          value={form.amount}
          onChange={(event) => onChange({ ...form, amount: event.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Tanggal</Label>
        <Input
          id="date"
          type="date"
          value={form.transactionDate}
          onChange={(event) => onChange({ ...form, transactionDate: event.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Kategori</Label>
        <Select
          value={form.categoryId}
          onValueChange={(value) => onChange({ ...form, categoryId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Catatan</Label>
        <Input
          id="notes"
          placeholder="Makan siang, invoice, tagihan..."
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
      </div>

      <Button className="w-full" disabled={loading}>
        {loading ? "Menyimpan..." : form.id ? "Simpan perubahan" : "Tambah transaksi"}
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </form>
  );

  if (bare) return formContent;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{form.id ? "Edit transaksi" : "Tambah transaksi"}</CardTitle>
        <CardDescription>Catat pemasukan atau pengeluaran dengan validasi dasar.</CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}

function FloatingTransactionPanel({
  categories,
  form,
  onChange,
  onSubmit,
  loading
}: {
  categories: ReturnType<typeof useFinanceStore.getState>["categories"];
  form: typeof emptyForm;
  onChange: (form: typeof emptyForm) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: window.innerWidth - 336, y: 80 });
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      const w = panelRef.current?.offsetWidth ?? 320;
      const h = panelRef.current?.offsetHeight ?? 48;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - w, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - h, e.clientY - dragOffset.current.y))
      });
    }

    function onMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  function onHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    setIsDragging(true);
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-10 hidden flex-col rounded-2xl border border-white/70 bg-card/92 backdrop-blur-2xl dark:border-white/10 lg:flex transition-[width] duration-300",
        minimized ? "w-96" : "w-80",
        isDragging
          ? "cursor-grabbing select-none shadow-[0_24px_64px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.10)]"
          : minimized
          ? "[animation:glow-lime_2s_ease-in-out_infinite]"
          : "shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)] [animation:float_5s_ease-in-out_infinite] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={cn(
          "relative flex shrink-0 select-none items-center justify-between overflow-hidden bg-zinc-950 px-5 text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300",
          minimized ? "py-4 rounded-2xl" : "py-3 rounded-t-2xl",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={onHeaderMouseDown}
      >
        {minimized && !isDragging && (
          <div className="pointer-events-none absolute inset-0 [animation:shimmer_2.5s_ease-in-out_infinite_0.6s] bg-gradient-to-r from-transparent via-lime-300/25 to-transparent" />
        )}
        <span>{form.id ? "Edit transaksi" : "Catat transaksi"}</span>
        <button
          type="button"
          aria-label={minimized ? "Perluas" : "Perkecil"}
          onClick={() => setMinimized((v) => !v)}
          className="rounded p-0.5 text-lime-300/60 transition-colors hover:text-lime-300"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", minimized && "rotate-180")} />
        </button>
      </div>
      {!minimized && (
        <div className="overflow-y-auto p-4">
          <TransactionForm
            categories={categories}
            form={form}
            onChange={onChange}
            onSubmit={onSubmit}
            loading={loading}
            bare
          />
        </div>
      )}
    </div>
  );
}

function TransactionList({
  transactions,
  categoryById,
  onEdit,
  onDelete
}: {
  transactions: Transaction[];
  categoryById: Map<string, { name: string; color: string }>;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat transaksi</CardTitle>
        <CardDescription>Edit, hapus, dan cek sumber input transaksi.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-3">
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const category = categoryById.get(transaction.categoryId);
              return (
                <div
                  key={transaction.id}
                  className="grid gap-3 rounded-lg border bg-background/52 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-background/78 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category?.color ?? "#10b981" }}
                      />
                      <p className="font-semibold">{transaction.notes}</p>
                      <Badge variant={transaction.source === "whatsapp" ? "success" : "secondary"}>
                        {transaction.source}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {category?.name ?? "Kategori"} - {formatDate(transaction.transactionDate)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p
                      className={cn(
                        "font-bold",
                        transaction.type === "income" ? "text-emerald-600" : "text-foreground"
                      )}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <IconButton tooltip="Edit transaksi" onClick={() => onEdit(transaction)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton tooltip="Hapus transaksi" onClick={() => onDelete(transaction.id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function CategoryManager({
  categories,
  draft,
  onChange,
  onSubmit,
  loading
}: {
  categories: ReturnType<typeof useFinanceStore.getState>["categories"];
  draft: { name: string; type: TransactionType };
  onChange: (draft: { name: string; type: TransactionType }) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Kategori</CardTitle>
          <CardDescription>Buat kategori pemasukan atau pengeluaran untuk transaksi cepat.</CardDescription>
        </div>
        <Badge variant="secondary">{categories.length} aktif</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={onSubmit}>
          <Input
            aria-label="Nama kategori"
            placeholder="Nama kategori"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            required
          />
          <Select
            value={draft.type}
            onValueChange={(value) => onChange({ ...draft, type: value as TransactionType })}
          >
            <SelectTrigger className="w-auto min-w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Pengeluaran</SelectItem>
              <SelectItem value="income">Pemasukan</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Tambah
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm font-semibold"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
              <Badge variant={category.type === "income" ? "success" : "secondary"}>
                {category.type === "income" ? "Masuk" : "Keluar"}
              </Badge>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetList({
  budgets,
  transactions,
  categoryById,
  onEdit,
  onArchive
}: {
  budgets: Budget[];
  transactions: Transaction[];
  categoryById: Map<string, { name: string; color: string }>;
  onEdit: (budget: Budget) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget aktif</CardTitle>
        <CardDescription>Progress otomatis berdasarkan transaksi kategori.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {budgets.map((budget) => {
          const category = categoryById.get(budget.categoryId);
          const spent = getBudgetSpent(budget, transactions);
          const progress = Math.round((spent / budget.amount) * 100);

          return (
            <div key={budget.id} className="rounded-lg border bg-background/52 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/45">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{category?.name ?? "Budget"}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(spent)} dari {formatCurrency(budget.amount)}
                  </p>
                </div>
                <Badge variant={progress > 85 ? "warning" : "secondary"}>{progress}%</Badge>
              </div>
              <Progress value={progress} className="mt-4" />
              <div className="mt-4 flex justify-end gap-2">
                <IconButton tooltip="Edit budget" onClick={() => onEdit(budget)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton tooltip="Arsipkan budget" onClick={() => onArchive(budget.id)}>
                  <FolderPlus className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BudgetForm({
  categories,
  draft,
  onChange,
  onSubmit,
  loading
}: {
  categories: ReturnType<typeof useFinanceStore.getState>["categories"];
  draft: typeof emptyBudgetDraft;
  onChange: (draft: typeof emptyBudgetDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{draft.id ? "Edit budget" : "Buat budget"}</CardTitle>
        <CardDescription>Atur batas kategori bulanan atau mingguan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={draft.categoryId}
              onValueChange={(value) => onChange({ ...draft, categoryId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((category) => category.type === "expense")
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-amount">Nominal</Label>
            <Input
              id="budget-amount"
              inputMode="numeric"
              type="number"
              min="1"
              placeholder="1500000"
              value={draft.amount}
              onChange={(event) => onChange({ ...draft, amount: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Periode</Label>
            <Select
              value={draft.period}
              onValueChange={(value) => onChange({ ...draft, period: value as Budget["period"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Bulanan</SelectItem>
                <SelectItem value="weekly">Mingguan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? "Menyimpan..." : draft.id ? "Simpan budget" : "Buat budget"}
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WhatsAppPanel({
  text,
  parsedMessage,
  onTextChange,
  onConfirm,
  loading
}: {
  text: string;
  parsedMessage: ReturnType<typeof parseWhatsAppMessage>;
  onTextChange: (value: string) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Input via WhatsApp</CardTitle>
        <CardDescription>Tempel pesan transaksi agar Saku bantu baca otomatis.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-3">
          <Label htmlFor="whatsapp">Pesan</Label>
          <Textarea
            id="whatsapp"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Contoh: Bayar internet Rp350.000 kategori Tagihan"
          />
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Menyimpan..." : "Buat transaksi"}
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BotMessageSquare className="h-4 w-4" />}
          </Button>
        </div>
        <div className="rounded-lg border border-zinc-950 bg-zinc-950 p-4 text-white dark:border-white/10">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Zap className="h-4 w-4 text-lime-300" />
            <p>Pratinjau transaksi</p>
          </div>
          {parsedMessage ? (
            <dl className="mt-3 grid gap-3 text-sm">
              <PreviewItem label="Tipe" value={parsedMessage.type === "income" ? "Pemasukan" : "Pengeluaran"} />
              <PreviewItem label="Kategori" value={parsedMessage.categoryName} />
              <PreviewItem label="Nominal" value={formatCurrency(parsedMessage.amount)} />
              <PreviewItem label="Catatan" value={parsedMessage.notes} />
            </dl>
          ) : (
            <p className="mt-3 text-sm font-medium text-zinc-400">
              Parser menunggu nominal yang valid, misalnya Rp68.000.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="text-right font-extrabold text-white">{value}</dd>
    </div>
  );
}

function pageTitle(view: View) {
  const match = navigation.find((item) => item.id === view);
  return match?.label ?? "Beranda";
}

function getBudgetSpent(budget: Budget, transactions: Transaction[]) {
  const liveSpent = transactions
    .filter((transaction) => transaction.categoryId === budget.categoryId && transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  return Math.max(budget.spent, liveSpent);
}

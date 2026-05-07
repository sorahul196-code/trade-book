import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Plus, LogOut, Share2, Users, AlertTriangle, BookOpen, Brain, Zap,
  TrendingUp, TrendingDown, Copy, Check, ArrowRight, Loader2, Pencil, Trash2, ChevronDown, ChevronUp, BarChart3, User
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ──
function toDateKey(d: string) { return d.slice(0, 10); }

function formatDateTimeShort(d: string) {
  const date = new Date(d);
  const datePart = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

function getLocalDatetime(dateInput?: string | Date) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── The Premium Trade Card Component ──
function UserTradeCard({ group, dayJournal, mistakesList, onSetClosingTrade }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = group.side === "Long";
  const capitalInvested = group.totalBuyQty * group.buyPrice;

  return (
    <Card className="bg-[hsl(0,0%,9%)] border-[hsl(0,0%,15%)] overflow-hidden shadow-2xl transition-all duration-300 ring-1 ring-white/5">
      
      {/* ── Header ── */}
      <div 
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-[hsl(0,0%,11%)] active:scale-[0.99] transition-all select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-1 h-8 rounded-full ${isLong ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'}`}></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-100 tracking-tight">{group.ticker}</h3>
              <Badge className={`text-[9px] h-4 px-1.5 leading-none font-black uppercase ${isLong ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                {group.side}
              </Badge>
            </div>
            <p className="text-[10px] text-neutral-500 font-medium mt-0.5">{formatDateTimeShort(group.buyDate)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-sm font-bold ${group.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {group.isOpen ? "OPEN" : `${group.totalPnL >= 0 ? "+" : ""}${formatINR(group.totalPnL)}`}
            </p>
            {!group.isOpen && <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">Realized</p>}
          </div>
          <div className="bg-[hsl(0,0%,14%)] rounded-full p-1 border border-white/5">
            {isExpanded ? <ChevronUp className="h-3 w-3 text-neutral-400" /> : <ChevronDown className="h-3 w-3 text-neutral-400" />}
          </div>
        </div>
      </div>

      {/* ── Expanded Content ── */}
      {isExpanded && (
        <CardContent className="p-0 border-t border-white/5 bg-[hsl(0,0%,8%)] animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-px bg-white/5">
             <div className="bg-[hsl(0,0%,8%)] p-4">
                <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">Entry Price</p>
                <p className="text-sm font-semibold text-neutral-200">{formatINR(group.buyPrice)}</p>
             </div>
             <div className="bg-[hsl(0,0%,8%)] p-4 border-l border-white/5">
                <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">Position Size</p>
                <p className="text-sm font-semibold text-neutral-200">{group.totalBuyQty} Shares</p>
             </div>
             <div className="bg-[hsl(0,0%,8%)] p-4 border-t border-white/5">
                <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">Capital Used</p>
                <p className="text-sm font-semibold text-neutral-200">{formatINR(capitalInvested)}</p>
             </div>
             <div className="bg-[hsl(0,0%,8%)] p-4 border-t border-l border-white/5 flex flex-col justify-center">
                {group.isOpen ? (
                  <Button 
                    size="sm" 
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onSetClosingTrade({ ticker: group.ticker, side: group.side, remainQty: group.currentRemainQty }); 
                    }}
                  >
                    Close Trade
                  </Button>
                ) : (
                  <div className="flex flex-col">
                    <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">Status</p>
                    <p className="text-[10px] font-bold text-neutral-500">TRADING COMPLETE</p>
                  </div>
                )}
             </div>
          </div>

          {/* Scale Outs / Timeline */}
          {group.sells.length > 0 && (
            <div className="p-5 border-t border-white/5 space-y-4">
               <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mb-4">Trade Timeline (Exits)</p>
               {group.sells.map((sell: any, idx: number) => (
                 <div key={idx} className="relative pl-6 border-l-2 border-white/10 pb-4 last:pb-0">
                    <div className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-[hsl(0,0%,15%)] border-2 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="text-xs font-bold text-neutral-200">Sold {sell.soldQty} Shares @ {formatINR(sell.sellPrice)}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">{formatDateTimeShort(sell.sellDate)}</p>
                       </div>
                       <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[10px]">
                         {sell.pnl >= 0 ? "+" : ""}{formatINR(sell.pnl)}
                       </Badge>
                    </div>
                    {sell.note && (
                      <div className="mt-2 p-2 rounded bg-[hsl(0,0%,12%)] border border-white/5 italic text-[10px] text-neutral-400 leading-relaxed">
                        &ldquo;{sell.note}&rdquo;
                      </div>
                    )}
                 </div>
               ))}
            </div>
          )}

          {/* Psychology Footer */}
          {(dayJournal || mistakesList.length > 0) && (
            <div className="p-5 bg-[hsl(0,0%,6%)] space-y-4">
                <div className="flex flex-wrap gap-2">
                   {dayJournal?.marketSentiment && (
                       <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-neutral-300 uppercase">
                          {dayJournal.marketSentiment}
                       </div>
                   )}
                   <div className="flex gap-1">
                      <div className="px-2 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-[9px] font-bold text-sky-400">
                        🧠 {dayJournal?.mentalState || '?'}/10
                      </div>
                      <div className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20 text-[9px] font-bold text-yellow-400">
                        ⚡ {dayJournal?.energyLevel || '?'}/10
                      </div>
                   </div>
                </div>

                {mistakesList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mistakesList.map((m: string) => (
                      <span key={m} className="text-[8px] font-black uppercase text-rose-500/70 border border-rose-500/10 px-1.5 py-0.5 rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {dayJournal?.observations && (
                   <div className="bg-[hsl(0,0%,10%)] rounded-lg p-3 border border-white/5">
                      <p className="text-[10px] text-neutral-400 leading-relaxed italic">
                        {dayJournal.observations}
                      </p>
                   </div>
                )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.trade.stats.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: journalData } = trpc.journal.list.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: friendsData } = trpc.friend.myFriends.useQuery(undefined, {
    enabled: !!user,
  });

  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [friendToken, setFriendToken] = useState("");
  
  // Modals State
  const [closingTrade, setClosingTrade] = useState<{ ticker: string, side: "Long" | "Short", remainQty: number } | null>(null);
  const [editTrade, setEditTrade] = useState<{
    id: string; type: string; ticker: string; quantity: string; price: string; date: string; notes: string;
  } | null>(null);

  // Mutations
  const addFriendMutation = trpc.friend.addFriend.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        utils.friend.myFriends.invalidate();
        toast.success(`Added ${res.friend.name} as a friend`);
        setFriendToken("");
      } else {
        toast.error(res.error);
      }
    },
  });

  const createMutation = trpc.trade.create.useMutation({
    onSuccess: () => {
      utils.trade.stats.invalidate();
      setClosingTrade(null);
      toast.success("Position closed successfully!");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.trade.update.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        utils.trade.stats.invalidate();
        setEditTrade(null);
        toast.success("Trade updated successfully");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.trade.delete.useMutation({
    onSuccess: () => {
      utils.trade.stats.invalidate();
      toast.success("Trade deleted successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(0,0%,6%)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/friend/${user.shareToken}`;

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareUrlCopied(true);
      setTimeout(() => setShareUrlCopied(false), 2000);
      toast.success("Share link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleAddFriend = () => {
    if (!friendToken.trim()) return;
    addFriendMutation.mutate({ shareToken: friendToken.trim() });
  };

  const matchedTrades = stats?.matchedTrades ?? [];
  const rawTrades = stats?.trades ?? [];
  const journalEntries = journalData?.entries ?? [];
  const totalRealizedPnL = stats?.totalRealizedPnL ?? 0;

  // FIFO Grouping Logic
  const groupedMap = new Map<string, any>();

  matchedTrades.forEach((m) => {
    const key = `${m.ticker}_${m.side}_${m.buyDate}_${m.buyPrice}`;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        id: m.id,
        ticker: m.ticker,
        side: m.side,
        buyDate: m.buyDate,
        buyPrice: m.buyPrice,
        totalBuyQty: 0,
        totalPnL: 0,
        isOpen: false,
        currentRemainQty: 0,
        sells: [],
      });
    }

    const group = groupedMap.get(key);

    if (m.sellPrice !== null) {
      const rawSell = stats?.trades.find(
        (t) => t.date === m.sellDate && t.ticker === m.ticker && (t.type === "Sell" || t.type === "Cover")
      );

      group.sells.push({
        id: m.id,
        sellDate: m.sellDate,
        sellPrice: m.sellPrice,
        soldQty: m.soldQty,
        remainQty: m.remainQty,
        pnl: m.pnl,
        note: rawSell?.notes,
      });
      group.totalBuyQty += m.soldQty;
      group.totalPnL += (m.pnl || 0);
    } else {
      group.isOpen = true;
      group.currentRemainQty += m.remainQty;
      group.totalBuyQty += m.remainQty;
    }
  });

  const sortedGroupedTrades = Array.from(groupedMap.values()).sort(
    (a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()
  );

  const openTrades = sortedGroupedTrades.filter((g) => g.isOpen);
  const closedTrades = sortedGroupedTrades.filter((g) => !g.isOpen);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] text-white pb-20">
      
      {/* ── Header ── */}
      <header className="border-b border-[hsl(0,0%,16%)] bg-[hsl(0,0%,8%)] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <BookOpen className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-wide text-neutral-100">Dashboard</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-neutral-400 hover:text-white hover:bg-white/5 h-8 w-8 p-0"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* ── Summary & Sharing ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)] flex flex-col justify-center">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className={`h-4 w-4 ${totalRealizedPnL >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Net Realized P&L</span>
              </div>
              <p className={`text-3xl font-bold tracking-tight ${totalRealizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalRealizedPnL > 0 ? "+" : ""}{formatINR(totalRealizedPnL)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)] col-span-1 md:col-span-2">
             <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full items-center">
               <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Share Link</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareUrl}
                      className="h-8 bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-neutral-300 text-xs"
                    />
                    <Button size="sm" onClick={handleCopyShare} className="h-8 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 shrink-0">
                      {shareUrlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
               </div>
               <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Add Friend</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste token..."
                      value={friendToken}
                      onChange={(e) => setFriendToken(e.target.value)}
                      className="h-8 bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddFriend}
                      disabled={addFriendMutation.isPending || !friendToken.trim()}
                      className="h-8 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 hover:text-purple-300 shrink-0"
                    >
                      Add
                    </Button>
                  </div>
               </div>
             </CardContent>
          </Card>
        </div>

        {/* ── Friends ── */}
        {friendsData && friendsData.friends.length > 0 && (
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-300">Your Friends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {friendsData.friends.map((friend) => (
                  <Link
                    key={friend.id}
                    to={`/friend/${friend.shareToken}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] text-sm text-neutral-300 hover:text-white hover:border-emerald-500/30 transition-colors"
                  >
                    <Users className="h-3.5 w-3.5 text-purple-400" />
                    {friend.name}
                    <ArrowRight className="h-3 w-3 text-neutral-600" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs for Journal vs Raw Data ── */}
        <Tabs defaultValue="journal" className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 px-1">
            <TabsList className="bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,18%)] p-1 w-full sm:w-auto h-auto sm:h-9 flex items-center justify-between">
              <TabsTrigger value="journal" className="flex-1 sm:flex-none py-1.5 sm:py-0 data-[state=active]:bg-[hsl(0,0%,16%)] data-[state=active]:text-white text-neutral-400 text-xs sm:text-sm transition-all">
                Journal View
              </TabsTrigger>
              <TabsTrigger value="raw" className="flex-1 sm:flex-none py-1.5 sm:py-0 data-[state=active]:bg-[hsl(0,0%,16%)] data-[state=active]:text-white text-neutral-400 text-xs sm:text-sm transition-all ml-1">
                Manage Entries
              </TabsTrigger>
            </TabsList>
            
            <Link to="/trades/new" className="w-full sm:w-auto">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold w-full sm:w-auto shadow-lg shadow-emerald-900/10">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Entry
              </Button>
            </Link>
          </div>

          {/* ── Tab 1: Journal View (Partitioned) ── */}
          <TabsContent value="journal" className="space-y-10 outline-none">
            
            {/* Section 1: Open Positions */}
            {openTrades.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 py-2">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500 whitespace-nowrap">
                    Open Positions
                  </h2>
                  <div className="h-px w-full bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
                </div>
                {openTrades.map((group) => {
                  const dayJournal = journalEntries.find(j => toDateKey(j.date) === toDateKey(group.buyDate));
                  const mistakesList = dayJournal?.mistakes ? dayJournal.mistakes.split(",").filter(Boolean) : [];
                  return (
                    <UserTradeCard 
                      key={group.id} 
                      group={group} 
                      dayJournal={dayJournal} 
                      mistakesList={mistakesList} 
                      onSetClosingTrade={setClosingTrade}
                    />
                  );
                })}
              </div>
            )}

            {/* Section 2: Completed History */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 py-2">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500 whitespace-nowrap">
                  Completed History
                </h2>
                <div className="h-px w-full bg-gradient-to-r from-neutral-500/20 to-transparent"></div>
              </div>
              {closedTrades.map((group) => {
                const dayJournal = journalEntries.find(j => toDateKey(j.date) === toDateKey(group.buyDate));
                const mistakesList = dayJournal?.mistakes ? dayJournal.mistakes.split(",").filter(Boolean) : [];
                return (
                  <UserTradeCard 
                    key={group.id} 
                    group={group} 
                    dayJournal={dayJournal} 
                    mistakesList={mistakesList} 
                    onSetClosingTrade={setClosingTrade}
                  />
                );
              })}
            </div>

            {sortedGroupedTrades.length === 0 && !statsLoading && (
              <div className="text-center py-20 bg-[hsl(0,0%,9%)] border border-white/5 rounded-xl shadow-xl">
                <BookOpen className="h-12 w-12 text-neutral-800 mx-auto mb-4" />
                <h3 className="text-lg font-black tracking-tight text-neutral-500 uppercase">Your journal is empty</h3>
                <p className="text-neutral-600 text-xs mt-1">Log your first trade to start tracking your journey.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Raw Data (Manage Entries) ── */}
          <TabsContent value="raw" className="outline-none">
            <Card className="bg-[hsl(0,0%,9%)] border-[hsl(0,0%,16%)] overflow-hidden shadow-xl">
              <CardContent className="p-0 overflow-x-auto no-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(0,0%,11%)]">
                    <tr className="text-neutral-500 border-b border-[hsl(0,0%,16%)] text-[10px] uppercase font-black tracking-widest">
                      <th className="text-left py-4 px-5">Date</th>
                      <th className="text-left py-4 px-5">Type</th>
                      <th className="text-left py-4 px-5">Ticker</th>
                      <th className="text-right py-4 px-5">Qty</th>
                      <th className="text-right py-4 px-5">Price</th>
                      <th className="text-right py-4 px-5 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(0,0%,14%)]">
                    {[...rawTrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((trade) => (
                      <tr key={trade.id} className="hover:bg-[hsl(0,0%,12%)] transition-colors">
                        <td className="py-4 px-5 text-neutral-300 whitespace-nowrap text-xs">
                          {formatDateTimeShort(trade.date)}
                        </td>
                        <td className="py-4 px-5">
                          <Badge variant="outline" className={`text-[9px] uppercase font-black px-1.5 h-4 border-none ${trade.type === "Buy" || trade.type === "Cover" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                            {trade.type}
                          </Badge>
                        </td>
                        <td className="py-4 px-5 font-bold text-white text-xs">{trade.ticker}</td>
                        <td className="py-4 px-5 text-right text-neutral-300 text-xs">{trade.quantity}</td>
                        <td className="py-4 px-5 text-right text-neutral-300 text-xs">{formatINR(Number(trade.price))}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-white hover:bg-[hsl(0,0%,16%)]" 
                              onClick={() => setEditTrade({ ...trade })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400 hover:bg-red-500/10" 
                              onClick={() => { 
                                if (confirm("Delete this entry? matched cards will recalculate.")) {
                                  deleteMutation.mutate({ id: trade.id }); 
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      {/* ── Modals ── */}
      {closingTrade && (
        <Dialog open={!!closingTrade} onOpenChange={(open) => !open && setClosingTrade(null)}>
          <DialogContent className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-white max-w-sm ring-1 ring-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                 Close Position: <span className="text-emerald-400">{closingTrade.ticker}</span>
              </DialogTitle>
              <DialogDescription className="text-neutral-400 text-xs">
                You are closing your {closingTrade.side} position.
              </DialogDescription>
            </DialogHeader>
            <CloseTradeForm 
               trade={closingTrade}
               isPending={createMutation.isPending}
               onSave={(data: any) => createMutation.mutate(data)} 
               onCancel={() => setClosingTrade(null)} 
            />
          </DialogContent>
        </Dialog>
      )}

      {editTrade && (
        <Dialog open={!!editTrade} onOpenChange={(open) => !open && setEditTrade(null)}>
          <DialogContent className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-white max-w-sm ring-1 ring-white/10">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Edit Entry</DialogTitle>
              <DialogDescription className="text-neutral-400 text-xs">
                Warning: Editing quantities will alter FIFO matched cards.
              </DialogDescription>
            </DialogHeader>
            <EditTradeForm 
               trade={editTrade}
               isPending={updateMutation.isPending}
               onSave={(data: any) => updateMutation.mutate({ id: editTrade.id, ...data, quantity: Number(data.quantity), price: Number(data.price) })} 
               onCancel={() => setEditTrade(null)} 
            />
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

// ── Components ──

function CloseTradeForm({ trade, onSave, onCancel, isPending }: any) {
  const [qty, setQty] = useState(String(trade.remainQty));
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(getLocalDatetime());
  const [notes, setNotes] = useState("");
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSave({
        type: trade.side === "Long" ? "Sell" : "Cover",
        ticker: trade.ticker,
        quantity: Number(qty),
        price: Number(price),
        date: new Date(date).toISOString(),
        notes: notes.trim() ? notes.trim() : ""
      });
    }} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest">Quantity</Label>
          <Input type="number" min="1" max={trade.remainQty} value={qty} onChange={(e) => setQty(e.target.value)} required className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" />
        </div>
        <div className="space-y-2">
          <Label className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest">Exit Price</Label>
          <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest">Date & Time</Label>
        <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white [&::-webkit-calendar-picker-indicator]:invert" />
      </div>
      <div className="space-y-2">
        <Label className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest">Reason / Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white placeholder:text-neutral-600 text-sm" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[hsl(0,0%,24%)] bg-transparent text-neutral-300">Cancel</Button>
        <Button type="submit" disabled={isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm
        </Button>
      </div>
    </form>
  );
}

function EditTradeForm({ trade, onSave, onCancel, isPending }: any) {
  const [form, setForm] = useState({ ...trade, date: getLocalDatetime(trade.date) });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, date: new Date(form.date).toISOString() }); }} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Type</Label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full h-9 rounded-md bg-[hsl(0,0%,16%)] border border-[hsl(0,0%,24%)] text-white text-sm px-3 outline-none">
            {["Buy", "Sell", "Short", "Cover"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Ticker</Label>
          <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Quantity</Label>
          <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Price</Label>
          <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Date & Time</Label>
        <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white [&::-webkit-calendar-picker-indicator]:invert" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[hsl(0,0%,24%)] bg-transparent text-neutral-300">Cancel</Button>
        <Button type="submit" disabled={isPending} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Save</Button>
      </div>
    </form>
  );
}
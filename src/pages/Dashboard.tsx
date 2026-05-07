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
  TrendingUp, Copy, Check, ArrowRight, Loader2, Pencil, Trash2, ChevronDown, ChevronUp
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

// Converts a Date to YYYY-MM-DDThh:mm format for the HTML datetime-local input
function getLocalDatetime(dateInput?: string | Date) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  // Group partial sells into a single Trade Card based on original Buy Date & Ticker
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
      // Find the specific sell note from the raw trades list
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

  // Sort groups newest to oldest by buy date
  const sortedGroupedTrades = Array.from(groupedMap.values()).sort(
    (a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()
  );

  // Partition into Open vs Closed
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
        
        {/* ── Top Summary / Sharing ── */}
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

        {/* ── Friends List ── */}
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
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,18%)] p-1">
              <TabsTrigger value="journal" className="data-[state=active]:bg-[hsl(0,0%,16%)] data-[state=active]:text-white text-neutral-400">
                Journal View
              </TabsTrigger>
              <TabsTrigger value="raw" className="data-[state=active]:bg-[hsl(0,0%,16%)] data-[state=active]:text-white text-neutral-400">
                Manage Entries (Edit)
              </TabsTrigger>
            </TabsList>
            
            <Link to="/trades/new">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Entry
              </Button>
            </Link>
          </div>

          {/* ── Tab 1: Journal View (Master Cards) ── */}
          <TabsContent value="journal" className="space-y-8 outline-none">
            
            {openTrades.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Open Positions ({openTrades.length})
                </h2>
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

            {closedTrades.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-400" />
                  Closed Trades ({closedTrades.length})
                </h2>
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
            )}

            {sortedGroupedTrades.length === 0 && !statsLoading && (
              <div className="text-center py-20 bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,16%)] rounded-xl shadow-xl">
                <BookOpen className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-300">Your journal is empty</h3>
                <p className="text-neutral-500 mt-1 mb-6">Log your first trade to start tracking your journey.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Tab 2: Raw Data (Edit & Delete) ── */}
          <TabsContent value="raw" className="outline-none">
            <Card className="bg-[hsl(0,0%,9%)] border-[hsl(0,0%,16%)] overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(0,0%,11%)]">
                    <tr className="text-neutral-500 border-b border-[hsl(0,0%,16%)] text-xs uppercase tracking-wider">
                      <th className="text-left font-semibold py-3 px-4">Date</th>
                      <th className="text-left font-semibold py-3 px-4">Type</th>
                      <th className="text-left font-semibold py-3 px-4">Ticker</th>
                      <th className="text-right font-semibold py-3 px-4">Qty</th>
                      <th className="text-right font-semibold py-3 px-4">Price</th>
                      <th className="text-right font-semibold py-3 px-4 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(0,0%,14%)]">
                    {[...rawTrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((trade) => (
                      <tr key={trade.id} className="hover:bg-[hsl(0,0%,12%)] transition-colors">
                        <td className="py-3 px-4 text-neutral-300 whitespace-nowrap">
                          {formatDateTimeShort(trade.date)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-[10px] uppercase ${trade.type === "Buy" || trade.type === "Cover" ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
                            {trade.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{trade.ticker}</td>
                        <td className="py-3 px-4 text-right text-neutral-300">{trade.quantity}</td>
                        <td className="py-3 px-4 text-right text-neutral-300">{formatINR(Number(trade.price))}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-white hover:bg-[hsl(0,0%,16%)]" 
                              onClick={() => setEditTrade({ ...trade })}
                              title="Edit Entry"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-red-400 hover:bg-red-500/10" 
                              onClick={() => { 
                                if (confirm("Are you sure you want to delete this raw entry? This will recalculate your open positions.")) {
                                  deleteMutation.mutate({ id: trade.id }); 
                                }
                              }}
                              title="Delete Entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rawTrades.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-neutral-500">No entries found.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      {/* ── Modals ── */}
      
      {/* 1-Click Close Modal */}
      {closingTrade && (
        <Dialog open={!!closingTrade} onOpenChange={(open) => !open && setClosingTrade(null)}>
          <DialogContent className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                 Close Position: <span className="text-emerald-400">{closingTrade.ticker}</span>
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
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

      {/* Edit Raw Trade Modal */}
      {editTrade && (
        <Dialog open={!!editTrade} onOpenChange={(open) => !open && setEditTrade(null)}>
          <DialogContent className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-white max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Entry</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Warning: Editing quantities or prices will automatically alter your matched FIFO cards.
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

function UserTradeCard({ group, dayJournal, mistakesList, onSetClosingTrade }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = group.side === "Long";
  const capitalInvested = group.totalBuyQty * group.buyPrice;

  return (
    <Card className="bg-[hsl(0,0%,9%)] border-[hsl(0,0%,16%)] overflow-hidden shadow-xl transition-all duration-200">
       
       {/* Clickable Header */}
       <div 
         className="bg-[hsl(0,0%,11%)] border-b border-[hsl(0,0%,16%)] p-4 flex justify-between items-center cursor-pointer hover:bg-[hsl(0,0%,13%)] transition-colors select-none"
         onClick={() => setIsExpanded(!isExpanded)}
       >
          <div className="flex items-center gap-3">
             <div className={`w-1.5 h-6 rounded-full ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
             <h3 className="text-lg font-bold text-white">{group.ticker}</h3>
             <Badge variant="outline" className={`text-[10px] uppercase ${isLong ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
               {group.side}
             </Badge>
             <span className="text-sm text-neutral-400 ml-2 hidden sm:inline-block">
                {formatDateTimeShort(group.buyDate)}
             </span>
          </div>
          <div className="flex items-center gap-4">
             {/* Quick Summary in Header */}
             {!group.isOpen && (
               <span className={`text-sm font-medium hidden sm:inline-block ${group.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                 {group.totalPnL >= 0 ? "+" : ""}{formatINR(group.totalPnL)}
               </span>
             )}
             {group.isOpen ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 bg-[hsl(0,0%,12%)] border-[hsl(0,0%,24%)] hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-colors text-neutral-300"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onSetClosingTrade({ ticker: group.ticker, side: group.side, remainQty: group.currentRemainQty }); 
                  }}
                >
                  Close Position
                </Button>
             ) : (
                <Badge className="bg-neutral-800 text-neutral-400 font-medium">Closed</Badge>
             )}
             <div className="bg-[hsl(0,0%,16%)] rounded p-1">
               {isExpanded ? <ChevronUp className="h-4 w-4 text-neutral-300" /> : <ChevronDown className="h-4 w-4 text-neutral-300" />}
             </div>
          </div>
       </div>

       {/* Expanded Body */}
       {isExpanded && (
         <CardContent className="p-0 animate-in slide-in-from-top-2 duration-200">
            {/* Buy Details Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 sm:p-5 border-b border-[hsl(0,0%,16%)]">
                <div>
                   <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Buy Date</p>
                   <p className="text-sm text-neutral-200">{formatDateTimeShort(group.buyDate)}</p>
                </div>
                <div>
                   <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Buy Price</p>
                   <p className="text-sm text-neutral-200">{formatINR(group.buyPrice)}</p>
                </div>
                <div>
                   <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Quantity</p>
                   <p className="text-sm text-neutral-200">{group.totalBuyQty}</p>
                </div>
                <div>
                   <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Capital Invested</p>
                   <p className="text-sm text-neutral-200">{formatINR(capitalInvested)}</p>
                </div>
                <div>
                   <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Realized P&L</p>
                   <p className={`text-sm font-medium ${group.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                     {group.totalPnL >= 0 ? "+" : ""}{formatINR(group.totalPnL)}
                   </p>
                </div>
            </div>

            {/* Sell Details Rows */}
            {group.sells.map((sell: any, index: number) => (
                <div key={index} className="flex flex-col border-b border-[hsl(0,0%,16%)] bg-[hsl(0,0%,10.5%)]">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 sm:p-5">
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Sell Date</p>
                          <p className="text-sm text-neutral-300">{formatDateTimeShort(sell.sellDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Sell Price</p>
                          <p className="text-sm text-neutral-300">{formatINR(sell.sellPrice)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Sold Qty</p>
                          <p className="text-sm text-neutral-300">{sell.soldQty}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">Remain Qty</p>
                          <p className="text-sm text-orange-400">{sell.remainQty}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-1">P&L</p>
                          <p className={`text-sm font-medium ${sell.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {sell.pnl >= 0 ? "+" : ""}{formatINR(sell.pnl)}
                          </p>
                        </div>
                    </div>
                    {sell.note && (
                        <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-sm text-neutral-300 bg-[hsl(0,0%,10.5%)]">
                            <span className="text-amber-400 font-semibold mr-2 uppercase text-[10px]">Sell Note:</span>
                            {sell.note}
                        </div>
                    )}
                </div>
            ))}

            {/* Psychology / Journal Section */}
            {(dayJournal || mistakesList.length > 0) && (
                <div className="p-4 sm:p-5 bg-[hsl(0,0%,8%)] space-y-4">
                    {dayJournal && (
                        <div className="flex flex-wrap gap-3">
                           {dayJournal.marketSentiment && (
                               <Badge variant="outline" className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-neutral-300 py-1">
                                   Sentiment: <span className="ml-1 font-semibold text-white">{dayJournal.marketSentiment}</span>
                               </Badge>
                           )}
                           {dayJournal.mentalState && (
                               <Badge variant="outline" className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-neutral-300 py-1">
                                   <Brain className="h-3 w-3 mr-1.5 text-sky-400"/> Mental: <span className="ml-1 font-semibold text-white">{dayJournal.mentalState}/10</span>
                               </Badge>
                           )}
                           {dayJournal.energyLevel && (
                               <Badge variant="outline" className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,20%)] text-neutral-300 py-1">
                                   <Zap className="h-3 w-3 mr-1.5 text-yellow-400"/> Energy: <span className="ml-1 font-semibold text-white">{dayJournal.energyLevel}/10</span>
                               </Badge>
                           )}
                        </div>
                    )}

                    {mistakesList.length > 0 && (
                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-2 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-red-400" />
                              Mistakes & Violations
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {mistakesList.map((m: string) => (
                                <Badge key={m} variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10 py-1">
                                  {m}
                                </Badge>
                              ))}
                            </div>
                        </div>
                    )}

                    {dayJournal?.observations && (
                        <div>
                            <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-2 flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-amber-400" />
                              Observations / Notes
                            </p>
                            <div className="bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] rounded-lg p-3">
                              <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                {dayJournal.observations}
                              </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
         </CardContent>
       )}
    </Card>
  );
}

// ── Form Components ──

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
          <Label className="text-neutral-400 text-xs">Quantity</Label>
          <Input 
            type="number" 
            min="1" 
            max={trade.remainQty} 
            value={qty} 
            onChange={(e) => setQty(e.target.value)} 
            required 
            className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-neutral-400 text-xs">Closing Price (₹)</Label>
          <Input 
            type="number" 
            step="0.01" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)} 
            required 
            className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" 
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-neutral-400 text-xs">Closing Date & Time</Label>
        <Input 
          type="datetime-local" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          required 
          className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white [&::-webkit-calendar-picker-indicator]:invert" 
        />
      </div>

      <div className="space-y-2">
        <Label className="text-neutral-400 text-xs">Closing Notes (Optional)</Label>
        <Input 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          placeholder="Reason for closing this position..."
          className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white placeholder:text-neutral-600 text-sm" 
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[hsl(0,0%,24%)] bg-transparent text-neutral-300 hover:bg-[hsl(0,0%,18%)] text-white">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Close
        </Button>
      </div>
    </form>
  );
}

function EditTradeForm({ trade, onSave, onCancel, isPending }: any) {
  const [form, setForm] = useState({ ...trade, date: getLocalDatetime(trade.date) });
  
  return (
    <form onSubmit={(e) => { 
      e.preventDefault(); 
      onSave({ ...form, date: new Date(form.date).toISOString() }); 
    }} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-neutral-400">Type</Label>
          <select 
            value={form.type} 
            onChange={(e) => setForm({ ...form, type: e.target.value })} 
            className="w-full h-9 rounded-md bg-[hsl(0,0%,16%)] border border-[hsl(0,0%,24%)] text-white text-sm px-3 outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {["Buy", "Sell", "Short", "Cover"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-neutral-400">Ticker</Label>
          <Input 
            value={form.ticker} 
            onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} 
            className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white uppercase" 
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-neutral-400">Quantity</Label>
          <Input 
            type="number" 
            value={form.quantity} 
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} 
            className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-neutral-400">Price (₹)</Label>
          <Input 
            type="number" 
            step="0.01" 
            value={form.price} 
            onChange={(e) => setForm({ ...form, price: e.target.value })} 
            className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white" 
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-neutral-400 text-xs">Date & Time</Label>
        <Input 
          type="datetime-local" 
          value={form.date} 
          onChange={(e) => setForm({ ...form, date: e.target.value })} 
          required 
          className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white [&::-webkit-calendar-picker-indicator]:invert" 
        />
      </div>

      <div className="space-y-2">
        <Label className="text-neutral-400 text-xs">Notes</Label>
        <Input 
          value={form.notes} 
          onChange={(e) => setForm({ ...form, notes: e.target.value })} 
          placeholder="Edit note..."
          className="bg-[hsl(0,0%,16%)] border-[hsl(0,0%,24%)] text-white placeholder:text-neutral-600 text-sm" 
        />
      </div>
      
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-[hsl(0,0%,24%)] bg-transparent text-neutral-300 hover:bg-[hsl(0,0%,18%)] text-white">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
        </Button>
      </div>
    </form>
  );
}
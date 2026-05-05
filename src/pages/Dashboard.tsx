import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, LogOut, Share2, Users, AlertTriangle, BookOpen, Brain, Zap,
  TrendingUp, Clock, Copy, Check
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

// ── Helpers ──
function toDateKey(d: string) { return d.slice(0, 10); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
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

  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [friendToken, setFriendToken] = useState("");

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
  const journalEntries = journalData?.entries ?? [];
  
  // Group matched trades by date. We use sellDate if available, else buyDate.
  const tradesByDate: Record<string, typeof matchedTrades> = {};
  matchedTrades.forEach((t) => {
    const dKey = toDateKey(t.sellDate || t.buyDate);
    if (!tradesByDate[dKey]) tradesByDate[dKey] = [];
    tradesByDate[dKey].push(t);
  });

  // Get all unique dates from trades and journals, sorted descending
  const allDates = Array.from(
    new Set([
      ...Object.keys(tradesByDate),
      ...journalEntries.map(j => toDateKey(j.date))
    ])
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const totalRealizedPnL = stats?.totalRealizedPnL ?? 0;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] text-white pb-20">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,16%)] bg-[hsl(0,0%,8%)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <BookOpen className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-wide text-neutral-100">Day Trader's Journal</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/trades/new">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3">
                <Plus className="h-4 w-4 mr-1.5" />
                New Entry
              </Button>
            </Link>
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Summary / Sharing */}
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

        {/* The Ledger / Journal Entries */}
        <div className="space-y-12">
          {allDates.length === 0 && !statsLoading && (
            <div className="text-center py-20">
              <BookOpen className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-300">Your journal is empty</h3>
              <p className="text-neutral-500 mt-1 mb-6">Log your first trade to start tracking your journey.</p>
              <Link to="/trades/new">
                <Button className="bg-emerald-600 hover:bg-emerald-500">Log Trade</Button>
              </Link>
            </div>
          )}

          {allDates.map((date) => {
            const dayTrades = tradesByDate[date] || [];
            const dayJournal = journalEntries.find(j => toDateKey(j.date) === date);
            
            // Calculate Day PnL
            const dayPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            
            const mistakesList = dayJournal?.mistakes ? dayJournal.mistakes.split(",").filter(Boolean) : [];

            return (
              <div key={date} className="relative">
                {/* Date Header string across the ledger */}
                <div className="flex items-center mb-6">
                  <div className="shrink-0 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    {formatDate(date)}
                  </div>
                  <div className="ml-4 h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
                </div>

                <div className="bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,16%)] rounded-xl overflow-hidden shadow-xl">
                  
                  {/* Journal Top Metrics */}
                  {(dayJournal || dayPnL !== 0) && (
                    <div className="bg-[hsl(0,0%,11%)] border-b border-[hsl(0,0%,16%)] p-4 sm:p-5 grid grid-cols-2 md:grid-cols-6 gap-4">
                      {/* P&L */}
                      <div className="md:col-span-1">
                        <p className="text-[10px] text-neutral-500 uppercase font-semibold tracking-wider mb-1">Day P&L</p>
                        <p className={`text-lg font-bold ${dayPnL > 0 ? "text-emerald-400" : dayPnL < 0 ? "text-red-400" : "text-neutral-300"}`}>
                          {dayPnL > 0 ? "+" : ""}{formatINR(dayPnL)}
                        </p>
                      </div>
                      
                      {/* Finances */}
                      <div className="md:col-span-2 flex items-center justify-between bg-[hsl(0,0%,14%)] rounded-lg p-3 border border-[hsl(0,0%,18%)]">
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold">Starting</p>
                          <p className="text-sm font-medium text-neutral-300">{dayJournal?.startingBalance ? formatINR(Number(dayJournal.startingBalance)) : "—"}</p>
                        </div>
                        <div className="h-8 w-px bg-[hsl(0,0%,20%)]"></div>
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold">Closing</p>
                          <p className="text-sm font-medium text-neutral-300">{dayJournal?.closingBalance ? formatINR(Number(dayJournal.closingBalance)) : "—"}</p>
                        </div>
                        <div className="h-8 w-px bg-[hsl(0,0%,20%)]"></div>
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold">Brokerage</p>
                          <p className="text-sm font-medium text-neutral-300">{dayJournal?.totalBrokerage ? formatINR(Number(dayJournal.totalBrokerage)) : "—"}</p>
                        </div>
                      </div>

                      {/* Psychology */}
                      <div className="col-span-2 md:col-span-3 grid grid-cols-3 gap-2">
                        <div className="bg-[hsl(0,0%,14%)] rounded-lg p-2.5 border border-[hsl(0,0%,18%)] flex flex-col justify-center items-center text-center">
                           <p className="text-[10px] text-neutral-500 uppercase font-semibold flex items-center gap-1 mb-1"><Brain className="h-3 w-3"/> Mental</p>
                           {dayJournal?.mentalState ? (
                             <Badge variant="outline" className={`text-xs ${Number(dayJournal.mentalState) >= 7 ? "text-emerald-400 border-emerald-500/30" : Number(dayJournal.mentalState) >= 4 ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30"}`}>
                               {dayJournal.mentalState}/10
                             </Badge>
                           ) : <span className="text-xs text-neutral-600">—</span>}
                        </div>
                        <div className="bg-[hsl(0,0%,14%)] rounded-lg p-2.5 border border-[hsl(0,0%,18%)] flex flex-col justify-center items-center text-center">
                           <p className="text-[10px] text-neutral-500 uppercase font-semibold flex items-center gap-1 mb-1"><Zap className="h-3 w-3"/> Energy</p>
                           {dayJournal?.energyLevel ? (
                             <Badge variant="outline" className={`text-xs ${Number(dayJournal.energyLevel) >= 7 ? "text-emerald-400 border-emerald-500/30" : Number(dayJournal.energyLevel) >= 4 ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30"}`}>
                               {dayJournal.energyLevel}/10
                             </Badge>
                           ) : <span className="text-xs text-neutral-600">—</span>}
                        </div>
                        <div className="bg-[hsl(0,0%,14%)] rounded-lg p-2.5 border border-[hsl(0,0%,18%)] flex flex-col justify-center items-center text-center">
                           <p className="text-[10px] text-neutral-500 uppercase font-semibold flex items-center gap-1 mb-1">Sentiment</p>
                           {dayJournal?.marketSentiment ? (
                             <span className={`text-xs font-semibold ${dayJournal.marketSentiment === 'Bullish' ? 'text-emerald-400' : dayJournal.marketSentiment === 'Bearish' ? 'text-red-400' : dayJournal.marketSentiment === 'Volatile' ? 'text-orange-400' : 'text-blue-400'}`}>
                               {dayJournal.marketSentiment}
                             </span>
                           ) : <span className="text-xs text-neutral-600">—</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Matched Trade Book Table */}
                  {dayTrades.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[hsl(0,0%,6%)] border-b border-[hsl(0,0%,16%)] text-[11px] uppercase tracking-wider text-neutral-400">
                            <th className="text-left font-semibold py-3 px-4">Share Name</th>
                            <th className="text-left font-semibold py-3 px-4">Buy Details</th>
                            <th className="text-left font-semibold py-3 px-4">Sell Details</th>
                            <th className="text-right font-semibold py-3 px-4">Sold Qty</th>
                            <th className="text-right font-semibold py-3 px-4">Remain Qty</th>
                            <th className="text-right font-semibold py-3 px-4">P/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(0,0%,14%)]">
                          {dayTrades.map((m) => {
                            // const isOpen = m.sellPrice === null;
                            const isLong = m.side === "Long";
                            const pnlColor = m.pnl === null ? "text-neutral-500" : m.pnl >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium";
                            
                            return (
                              <tr key={m.id} className="hover:bg-[hsl(0,0%,11%)] transition-colors group">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1 h-4 rounded-full ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                    <span className="font-semibold text-neutral-200">{m.ticker}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-col">
                                    <span className="text-neutral-300 font-medium">{formatINR(m.buyPrice)}</span>
                                    <span className="text-xs text-neutral-500 flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> {formatTime(m.buyDate)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {m.sellPrice !== null && m.sellDate !== null ? (
                                    <div className="flex flex-col">
                                      <span className="text-neutral-300 font-medium">{formatINR(m.sellPrice)}</span>
                                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {formatTime(m.sellDate)}
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/30 bg-orange-500/10">OPEN</Badge>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right text-neutral-300">{m.soldQty > 0 ? m.soldQty : "—"}</td>
                                <td className="py-3 px-4 text-right">
                                  <span className={`${m.remainQty > 0 ? "text-orange-400 font-medium" : "text-neutral-500"}`}>
                                    {m.remainQty}
                                  </span>
                                </td>
                                <td className={`py-3 px-4 text-right ${pnlColor}`}>
                                  {m.pnl !== null ? formatINR(m.pnl) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                     <div className="p-8 text-center text-sm text-neutral-500 border-b border-[hsl(0,0%,16%)]">
                       No trades executed on this day.
                     </div>
                  )}

                  {/* Mistakes & Observations */}
                  {(mistakesList.length > 0 || dayJournal?.observations) && (
                    <div className="p-4 sm:p-5 bg-[hsl(0,0%,10%)] flex flex-col gap-4">
                      {mistakesList.length > 0 && (
                        <div>
                          <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-red-400" />
                            Mistakes & Violations
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {mistakesList.map(m => (
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
                          <div className="bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,18%)] rounded-lg p-3">
                            <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                              {dayJournal.observations}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
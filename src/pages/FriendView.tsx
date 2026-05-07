import { useState } from "react";
import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { formatINR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Eye,
  TrendingUp,
  TrendingDown,
  Shield,
  Loader2,
  User,
  BarChart3,
  Brain,
  Zap,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp
} from "lucide-react";

// ── Helpers ──
function toDateKey(d: string) { return d.slice(0, 10); }

function formatDateTimeShort(d: string) {
  const date = new Date(d);
  const datePart = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

// Frontend FIFO Engine for Read-Only matching
function buildMatchedTrades(trades: any[]) {
  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const buyLots: Record<string, any[]> = {};
  const shortLots: Record<string, any[]> = {};
  const matched: any[] = [];
  let rowIdx = 0;

  for (const t of sorted) {
    const qty = Number(t.quantity);
    const price = Number(t.price);
    const ticker = t.ticker;

    if (t.type === "Buy") {
      if (!buyLots[ticker]) buyLots[ticker] = [];
      buyLots[ticker].push({ qty, price, date: t.date });
    } else if (t.type === "Sell") {
      if (!buyLots[ticker]) buyLots[ticker] = [];
      let remaining = qty;
      while (remaining > 0 && buyLots[ticker].length > 0) {
        const lot = buyLots[ticker][0];
        const matched_qty = Math.min(remaining, lot.qty);
        const pnl = matched_qty * (price - lot.price);
        matched.push({ id: `m-${rowIdx++}`, ticker, side: "Long", buyPrice: lot.price, buyDate: lot.date, sellPrice: price, sellDate: t.date, soldQty: matched_qty, remainQty: lot.qty - matched_qty, pnl });
        lot.qty -= matched_qty;
        remaining -= matched_qty;
        if (lot.qty <= 0) buyLots[ticker].shift();
      }
    } else if (t.type === "Short") {
      if (!shortLots[ticker]) shortLots[ticker] = [];
      shortLots[ticker].push({ qty, price, date: t.date });
    } else if (t.type === "Cover") {
      if (!shortLots[ticker]) shortLots[ticker] = [];
      let remaining = qty;
      while (remaining > 0 && shortLots[ticker].length > 0) {
        const lot = shortLots[ticker][0];
        const matched_qty = Math.min(remaining, lot.qty);
        const pnl = matched_qty * (lot.price - price);
        matched.push({ id: `m-${rowIdx++}`, ticker, side: "Short", buyPrice: lot.price, buyDate: lot.date, sellPrice: price, sellDate: t.date, soldQty: matched_qty, remainQty: lot.qty - matched_qty, pnl });
        lot.qty -= matched_qty;
        remaining -= matched_qty;
        if (lot.qty <= 0) shortLots[ticker].shift();
      }
    }
  }

  for (const [ticker, lots] of Object.entries(buyLots)) {
    for (const lot of lots) if (lot.qty > 0) matched.push({ id: `m-${rowIdx++}`, ticker, side: "Long", buyPrice: lot.price, buyDate: lot.date, sellPrice: null, sellDate: null, soldQty: 0, remainQty: lot.qty, pnl: null });
  }
  for (const [ticker, lots] of Object.entries(shortLots)) {
    for (const lot of lots) if (lot.qty > 0) matched.push({ id: `m-${rowIdx++}`, ticker, side: "Short", buyPrice: lot.price, buyDate: lot.date, sellPrice: null, sellDate: null, soldQty: 0, remainQty: lot.qty, pnl: null });
  }

  return matched;
}

// ── The "Premium" Trade Card Component (Read-Only) ──
function FriendTradeCard({ group, dayJournal, mistakesList }: { group: any, dayJournal: any, mistakesList: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = group.side === "Long";
  const capitalInvested = group.totalBuyQty * group.buyPrice;

  return (
    <Card className="bg-[hsl(0,0%,9%)] border-[hsl(0,0%,15%)] overflow-hidden shadow-2xl transition-all duration-300 ring-1 ring-white/5">
      
      {/* ── Compact Header ── */}
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

      {/* ── Expanded Detail (Timeline Logic) ── */}
      {isExpanded && (
        <CardContent className="p-0 border-t border-white/5 bg-[hsl(0,0%,8%)] animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* Main Stats Grid */}
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
                <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-1">Status</p>
                <p className={`text-[10px] font-bold ${group.isOpen ? 'text-orange-400' : 'text-neutral-500'}`}>
                  {group.isOpen ? 'STILL OPEN' : 'TRADING COMPLETE'}
                </p>
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

export default function FriendView() {
  const { shareToken } = useParams<{ shareToken: string }>();

  const { data, isLoading, error } = trpc.friend.viewByToken.useQuery(
    { shareToken: shareToken! },
    { enabled: !!shareToken, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,6%)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !data || !data.success) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,6%)] flex items-center justify-center px-4">
        <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)] max-w-sm w-full">
          <CardContent className="py-12 text-center">
            <Shield className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <p className="text-white font-medium">Invalid Share Link</p>
            <p className="text-neutral-400 text-sm mt-1">
              This portfolio link is invalid or has been revoked.
            </p>
            <Link to="/dashboard" className="mt-4 inline-block">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const friend = data.friend;
  const rawTrades = data.trades;
  const journalEntries = data.journalEntries ?? [];

  const matchedTrades = buildMatchedTrades(rawTrades);

  // Group matched trades into beautiful Master Cards
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
      const rawSell = rawTrades.find(
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

  // Partition into Open vs Completed
  const openTrades = sortedGroupedTrades.filter((g) => g.isOpen);
  const closedTrades = sortedGroupedTrades.filter((g) => !g.isOpen);

  // Calculate Header Stats
  const totalRealized = Array.from(groupedMap.values()).reduce((sum, g) => sum + g.totalPnL, 0);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] text-white pb-20">
      <header className="border-b border-[hsl(0,0%,16%)] bg-[hsl(0,0%,8%)] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white h-8 px-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.3)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hidden sm:inline">Read-Only View</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Friend Profile Banner */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-600/5 to-purple-600/5 border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-all duration-500"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="h-14 w-14 rounded-full bg-[hsl(0,0%,12%)] border border-white/10 flex items-center justify-center ring-4 ring-white/5 shadow-inner">
              <User className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">{friend.name}</h1>
                <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400 bg-blue-500/10 font-black uppercase tracking-wider h-4">
                  PRO PORTFOLIO
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">Viewing shared diary & setup history</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-[hsl(0,0%,10%)] border-white/5 flex flex-col justify-center ring-1 ring-white/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className={`h-3.5 w-3.5 ${totalRealized >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-black">Net Realized P&L</span>
              </div>
              <p className={`text-2xl font-black tracking-tighter ${totalRealized >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalRealized >= 0 ? "+" : ""}{formatINR(totalRealized)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0,0%,10%)] border-white/5 flex flex-col justify-center ring-1 ring-white/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-black">Trade Frequency</span>
              </div>
              <p className="text-2xl font-black tracking-tighter text-neutral-100">{rawTrades.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0,0%,10%)] border-white/5 col-span-2 md:col-span-1 flex flex-col justify-center ring-1 ring-white/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-black">Active Bets</span>
              </div>
              <p className="text-2xl font-black tracking-tighter text-neutral-100">{openTrades.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Trade History Partitions ── */}
        <div className="space-y-10">
          
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
                return <FriendTradeCard key={group.id} group={group} dayJournal={dayJournal} mistakesList={mistakesList} />;
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
              return <FriendTradeCard key={group.id} group={group} dayJournal={dayJournal} mistakesList={mistakesList} />;
            })}

            {closedTrades.length === 0 && openTrades.length === 0 && !isLoading && (
              <div className="text-center py-20 bg-[hsl(0,0%,9%)] border border-white/5 rounded-xl shadow-xl ring-1 ring-white/5">
                <BookOpen className="h-12 w-12 text-neutral-800 mx-auto mb-4" />
                <h3 className="text-lg font-black tracking-tight text-neutral-500 uppercase">Journal is empty</h3>
                <p className="text-neutral-600 text-xs mt-1">Your friend hasn't logged any trades yet.</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
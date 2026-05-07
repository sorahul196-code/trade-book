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

// ── Collapsible Trade Card Component ──
function FriendTradeCard({ group, dayJournal, mistakesList }: { group: any, dayJournal: any, mistakesList: string[] }) {
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
                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 font-medium">OPEN</Badge>
             ) : (
                <Badge className="bg-neutral-800 text-neutral-400 font-medium">Closed</Badge>
             )}
             <div className="bg-[hsl(0,0%,16%)] rounded p-1">
               {isExpanded ? <ChevronUp className="h-4 w-4 text-neutral-300" /> : <ChevronDown className="h-4 w-4 text-neutral-300" />}
             </div>
          </div>
       </div>

       {/* Expandable Body */}
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

  // Calculate stats for friend
  const positionMap: Record<string, { realizedPnL: number; openQty: number }> = {};
  for (const m of matchedTrades) {
    if (!positionMap[m.ticker]) positionMap[m.ticker] = { realizedPnL: 0, openQty: 0 };
    if (m.pnl !== null) positionMap[m.ticker].realizedPnL += m.pnl;
    positionMap[m.ticker].openQty += m.remainQty;
  }

  const openPositionsCount = Object.values(positionMap).filter((p) => p.openQty > 0).length;
  const totalRealized = Object.values(positionMap).reduce((sum, p) => sum + p.realizedPnL, 0);

  // Group matched trades into the beautiful Master Cards
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

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] text-white pb-20">
      {/* Header */}
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
            <Eye className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-neutral-400 hidden sm:inline">Read-Only View</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Friend Profile Banner */}
        <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 shadow-xl">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,24%)] flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white">{friend.name}</h1>
                <Badge
                  variant="outline"
                  className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Friend&apos;s Portfolio
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                Viewing shared trade diary & journal insights
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)] flex flex-col justify-center">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className={`h-4 w-4 ${totalRealized >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Net Realized P&L</span>
              </div>
              <p className={`text-3xl font-bold tracking-tight ${totalRealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalRealized > 0 ? "+" : ""}{formatINR(totalRealized)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)] flex flex-col justify-center">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Total Trades</span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-neutral-200">
                {rawTrades.length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)] col-span-2 md:col-span-1 flex flex-col justify-center">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Active Open</span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-neutral-200">
                {openPositionsCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Trade Cards List ── */}
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-500" />
            Trade Journal
          </h2>

          {/* Map through groups and render Collapsible Trade Cards */}
          {sortedGroupedTrades.map((group) => {
            const dayJournal = journalEntries.find(j => toDateKey(j.date) === toDateKey(group.buyDate));
            const mistakesList = dayJournal?.mistakes ? dayJournal.mistakes.split(",").filter(Boolean) : [];
            
            return (
              <FriendTradeCard 
                key={group.id} 
                group={group} 
                dayJournal={dayJournal} 
                mistakesList={mistakesList} 
              />
            );
          })}

          {sortedGroupedTrades.length === 0 && !isLoading && (
            <div className="text-center py-20 bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,16%)] rounded-xl shadow-xl">
              <BookOpen className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-300">Journal is empty</h3>
              <p className="text-neutral-500 mt-1 mb-6">Your friend hasn't logged any trades yet.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
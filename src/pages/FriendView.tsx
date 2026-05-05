import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { formatINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

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
  const trades = data.trades;

  // Calculate stats for friend
  const positions: Record<
    string,
    { longQty: number; shortQty: number; longCost: number; shortCost: number; realizedPnL: number }
  > = {};

  const buyQueue: { ticker: string; qty: number; price: number }[] = [];
  const shortQueue: { ticker: string; qty: number; price: number }[] = [];

  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const t of sorted) {
    const qty = Number(t.quantity);
    const price = Number(t.price);
    const ticker = t.ticker;

    if (!positions[ticker]) {
      positions[ticker] = { longQty: 0, shortQty: 0, longCost: 0, shortCost: 0, realizedPnL: 0 };
    }

    if (t.type === "Buy") {
      buyQueue.push({ ticker, qty, price });
      positions[ticker].longQty += qty;
      positions[ticker].longCost += qty * price;
    } else if (t.type === "Sell") {
      let remaining = qty;
      while (remaining > 0 && buyQueue.length > 0) {
        const buy = buyQueue.find((b) => b.ticker === ticker);
        if (!buy) break;
        const matched = Math.min(remaining, buy.qty);
        const pnl = matched * (price - buy.price);
        positions[ticker].realizedPnL += pnl;
        buy.qty -= matched;
        remaining -= matched;
        if (buy.qty <= 0) {
          const idx = buyQueue.indexOf(buy);
          buyQueue.splice(idx, 1);
        }
      }
      positions[ticker].longQty -= qty;
      positions[ticker].longCost = Math.max(0, positions[ticker].longCost - qty * price);
    } else if (t.type === "Short") {
      shortQueue.push({ ticker, qty, price });
      positions[ticker].shortQty += qty;
      positions[ticker].shortCost += qty * price;
    } else if (t.type === "Cover") {
      let remaining = qty;
      while (remaining > 0 && shortQueue.length > 0) {
        const sh = shortQueue.find((s) => s.ticker === ticker);
        if (!sh) break;
        const matched = Math.min(remaining, sh.qty);
        const pnl = matched * (sh.price - price);
        positions[ticker].realizedPnL += pnl;
        sh.qty -= matched;
        remaining -= matched;
        if (sh.qty <= 0) {
          const idx = shortQueue.indexOf(sh);
          shortQueue.splice(idx, 1);
        }
      }
      positions[ticker].shortQty -= qty;
      positions[ticker].shortCost = Math.max(0, positions[ticker].shortCost - qty * price);
    }
  }

  const openPositions = Object.entries(positions)
    .filter(([_, p]) => p.longQty > 0 || p.shortQty > 0)
    .map(([ticker, p]) => ({
      ticker,
      netQuantity: p.longQty - p.shortQty,
      avgPrice: p.longQty > 0 ? p.longCost / p.longQty : p.shortQty > 0 ? p.shortCost / p.shortQty : 0,
      side: p.longQty > p.shortQty ? ("Long" as const) : ("Short" as const),
      realizedPnL: p.realizedPnL,
    }));

  const totalRealized = Object.values(positions).reduce((sum, p) => sum + p.realizedPnL, 0);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,16%)] bg-[hsl(0,0%,8%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Friend Profile Banner */}
        <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20">
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
                {trades.length} trades recorded
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-neutral-500" />
                <span className="text-xs text-neutral-400">Total Trades</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{trades.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-neutral-400">Realized P&L</span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${totalRealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatINR(totalRealized)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-neutral-400">Open Positions</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{openPositions.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Open Positions */}
        {openPositions.length > 0 && (
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-300">Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-neutral-500 border-b border-[hsl(0,0%,18%)]">
                      <th className="text-left font-medium py-2 px-3">Ticker</th>
                      <th className="text-left font-medium py-2 px-3">Side</th>
                      <th className="text-right font-medium py-2 px-3">Net Qty</th>
                      <th className="text-right font-medium py-2 px-3">Avg Price</th>
                      <th className="text-right font-medium py-2 px-3">Realized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((pos) => (
                      <tr key={pos.ticker} className="border-b border-[hsl(0,0%,14%)]">
                        <td className="py-2.5 px-3 font-semibold text-white">{pos.ticker}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              pos.side === "Long"
                                ? "border-emerald-500/30 text-emerald-400"
                                : "border-red-500/30 text-red-400"
                            }`}
                          >
                            {pos.side}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">{pos.netQuantity}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-300">
                          {formatINR(pos.avgPrice)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-medium ${
                            pos.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {formatINR(pos.realizedPnL)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden space-y-2">
                {openPositions.map((pos) => (
                  <div
                    key={pos.ticker}
                    className="p-3 rounded-lg bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,18%)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">{pos.ticker}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          pos.side === "Long"
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-red-500/30 text-red-400"
                        }`}
                      >
                        {pos.side}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-neutral-500">Qty</p>
                        <p className="text-white font-medium">{pos.netQuantity}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Avg Price</p>
                        <p className="text-neutral-300">{formatINR(pos.avgPrice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-neutral-500">P&L</p>
                        <p className={`font-medium ${pos.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatINR(pos.realizedPnL)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade History */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Trade History</h2>
          {trades.length === 0 ? (
            <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-400 text-sm">No trades recorded yet.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-[hsl(0,0%,16%)]">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(0,0%,10%)]">
                    <tr className="text-neutral-500 border-b border-[hsl(0,0%,16%)]">
                      <th className="text-left font-medium py-3 px-4">Date</th>
                      <th className="text-left font-medium py-3 px-4">Type</th>
                      <th className="text-left font-medium py-3 px-4">Ticker</th>
                      <th className="text-right font-medium py-3 px-4">Qty</th>
                      <th className="text-right font-medium py-3 px-4">Price</th>
                      <th className="text-left font-medium py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(0,0%,14%)]">
                    {trades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-[hsl(0,0%,11%)] transition-colors">
                        <td className="py-3 px-4 text-neutral-300 whitespace-nowrap">
                          {new Date(trade.date).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              trade.type === "Buy" || trade.type === "Cover"
                                ? "border-emerald-500/30 text-emerald-400"
                                : "border-red-500/30 text-red-400"
                            }`}
                          >
                            {trade.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{trade.ticker}</td>
                        <td className="py-3 px-4 text-right text-neutral-300">{trade.quantity}</td>
                        <td className="py-3 px-4 text-right text-neutral-300">
                          {formatINR(Number(trade.price))}
                        </td>
                        <td className="py-3 px-4 text-neutral-400 max-w-[200px] truncate">
                          {trade.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden space-y-2">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="p-4 rounded-xl bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,16%)]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{trade.ticker}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            trade.type === "Buy" || trade.type === "Cover"
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-red-500/30 text-red-400"
                          }`}
                        >
                          {trade.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {new Date(trade.date).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-neutral-500">Quantity</p>
                        <p className="text-white font-medium">{trade.quantity}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Price</p>
                        <p className="text-neutral-300">{formatINR(Number(trade.price))}</p>
                      </div>
                    </div>
                    {trade.notes && (
                      <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{trade.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

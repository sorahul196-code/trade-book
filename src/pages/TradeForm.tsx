import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2, Brain, Zap, TrendingUp, AlertTriangle, BookOpen } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTIMENTS = ["Bullish", "Bearish", "Volatile", "Sideways"] as const;
type Sentiment = (typeof SENTIMENTS)[number];

const MISTAKES = [
  "Exceeded Position Size",
  "Emotional Decision",
  "Inadequate Research",
  "Revenge Trade",
  "Overtrading",
  "Poor Timing",
  "FOMO Entry",
  "Ignored SL",
] as const;
type Mistake = (typeof MISTAKES)[number];

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  Bullish:  "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  Bearish:  "border-red-500/50    bg-red-500/10    text-red-400",
  Volatile: "border-orange-500/50 bg-orange-500/10 text-orange-400",
  Sideways: "border-blue-500/50   bg-blue-500/10   text-blue-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TradeForm() {
  const navigate  = useNavigate();
  const utils     = trpc.useUtils();

  // Trade fields
  const [type,     setType]     = useState<"Buy" | "Sell" | "Short" | "Cover">("Buy");
  const [ticker,   setTicker]   = useState("");
  const [quantity, setQuantity] = useState("");
  const [price,    setPrice]    = useState("");
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 16));

  // Journal / psychological fields
  const [sentiment,    setSentiment]    = useState<Sentiment | "">("");
  const [mentalState,  setMentalState]  = useState(7);
  const [energyLevel,  setEnergyLevel]  = useState(7);
  const [mistakes,     setMistakes]     = useState<Mistake[]>([]);
  const [observations, setObservations] = useState("");
  const [startBal]     = useState("");
  const [closeBal]     = useState("");
  const [brokerage]    = useState("");

  const dateKey = date.slice(0, 10); // YYYY-MM-DD

  // ── Mutations ──
  const journalMutation = trpc.journal.upsert.useMutation();

  const createMutation = trpc.trade.create.useMutation({
    onSuccess: () => {
      // Fire journal upsert in parallel — non-blocking
      journalMutation.mutate({
        date: dateKey,
        marketSentiment: sentiment || undefined,
        mentalState,
        energyLevel,
        mistakes: mistakes as unknown as (typeof MISTAKES)[number][],
        observations: observations || undefined,
        startingBalance: startBal ? Number(startBal) : undefined,
        closingBalance:  closeBal ? Number(closeBal) : undefined,
        totalBrokerage:  brokerage ? Number(brokerage) : undefined,
      });
      utils.trade.stats.invalidate();
      utils.journal.list.invalidate();
      toast.success("Trade + journal entry saved!");
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !quantity || !price || !date) return;
    createMutation.mutate({
      type,
      ticker: ticker.toUpperCase(),
      quantity: Number(quantity),
      price: Number(price),
      date: new Date(date).toISOString(),
    });
  };

  const toggleMistake = (m: Mistake) =>
    setMistakes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const isPending = createMutation.isPending;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,16%)] bg-[hsl(0,0%,8%)] sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white h-8 px-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <span className="font-semibold text-sm">Log Trade + Journal</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Section 1: Trade Details ───────────────────────────────── */}
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Trade Details
              </CardTitle>
              <CardDescription className="text-neutral-400 text-xs">
                Record the execution details of this trade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label className="text-neutral-300 text-xs">Trade Type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(["Buy", "Sell", "Short", "Cover"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        type === t
                          ? t === "Buy" || t === "Cover"
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                            : "border-red-500/60 bg-red-500/15 text-red-300"
                          : "border-[hsl(0,0%,20%)] bg-[hsl(0,0%,14%)] text-neutral-400 hover:border-[hsl(0,0%,28%)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticker & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker" className="text-neutral-300 text-xs">Stock Ticker *</Label>
                  <Input
                    id="ticker"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="RELIANCE"
                    required
                    className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 uppercase focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-neutral-300 text-xs">Execution Date *</Label>
                  <Input
                    id="date"
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Qty & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-neutral-300 text-xs">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="10"
                    required
                    className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-neutral-300 text-xs">Execution Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2450.50"
                    required
                    className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Live trade value preview */}
              {quantity && price && (
                <div className="p-3 rounded-lg bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)]">
                  <p className="text-xs text-neutral-500">Total Trade Value</p>
                  <p className="text-lg font-semibold text-white">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
                      Number(quantity) * Number(price)
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 3: Mental State ────────────────────────────────── */}
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-sky-400" />
                Mental State & Market Mood
              </CardTitle>
              <CardDescription className="text-neutral-400 text-xs">
                Rate your condition before this trade. Honest self-assessment is key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sentiment */}
              <div className="space-y-2">
                <Label className="text-neutral-300 text-xs">Market Sentiment</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SENTIMENTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSentiment(sentiment === s ? "" : s)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        sentiment === s
                          ? SENTIMENT_STYLES[s]
                          : "border-[hsl(0,0%,20%)] bg-[hsl(0,0%,14%)] text-neutral-400 hover:border-[hsl(0,0%,28%)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mental State slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-300 text-xs flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-sky-400" />
                    Mental State
                  </Label>
                  <span className={`text-sm font-bold tabular-nums ${
                    mentalState >= 7 ? "text-emerald-400" : mentalState >= 4 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {mentalState} / 10
                  </span>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[mentalState]}
                  onValueChange={([v]) => setMentalState(v)}
                  className="[&_[role=slider]]:bg-sky-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>Distracted</span>
                  <span>Focused</span>
                </div>
              </div>

              {/* Energy Level slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-neutral-300 text-xs flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-yellow-400" />
                    Energy Level
                  </Label>
                  <span className={`text-sm font-bold tabular-nums ${
                    energyLevel >= 7 ? "text-emerald-400" : energyLevel >= 4 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {energyLevel} / 10
                  </span>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[energyLevel]}
                  onValueChange={([v]) => setEnergyLevel(v)}
                  className="[&_[role=slider]]:bg-yellow-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>Exhausted</span>
                  <span>Peak</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 4: Mistakes & Violations ──────────────────────── */}
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Mistakes & Violations
              </CardTitle>
              <CardDescription className="text-neutral-400 text-xs">
                Honest check — did you break any of your rules during this trade?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MISTAKES.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      mistakes.includes(m)
                        ? "border-red-500/40 bg-red-500/8 text-red-300"
                        : "border-[hsl(0,0%,18%)] bg-[hsl(0,0%,13%)] text-neutral-400 hover:border-[hsl(0,0%,26%)]"
                    }`}
                  >
                    <Checkbox
                      checked={mistakes.includes(m)}
                      onCheckedChange={() => toggleMistake(m)}
                      className="border-[hsl(0,0%,30%)] data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                    />
                    <span className="text-sm">{m}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Section 5: Observations ───────────────────────────────── */}
          <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,16%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                Observations & Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="What was your trade thesis? How did you feel entering? What would you do differently?"
                rows={4}
                className="w-full rounded-lg bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,22%)] text-white text-sm px-3 py-2.5 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 resize-none"
              />
            </CardContent>
          </Card>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div className="flex gap-3 pb-6">
            <Link to="/dashboard" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full border-[hsl(0,0%,22%)] bg-transparent text-neutral-300 hover:bg-[hsl(0,0%,16%)] hover:text-white"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Trade & Journal
            </Button>
          </div>

        </form>
      </main>
    </div>
  );
}

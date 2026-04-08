"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Trash2, Calendar as CalIcon, Activity, Wallet, Settings, Moon, Sun,
  Upload, FileText, AlertCircle, Check, X, ArrowLeftRight, TrendingDown,
  ChevronDown, ChevronUp, BarChart3, DollarSign, TrendingUp
} from "lucide-react";
import { 
  optimizeAnnualSchedule,
  Payment,
  parseCSV,
  identifySplitSuggestions,
  splitPayment,
  SplitPaymentSuggestion,
  AnnualOptimization,
  MonthlyOptimization,
  createCurrentSchedule
} from "../lib/optimizer";

export default function PaymentSpacer() {
  // --- THEME STATE ---
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // --- STATE ---
  const [payments, setPayments] = useState<Payment[]>([
    { id: "1", name: "Rent", amount: 1500, currentDay: 1 },
    { id: "2", name: "Car Loan", amount: 400, currentDay: 5 },
    { id: "3", name: "Netflix", amount: 15, currentDay: 10 },
    { id: "4", name: "Insurance", amount: 120, currentDay: 15 },
    { id: "5", name: "Spotify", amount: 10, currentDay: 20 },
  ]);

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrentDay, setNewCurrentDay] = useState("");
  
  // Annual planning state
  const [startDate, setStartDate] = useState("2025-01-01");
  const [paycheckAmount, setPaycheckAmount] = useState<number>(2500);
  const [frequency, setFrequency] = useState<'biweekly' | 'semimonthly'>('semimonthly');
  const [payDay1, setPayDay1] = useState(1);
  const [payDay2, setPayDay2] = useState(15);

  const [annualOptimization, setAnnualOptimization] = useState<AnnualOptimization | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set([0])); // Start with January expanded
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [showBefore, setShowBefore] = useState(false);

  const [splitSuggestions, setSplitSuggestions] = useState<SplitPaymentSuggestion[]>([]);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for split suggestions
  useEffect(() => {
    const suggestions = identifySplitSuggestions(payments);
    setSplitSuggestions(suggestions);
    if (suggestions.length > 0) {
      setShowSplitDialog(true);
    }
  }, [payments]);

  // Generate annual optimization when parameters change
  useEffect(() => {
    if (payments.length > 0 && paycheckAmount > 0) {
      const start = new Date(startDate);
      const optimization = optimizeAnnualSchedule(
        payments,
        start,
        paycheckAmount,
        frequency,
        frequency === 'semimonthly' ? [payDay1, payDay2] : undefined
      );
      setAnnualOptimization(optimization);
    }
  }, [payments, startDate, paycheckAmount, frequency, payDay1, payDay2]);

  // --- ACTIONS ---
  const addPayment = () => {
    if (!newName || !newAmount) return;
    const newPayment: Payment = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName,
      amount: parseFloat(newAmount),
      currentDay: newCurrentDay ? parseInt(newCurrentDay) : undefined,
    };
    setPayments([...payments, newPayment]);
    setNewName("");
    setNewAmount("");
    setNewCurrentDay("");
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id && p.splitFrom !== id));
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsedPayments = parseCSV(text);
        if (parsedPayments.length > 0) {
          setPayments(parsedPayments);
        } else {
          alert("No valid payments found in CSV.");
        }
      } catch (error) {
        alert("Error parsing CSV file.");
      }
    };
    reader.readAsText(file);
  };

  const handleSplitPayment = (suggestion: SplitPaymentSuggestion) => {
    const splits = splitPayment(suggestion.payment, suggestion.suggestedSplits);
    setPayments(prev => [
      ...prev.filter(p => p.id !== suggestion.payment.id),
      ...splits
    ]);
    setSplitSuggestions(prev => prev.filter(s => s.payment.id !== suggestion.payment.id));
  };

  const dismissSplitSuggestion = (suggestion: SplitPaymentSuggestion) => {
    setSplitSuggestions(prev => prev.filter(s => s.payment.id !== suggestion.payment.id));
  };

  const toggleMonth = (monthIndex: number) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthIndex)) {
      newExpanded.delete(monthIndex);
    } else {
      newExpanded.add(monthIndex);
    }
    setExpandedMonths(newExpanded);
  };

  // --- RENDER HELPERS ---
  const renderMonthCalendar = (monthOpt: MonthlyOptimization) => {
    const days = Array.from({ length: monthOpt.daysInMonth }, (_, i) => i + 1);
    const paycheckDays = monthOpt.paychecks.map(p => p.dayOfMonth);
    
    const activeSchedule = showBefore 
      ? createCurrentSchedule(payments).map(p => ({ ...p, month: monthOpt.month, year: monthOpt.year }))
      : monthOpt.optimizedSchedule;

    const getPayPeriodColor = (day: number) => {
      const sortedPayDays = [...paycheckDays].sort((a, b) => a - b);
      if (sortedPayDays.length === 0) return "carryover";
      
      if (day >= sortedPayDays[0] && (sortedPayDays.length === 1 || day < sortedPayDays[1])) {
        return "period-1";
      }
      if (sortedPayDays.length > 1 && day >= sortedPayDays[1]) {
        return "period-2";
      }
      return "carryover";
    };

    return (
      <div className="grid grid-cols-7 gap-2 mt-4">
        {days.map((day) => {
          const dayPayments = activeSchedule.filter(p => p.suggestedDay === day);
          const totalLoad = dayPayments.reduce((acc, curr) => acc + curr.amount, 0);
          const hasPayment = dayPayments.length > 0;
          const periodClass = getPayPeriodColor(day);
          const isPayDay = paycheckDays.includes(day);

          return (
            <div
              key={day}
              className={`min-h-[60px] p-1.5 rounded-lg border flex flex-col justify-between transition-all relative text-xs ${
                isPayDay ? 'ring-2 ring-[var(--accent)] ring-offset-1' : ''
              }`}
              style={{
                backgroundColor: `var(--${periodClass})`,
                borderColor: `var(--${periodClass}-border)`
              }}
            >
              {isPayDay && (
                <div 
                  className="absolute -top-1 -right-1 text-white text-[8px] px-1 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  $
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold opacity-60">{day}</span>
                {hasPayment && (
                  <span className="text-[8px] font-bold px-1 rounded bg-[var(--card-bg)]">
                    ${totalLoad.toFixed(0)}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-0.5">
                {dayPayments.slice(0, 2).map((p) => (
                  <div key={p.id} className="text-[8px] truncate leading-tight opacity-80">
                    {p.name}
                  </div>
                ))}
                {dayPayments.length > 2 && (
                  <div className="text-[7px] opacity-50">+{dayPayments.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!annualOptimization) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="text-center">
        <Activity className="text-[var(--accent)] mx-auto mb-4" size={48} />
        <p>Loading optimization...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-8 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="text-[var(--accent)]" /> SmoothPay Annual Planner
            </h1>
            <p className="text-[var(--foreground)] opacity-60">
              Optimize your bills across an entire year
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-[var(--input-bg)] transition-all"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </header>

        {/* Split Payment Suggestions */}
        {showSplitDialog && splitSuggestions.length > 0 && (
          <div className="mb-6 p-5 rounded-xl bg-[var(--warning-bg)] border-2 border-[var(--warning-border)]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-[var(--accent)]" />
                <h3 className="font-bold text-lg">Large Payment Detected</h3>
              </div>
              <button 
                onClick={() => setShowSplitDialog(false)}
                className="text-[var(--foreground)] opacity-60 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm opacity-80 mb-4">
              Splitting these payments could improve balance across all 12 months.
            </p>
            <div className="space-y-3">
              {splitSuggestions.map(suggestion => (
                <div key={suggestion.payment.id} className="flex items-center justify-between p-3 bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)]">
                  <div>
                    <div className="font-medium">{suggestion.payment.name}</div>
                    <div className="text-sm opacity-60">
                      ${suggestion.payment.amount.toFixed(2)} → {suggestion.suggestedSplits} × ${suggestion.splitAmount.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSplitPayment(suggestion)}
                      className="px-3 py-1.5 bg-[var(--accent)] text-white rounded-md text-sm hover:bg-[var(--accent-hover)] transition flex items-center gap-1"
                    >
                      <Check size={14} /> Split
                    </button>
                    <button
                      onClick={() => dismissSplitSuggestion(suggestion)}
                      className="px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-md text-sm hover:bg-[var(--input-bg)] transition"
                    >
                      Keep Whole
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Annual Summary */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-500" />
              <span className="text-sm font-medium">Annual Income</span>
            </div>
            <div className="text-2xl font-bold text-green-500">
              ${annualOptimization.totalIncome.toLocaleString()}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {annualOptimization.monthlyOptimizations[0]?.paychecks.length * 12} paychecks
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-[var(--accent)]" />
              <span className="text-sm font-medium">Annual Bills</span>
            </div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              ${annualOptimization.totalBills.toLocaleString()}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {payments.length} monthly payments
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className={annualOptimization.annualBalance >= 0 ? "text-green-500" : "text-red-500"} />
              <span className="text-sm font-medium">Annual Balance</span>
            </div>
            <div className={`text-2xl font-bold ${annualOptimization.annualBalance >= 0 ? "text-green-500" : "text-red-500"}`}>
              ${annualOptimization.annualBalance.toLocaleString()}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {((annualOptimization.annualBalance / annualOptimization.totalIncome) * 100).toFixed(1)}% of income
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-[var(--accent)]" />
              <span className="text-sm font-medium">Avg Variance</span>
            </div>
            <div className="text-2xl font-bold">
              ${annualOptimization.overallVarianceScore.toFixed(0)}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {annualOptimization.overallVarianceScore < 100 ? "Excellent" : annualOptimization.overallVarianceScore < 200 ? "Good" : "Fair"}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {annualOptimization.recommendations.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={16} /> Recommendations
            </h3>
            <ul className="space-y-1 text-sm">
              {annualOptimization.recommendations.map((rec, idx) => (
                <li key={idx} className="opacity-80">{rec}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: Settings */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* CSV Upload */}
            <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--card-border)]">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload size={18} /> Import CSV
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[var(--input-bg)] border-2 border-dashed border-[var(--card-border)] p-4 rounded-md hover:border-[var(--accent)] transition flex flex-col items-center gap-2"
              >
                <FileText size={24} className="opacity-60" />
                <span className="text-sm font-medium">Upload CSV</span>
                <span className="text-xs opacity-60">Name, Amount, CurrentDay</span>
              </button>
            </div>

            {/* Annual Settings */}
            <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--card-border)]">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={18} /> Annual Settings
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium opacity-60 mb-1">Start Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium opacity-60 mb-1">Paycheck Amount</label>
                  <input 
                    type="number"
                    value={paycheckAmount}
                    onChange={(e) => setPaycheckAmount(Number(e.target.value))}
                    className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium opacity-60 mb-1">Pay Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'biweekly' | 'semimonthly')}
                    className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)]"
                  >
                    <option value="semimonthly">Semi-Monthly</option>
                    <option value="biweekly">Bi-Weekly</option>
                  </select>
                </div>
                {frequency === 'semimonthly' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium opacity-60 mb-1">Day 1</label>
                      <input 
                        type="number" min="1" max="31"
                        value={payDay1}
                        onChange={(e) => setPayDay1(Number(e.target.value))}
                        className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium opacity-60 mb-1">Day 2</label>
                      <input 
                        type="number" min="1" max="31"
                        value={payDay2}
                        onChange={(e) => setPayDay2(Number(e.target.value))}
                        className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Add Bill */}
            <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--card-border)]">
              <h2 className="text-lg font-semibold mb-4">Add Bill</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Bill Name"
                  className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)] placeholder:opacity-40"
                />
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)] placeholder:opacity-40"
                />
                <input
                  type="number"
                  value={newCurrentDay}
                  onChange={(e) => setNewCurrentDay(e.target.value)}
                  placeholder="Current Day (1-31)"
                  min="1"
                  max="31"
                  className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-[var(--foreground)] placeholder:opacity-40"
                />
                <button
                  onClick={addPayment}
                  className="w-full bg-[var(--accent)] text-white p-2 rounded-md hover:bg-[var(--accent-hover)] transition flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Bill List */}
            <div className="bg-[var(--card-bg)] p-6 rounded-xl shadow-sm border border-[var(--card-border)]">
              <h2 className="text-lg font-semibold mb-4">Bills ({payments.length})</h2>
              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between items-center p-2 bg-[var(--input-bg)] rounded border border-[var(--input-border)]">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs opacity-60">
                        ${p.amount.toFixed(2)}
                        {p.currentDay && ` • Day ${p.currentDay}`}
                      </div>
                    </div>
                    <button onClick={() => removePayment(p.id)} className="text-[var(--danger)] hover:text-[var(--danger-hover)] transition ml-2">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Month-by-Month View */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Before/After Toggle */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowBefore(!showBefore)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  showBefore 
                    ? 'bg-[var(--input-bg)] border border-[var(--card-border)]' 
                    : 'bg-[var(--accent)] text-white'
                }`}
              >
                <ArrowLeftRight size={16} />
                {showBefore ? "Current Schedule" : "Optimized Schedule"}
              </button>
            </div>

            {/* Monthly Breakdown */}
            {annualOptimization.monthlyOptimizations.map((monthOpt, idx) => (
              <div key={idx} className="bg-[var(--card-bg)] rounded-xl shadow-sm border border-[var(--card-border)] overflow-hidden">
                
                {/* Month Header */}
                <button
                  onClick={() => toggleMonth(idx)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[var(--input-bg)] transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <h3 className="font-bold text-lg">{monthOpt.monthName} {monthOpt.year}</h3>
                      <p className="text-xs opacity-60">
                        {monthOpt.paychecks.length} paychecks • {monthOpt.payPeriods.filter(p => p.payDay > 0).length} periods
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${monthOpt.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {monthOpt.balance >= 0 ? '+' : ''}${monthOpt.balance.toFixed(0)}
                      </div>
                      <div className="text-xs opacity-60">
                        Variance: ${monthOpt.varianceScore.toFixed(0)}
                      </div>
                    </div>
                    {expandedMonths.has(idx) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {/* Month Details */}
                {expandedMonths.has(idx) && (
                  <div className="p-4 border-t border-[var(--card-border)]">
                    
                    {/* Paycheck Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      {monthOpt.payPeriods.map((period, pidx) => (
                        <div key={pidx} className="p-3 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)]">
                          <div className="text-xs opacity-60 mb-1">{period.label}</div>
                          <div className="text-xl font-bold">${period.totalLoad.toLocaleString()}</div>
                          <div className="text-xs opacity-60">{period.bills.length} bills</div>
                          {period.remainingAfterBills !== undefined && (
                            <div className={`text-sm font-medium mt-1 ${period.remainingAfterBills < 0 ? 'text-red-500' : 'text-green-500'}`}>
                              Remaining: ${period.remainingAfterBills.toFixed(0)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Calendar */}
                    {renderMonthCalendar(monthOpt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export type Payment = {
  id: string;
  name: string;
  amount: number;
  currentDay?: number;
  isSplit?: boolean;
  splitFrom?: string;
};

export type ScheduledPayment = Payment & {
  suggestedDay: number;
  month?: number; // 0-11 (Jan-Dec)
  year?: number;
};

export type PayPeriod = {
  payDay: number;
  totalLoad: number;
  bills: ScheduledPayment[];
  label: string;
  remainingAfterBills?: number;
  month?: number;
  year?: number;
};

export type SplitPaymentSuggestion = {
  payment: Payment;
  suggestedSplits: number;
  splitAmount: number;
};

export type PaycheckSchedule = {
  date: Date;
  amount: number;
  dayOfMonth: number;
  month: number;
  year: number;
};

export type MonthlyOptimization = {
  month: number;
  year: number;
  monthName: string;
  daysInMonth: number;
  paychecks: PaycheckSchedule[];
  optimizedSchedule: ScheduledPayment[];
  payPeriods: PayPeriod[];
  totalBills: number;
  totalIncome: number;
  balance: number;
  varianceScore: number; // Lower is better - measures imbalance between paychecks
};

export type AnnualOptimization = {
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  totalBills: number;
  annualBalance: number;
  monthlyOptimizations: MonthlyOptimization[];
  overallVarianceScore: number;
  recommendations: string[];
};

// Helper: Check if a day and its neighbors are free
const hasGap = (day: number, occupiedDays: Set<number>, maxDays: number) => {
  if (occupiedDays.has(day)) return false;
  const prev = day > 1 ? occupiedDays.has(day - 1) : false;
  const next = day < maxDays ? occupiedDays.has(day + 1) : false;
  return !prev && !next;
};

// Get days in month
const getDaysInMonth = (month: number, year: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// Month names
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate paycheck schedule for a year based on bi-weekly or semi-monthly pattern
export const generateAnnualPaycheckSchedule = (
  startDate: Date,
  paycheckAmount: number,
  frequency: 'biweekly' | 'semimonthly',
  semiMonthlyDays?: [number, number] // e.g., [1, 15] for semi-monthly
): PaycheckSchedule[] => {
  const paychecks: PaycheckSchedule[] = [];
  const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
  
  if (frequency === 'biweekly') {
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      paychecks.push({
        date: new Date(currentDate),
        amount: paycheckAmount,
        dayOfMonth: currentDate.getDate(),
        month: currentDate.getMonth(),
        year: currentDate.getFullYear()
      });
      currentDate.setDate(currentDate.getDate() + 14);
    }
  } else if (frequency === 'semimonthly' && semiMonthlyDays) {
    const [day1, day2] = semiMonthlyDays;
    let currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = getDaysInMonth(month, year);
      
      // Add first paycheck
      const firstDay = Math.min(day1, daysInMonth);
      paychecks.push({
        date: new Date(year, month, firstDay),
        amount: paycheckAmount,
        dayOfMonth: firstDay,
        month: month,
        year: year
      });
      
      // Add second paycheck
      const secondDay = Math.min(day2, daysInMonth);
      paychecks.push({
        date: new Date(year, month, secondDay),
        amount: paycheckAmount,
        dayOfMonth: secondDay,
        month: month,
        year: year
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }
  
  return paychecks.filter(p => p.date >= startDate && p.date < endDate);
};

// Identify payments that should be split
export const identifySplitSuggestions = (payments: Payment[]): SplitPaymentSuggestion[] => {
  return payments
    .filter(p => p.amount >= 1000 && !p.isSplit)
    .map(p => ({
      payment: p,
      suggestedSplits: 2,
      splitAmount: p.amount / 2
    }));
};

// Split a payment into multiple parts
export const splitPayment = (payment: Payment, numberOfSplits: number = 2): Payment[] => {
  const splitAmount = payment.amount / numberOfSplits;
  const splits: Payment[] = [];
  
  for (let i = 0; i < numberOfSplits; i++) {
    splits.push({
      id: `${payment.id}-split-${i + 1}`,
      name: `${payment.name} (${i + 1}/${numberOfSplits})`,
      amount: splitAmount,
      currentDay: payment.currentDay,
      isSplit: true,
      splitFrom: payment.id
    });
  }
  
  return splits;
};

// Core Optimization Logic - Balances load between paychecks
export const optimizeSchedule = (
  payments: Payment[], 
  paycheckDays: number[],
  daysInMonth: number,
  month?: number,
  year?: number
): ScheduledPayment[] => {
  const sortedPayments = [...payments].sort((a, b) => b.amount - a.amount);
  const schedule: ScheduledPayment[] = [];
  const occupiedDays = new Set<number>();
  
  const sortedPayDays = [...paycheckDays].sort((a, b) => a - b);
  const periodLoads: number[] = sortedPayDays.map(() => 0);
  
  sortedPayments.forEach((payment) => {
    // Find the pay period with the lowest current load
    let targetPeriodIndex = 0;
    let minLoad = periodLoads[0];
    
    for (let i = 1; i < periodLoads.length; i++) {
      if (periodLoads[i] < minLoad) {
        minLoad = periodLoads[i];
        targetPeriodIndex = i;
      }
    }
    
    const periodStart = sortedPayDays[targetPeriodIndex];
    const periodEnd = targetPeriodIndex < sortedPayDays.length - 1 
      ? sortedPayDays[targetPeriodIndex + 1] - 1 
      : daysInMonth;
    
    let bestDay = -1;
    let maxDistance = -1;
    
    for (let day = periodStart; day <= periodEnd; day++) {
      if (occupiedDays.has(day)) continue;
      
      let minDistanceToNeighbor = Infinity;
      if (schedule.length === 0) {
        minDistanceToNeighbor = 0;
      } else {
        schedule.forEach((p) => {
          const dist = Math.abs(p.suggestedDay - day);
          if (dist < minDistanceToNeighbor) minDistanceToNeighbor = dist;
        });
      }
      
      const isGapSafe = hasGap(day, occupiedDays, daysInMonth);
      const score = minDistanceToNeighbor + (isGapSafe ? 5 : 0);
      
      if (score > maxDistance) {
        maxDistance = score;
        bestDay = day;
      }
    }
    
    if (bestDay === -1) {
      for (let day = periodStart; day <= periodEnd; day++) {
        if (!occupiedDays.has(day)) {
          bestDay = day;
          break;
        }
      }
    }
    
    if (bestDay === -1) {
      for (let day = 1; day <= daysInMonth; day++) {
        if (!occupiedDays.has(day)) {
          bestDay = day;
          break;
        }
      }
    }
    
    occupiedDays.add(bestDay);
    schedule.push({ 
      ...payment, 
      suggestedDay: bestDay,
      month,
      year
    });
    periodLoads[targetPeriodIndex] += payment.amount;
  });
  
  return schedule.sort((a, b) => a.suggestedDay - b.suggestedDay);
};

// Create "before" schedule using current payment dates
export const createCurrentSchedule = (payments: Payment[]): ScheduledPayment[] => {
  return payments.map(payment => ({
    ...payment,
    suggestedDay: payment.currentDay || 1
  })).sort((a, b) => a.suggestedDay - b.suggestedDay);
};

// Calculate Load per Paycheck
export const calculatePaycheckLoads = (
  schedule: ScheduledPayment[],
  paychecks: PaycheckSchedule[],
  month: number,
  year: number
): PayPeriod[] => {
  // Filter paychecks for this specific month
  const monthPaychecks = paychecks.filter(p => p.month === month && p.year === year);
  
  const periods: PayPeriod[] = monthPaychecks.map((paycheck, index) => ({
    payDay: paycheck.dayOfMonth,
    label: `Paycheck ${index + 1} (Day ${paycheck.dayOfMonth})`,
    totalLoad: 0,
    bills: [] as ScheduledPayment[],
    remainingAfterBills: paycheck.amount,
    month,
    year
  }));

  const carryover: PayPeriod = {
    payDay: 0,
    label: "Previous Month Carryover",
    totalLoad: 0,
    bills: [],
    remainingAfterBills: 0,
    month,
    year
  };

  schedule.forEach((payment) => {
    const sortedDays = monthPaychecks.map(p => p.dayOfMonth).sort((a, b) => a - b);
    
    let assignedIndex = -1;
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (sortedDays[i] <= payment.suggestedDay) {
        assignedIndex = monthPaychecks.findIndex(p => p.dayOfMonth === sortedDays[i]);
        break;
      }
    }

    if (assignedIndex !== -1) {
      periods[assignedIndex].totalLoad += payment.amount;
      periods[assignedIndex].bills.push(payment);
      periods[assignedIndex].remainingAfterBills -= payment.amount;
    } else {
      carryover.totalLoad += payment.amount;
      carryover.bills.push(payment);
    }
  });

  return carryover.totalLoad > 0 ? [carryover, ...periods] : periods;
};

// Calculate variance score (measures imbalance)
const calculateVarianceScore = (periods: PayPeriod[]): number => {
  const regularPeriods = periods.filter(p => p.payDay > 0);
  if (regularPeriods.length < 2) return 0;
  
  const loads = regularPeriods.map(p => p.totalLoad);
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
  const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
  
  return Math.sqrt(variance); // Standard deviation
};

// Optimize a single month
export const optimizeMonth = (
  payments: Payment[],
  paychecks: PaycheckSchedule[],
  month: number,
  year: number
): MonthlyOptimization => {
  const daysInMonth = getDaysInMonth(month, year);
  const monthPaychecks = paychecks.filter(p => p.month === month && p.year === year);
  const paycheckDays = monthPaychecks.map(p => p.dayOfMonth);
  
  const optimizedSchedule = optimizeSchedule(payments, paycheckDays, daysInMonth, month, year);
  const payPeriods = calculatePaycheckLoads(optimizedSchedule, paychecks, month, year);
  
  const totalBills = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalIncome = monthPaychecks.reduce((sum, p) => sum + p.amount, 0);
  
  return {
    month,
    year,
    monthName: MONTH_NAMES[month],
    daysInMonth,
    paychecks: monthPaychecks,
    optimizedSchedule,
    payPeriods,
    totalBills,
    totalIncome,
    balance: totalIncome - totalBills,
    varianceScore: calculateVarianceScore(payPeriods)
  };
};

// Optimize entire year
export const optimizeAnnualSchedule = (
  payments: Payment[],
  startDate: Date,
  paycheckAmount: number,
  frequency: 'biweekly' | 'semimonthly',
  semiMonthlyDays?: [number, number]
): AnnualOptimization => {
  const paychecks = generateAnnualPaycheckSchedule(
    startDate,
    paycheckAmount,
    frequency,
    semiMonthlyDays
  );
  
  const monthlyOptimizations: MonthlyOptimization[] = [];
  let currentDate = new Date(startDate);
  const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
  
  while (currentDate < endDate) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    const monthlyOpt = optimizeMonth(payments, paychecks, month, year);
    monthlyOptimizations.push(monthlyOpt);
    
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  const totalIncome = paychecks.reduce((sum, p) => sum + p.amount, 0);
  const totalBills = payments.reduce((sum, p) => sum + p.amount, 0) * 12;
  const overallVarianceScore = monthlyOptimizations.reduce((sum, m) => sum + m.varianceScore, 0) / monthlyOptimizations.length;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  // Check for consistently negative balances
  const negativeMonths = monthlyOptimizations.filter(m => m.balance < 0);
  if (negativeMonths.length > 0) {
    recommendations.push(`Warning: ${negativeMonths.length} month(s) have negative balance. Consider increasing income or reducing expenses.`);
  }
  
  // Check for high variance
  const highVarianceMonths = monthlyOptimizations.filter(m => m.varianceScore > 200);
  if (highVarianceMonths.length > 0) {
    recommendations.push(`${highVarianceMonths.length} month(s) have high paycheck imbalance. Consider splitting large payments.`);
  }
  
  // Check for split opportunities
  const splitCandidates = identifySplitSuggestions(payments);
  if (splitCandidates.length > 0) {
    recommendations.push(`${splitCandidates.length} payment(s) over $1,000 could be split for better balance.`);
  }
  
  // Overall health check
  if (totalIncome - totalBills > totalIncome * 0.2) {
    recommendations.push('✓ Healthy surplus! Consider increasing savings or investments.');
  } else if (totalIncome - totalBills > 0) {
    recommendations.push('✓ Positive annual balance maintained.');
  }
  
  return {
    startDate,
    endDate,
    totalIncome,
    totalBills,
    annualBalance: totalIncome - totalBills,
    monthlyOptimizations,
    overallVarianceScore,
    recommendations
  };
};

// Parse CSV file
export const parseCSV = (csvText: string): Payment[] => {
  const lines = csvText.trim().split('\n');
  const payments: Payment[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    
    if (fields.length >= 3) {
      const name = fields[0].replace(/^"|"$/g, '');
      const amount = parseFloat(fields[1].replace(/[^0-9.-]/g, ''));
      const currentDay = parseInt(fields[2].replace(/[^0-9]/g, '')) || undefined;
      
      if (name && !isNaN(amount)) {
        payments.push({
          id: Math.random().toString(36).substr(2, 9),
          name,
          amount,
          currentDay
        });
      }
    }
  }
  
  return payments;
};
import React, { useMemo, useState } from 'react';
import { Calculator, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

interface ExamUtilityCalculatorViewProps {
  tool: ToolCatalogItem;
}

const FIXED_MONTH_DAY_HOLIDAYS = ['01-26', '05-01', '08-15', '10-02', '12-25'];
const VARIABLE_HOLIDAYS = [
  '2025-03-14',
  '2025-03-31',
  '2025-04-10',
  '2025-04-18',
  '2025-10-20',
  '2026-03-04',
  '2026-03-21',
  '2026-03-26',
  '2026-04-03',
  '2026-11-08',
];

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date(NaN);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function calculateDetailedAge(birthDateStr: string, asOfDateStr: string) {
  const birth = parseLocalDate(birthDateStr);
  const asOf = parseLocalDate(asOfDateStr);

  if (isNaN(birth.getTime()) || isNaN(asOf.getTime()) || birth > asOf) {
    return null;
  }

  let years = asOf.getFullYear() - birth.getFullYear();
  let months = asOf.getMonth() - birth.getMonth();
  let days = asOf.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.round((asOf.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.floor(totalDays / 7);
  const totalHours = totalDays * 24;

  const thisYearBirthday = new Date(asOf.getFullYear(), birth.getMonth(), birth.getDate());
  let nextBirthday = thisYearBirthday;
  if (thisYearBirthday < asOf) {
    nextBirthday = new Date(asOf.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  const daysUntilNextBirthday = Math.round(
    (nextBirthday.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    years,
    months,
    days,
    totalDays,
    totalWeeks,
    totalHours,
    daysUntilNextBirthday,
    nextBirthdayDayName: nextBirthday.toLocaleDateString('en-IN', { weekday: 'long' }),
  };
}

function getRelaxationYears(cat: string): number {
  switch (cat) {
    case 'obc':
      return 3;
    case 'sc-st':
    case 'ex-servicemen':
    case 'widow-divorced':
      return 5;
    case 'pwd-general':
      return 10;
    case 'pwd-obc':
      return 13;
    case 'pwd-sc-st':
      return 15;
    default:
      return 0;
  }
}

function calculateCgpaToPercent(cgpa: number, formula: string): number {
  switch (formula) {
    case 'cbse':
      return cgpa * 9.5;
    case 'vtu':
    case 'aicte':
      return (cgpa - 0.75) * 10;
    case 'mumbai':
      return cgpa >= 7 ? 7.25 * cgpa + 11 : 7.1 * cgpa + 12;
    default:
      return cgpa * 9.5;
  }
}

export const ExamUtilityCalculatorView: React.FC<ExamUtilityCalculatorViewProps> = ({ tool }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  // 1-4. Age & Govt Age Cutoff / Eligibility / Relaxation
  const [dob, setDob] = useState<string>('');
  const [refDate, setRefDate] = useState<string>(() => formatLocalYmd(new Date()));
  const [cutoffDate, setCutoffDate] = useState<string>('');
  const [minAgeLimit, setMinAgeLimit] = useState<string>('');
  const [maxAgeLimit, setMaxAgeLimit] = useState<string>('');
  const [categoryRelaxation, setCategoryRelaxation] = useState<string>('general');

  const isAgeRuleTool =
    tool.id === 'age-cutoff-calculator' ||
    tool.id === 'govt-age-eligibility-calculator' ||
    tool.id === 'age-relaxation-calculator';

  const minAgeNum = Math.max(0, Number(minAgeLimit) || 0);
  const maxAgeNum = Math.max(0, Number(maxAgeLimit) || 0);
  const ageData = calculateDetailedAge(dob, isAgeRuleTool ? cutoffDate : refDate);
  const relaxedUpperAge = maxAgeNum + getRelaxationYears(categoryRelaxation);
  const isEligibleForExam =
    Boolean(ageData) &&
    maxAgeNum > 0 &&
    ageData!.years >= minAgeNum &&
    (ageData!.years < relaxedUpperAge ||
      (ageData!.years === relaxedUpperAge && ageData!.months === 0 && ageData!.days === 0));

  // 5. Percentage Calculator (3 modes)
  const [percentMode, setPercentMode] = useState<'marks' | 'percent-of' | 'change'>('marks');
  const [obtainedMarks, setObtainedMarks] = useState<string>('');
  const [totalMarks, setTotalMarks] = useState<string>('');
  const [valX, setValX] = useState<string>('');
  const [valY, setValY] = useState<string>('');
  const [fromVal, setFromVal] = useState<string>('');
  const [toVal, setToVal] = useState<string>('');

  const obtainedMarksNum = Number(obtainedMarks) || 0;
  const totalMarksNum = Number(totalMarks) || 0;
  const valXNum = Number(valX) || 0;
  const valYNum = Number(valY) || 0;
  const fromValNum = Number(fromVal) || 0;
  const toValNum = Number(toVal) || 0;

  // 6 & 7. CGPA <-> Percentage
  const [cgpaInput, setCgpaInput] = useState<string>('');
  const [percentageInput, setPercentageInput] = useState<string>('');
  const [cgpaFormula, setCgpaFormula] = useState<'cbse' | 'vtu' | 'mumbai' | 'aicte'>('cbse');

  const cgpaNum = Math.max(0, Number(cgpaInput) || 0);
  const percentageNum = Math.max(0, Number(percentageInput) || 0);

  // 8. Marks Calculator (Dynamic Subjects)
  const [subjects, setSubjects] = useState<
    { id: string; name: string; obtained: string; max: string }[]
  >([{ id: '1', name: '', obtained: '', max: '' }]);

  const marksTotals = useMemo(() => {
    const obt = subjects.reduce((acc, s) => acc + (Number(s.obtained) || 0), 0);
    const max = subjects.reduce((acc, s) => acc + (Number(s.max) || 0), 0);
    const pct = max > 0 ? (obt / max) * 100 : 0;
    let division = 'Enter Subject Marks';
    if (max > 0) {
      if (pct >= 75) division = 'First Class with Distinction';
      else if (pct >= 60) division = 'First Class';
      else if (pct >= 50) division = 'Second Class';
      else if (pct >= 35) division = 'Pass Class';
      else division = 'Fail / Reappear';
    }
    return { obt, max, pct, division };
  }, [subjects]);

  const addSubjectRow = () => {
    setSubjects((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', obtained: '', max: '100' },
    ]);
  };

  const removeSubjectRow = (id: string) => {
    if (subjects.length > 1) {
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    }
  };

  // 9. Negative Marking Calculator
  const [negQuestions, setNegQuestions] = useState<string>('');
  const [negCorrect, setNegCorrect] = useState<string>('');
  const [negWrong, setNegWrong] = useState<string>('');
  const [negMarksPerQ, setNegMarksPerQ] = useState<string>('');
  const [negFactor, setNegFactor] = useState<number>(0.3333);

  const safeNegQuestions = Math.max(0, Number(negQuestions) || 0);
  const safeNegCorrect = Math.max(0, Number(negCorrect) || 0);
  const safeNegWrong = Math.max(0, Number(negWrong) || 0);
  const safeMarksPerQ = Math.max(0, Number(negMarksPerQ) || 0);
  const negExceedsTotal = safeNegQuestions > 0 && safeNegCorrect + safeNegWrong > safeNegQuestions;
  const negUnattempted = Math.max(0, safeNegQuestions - safeNegCorrect - safeNegWrong);
  const negPositiveMarks = safeNegCorrect * safeMarksPerQ;
  const negPenalty = safeNegWrong * (safeMarksPerQ * negFactor);
  const negNetScore = Math.max(0, negPositiveMarks - negPenalty);
  const negMaxMarks = safeNegQuestions * safeMarksPerQ;
  const negAccuracy =
    safeNegCorrect + safeNegWrong > 0
      ? ((safeNegCorrect / (safeNegCorrect + safeNegWrong)) * 100).toFixed(1)
      : '0';

  // 10. Weighted Exam Score Calculator
  const [papers, setPapers] = useState<
    { id: string; name: string; score: string; maxScore: string; weightPct: string }[]
  >([{ id: '1', name: '', score: '', maxScore: '', weightPct: '' }]);

  const addPaperRow = () => {
    setPapers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', score: '', maxScore: '', weightPct: '' },
    ]);
  };

  const removePaperRow = (id: string) => {
    if (papers.length > 1) {
      setPapers((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const weightedTotalScore = useMemo(() => {
    let finalScore = 0;
    papers.forEach((p) => {
      const sc = Number(p.score) || 0;
      const mx = Number(p.maxScore) || 0;
      const wt = Number(p.weightPct) || 0;
      const paperPct = mx > 0 ? (sc / mx) * 100 : 0;
      finalScore += (paperPct * wt) / 100;
    });
    return finalScore;
  }, [papers]);

  // 11. Cutoff Marks Calculator
  const [mathsMarks, setMathsMarks] = useState<string>('');
  const [physicsMarks, setPhysicsMarks] = useState<string>('');
  const [chemistryMarks, setChemistryMarks] = useState<string>('');
  const [biologyMarks, setBiologyMarks] = useState<string>('');
  const [cutoffStream, setCutoffStream] = useState<'engg-200' | 'engg-100' | 'med-200'>('engg-200');

  const mathsNum = Math.max(0, Number(mathsMarks) || 0);
  const physicsNum = Math.max(0, Number(physicsMarks) || 0);
  const chemistryNum = Math.max(0, Number(chemistryMarks) || 0);
  const biologyNum = Math.max(0, Number(biologyMarks) || 0);
  const engineeringCutoff200 = mathsNum + physicsNum / 2 + chemistryNum / 2;
  const engineeringCutoff100 = mathsNum / 2 + physicsNum / 4 + chemistryNum / 4;
  const medicalCutoff200 = biologyNum + physicsNum / 2 + chemistryNum / 2;

  // 12. Merit Percentage
  const [qualifyingPct, setQualifyingPct] = useState<string>('');
  const [entrancePct, setEntrancePct] = useState<string>('');
  const [meritRatio, setMeritRatio] = useState<string>('50:50');

  const qualifyingNum = Math.max(0, Number(qualifyingPct) || 0);
  const entranceNum = Math.max(0, Number(entrancePct) || 0);
  const combinedMeritPct = useMemo(() => {
    const [qWeight, eWeight] = meritRatio.split(':').map(Number);
    return (qualifyingNum * qWeight) / 100 + (entranceNum * eWeight) / 100;
  }, [qualifyingNum, entranceNum, meritRatio]);

  // 13 & 14 & 15. Height, Weight, BMI
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [bmiHeightCm, setBmiHeightCm] = useState<string>('');
  const [bmiWeightKg, setBmiWeightKg] = useState<string>('');

  const heightCmNum = Math.max(0, Number(heightCm) || 0);
  const weightKgNum = Math.max(0, Number(weightKg) || 0);
  const bmiHeightNum = Math.max(0, Number(bmiHeightCm) || 0);
  const bmiWeightNum = Math.max(0, Number(bmiWeightKg) || 0);
  const bmiHeightM = bmiHeightNum / 100;
  const calculatedBmi =
    bmiHeightM > 0 && bmiWeightNum > 0 ? (bmiWeightNum / (bmiHeightM * bmiHeightM)).toFixed(1) : '0.0';
  const bmiNum = parseFloat(calculatedBmi);

  let bmiVerdict = 'Enter height and weight above to calculate BMI';
  let bmiColor = 'text-[#475569]';
  let bmiBg = 'bg-[#FEF2C8]/60 border-[#2F3E4E]';

  if (bmiNum > 0) {
    if (bmiNum < 18.5) {
      bmiVerdict = 'Underweight (Below medical fitness benchmark)';
      bmiColor = 'text-amber-900';
      bmiBg = 'bg-[#FFE1B3] border-[#2F3E4E]';
    } else if (bmiNum <= 24.9) {
      bmiVerdict = 'Normal & Fit (Optimal for Armed Forces & Police Standards)';
      bmiColor = 'text-emerald-800';
      bmiBg = 'bg-[#CEE5DC] border-[#2F3E4E]';
    } else if (bmiNum <= 29.9) {
      bmiVerdict = 'Overweight (Borderline fitness check advised)';
      bmiColor = 'text-orange-900';
      bmiBg = 'bg-[#FFE1B3] border-[#2F3E4E]';
    } else {
      bmiVerdict = 'Obese (Requires weight reduction for medical board clearance)';
      bmiColor = 'text-rose-900';
      bmiBg = 'bg-rose-100 border-rose-700';
    }
  }

  const minIdealWeight = bmiHeightM > 0 ? (18.5 * bmiHeightM * bmiHeightM).toFixed(1) : '0.0';
  const maxIdealWeight = bmiHeightM > 0 ? (24.9 * bmiHeightM * bmiHeightM).toFixed(1) : '0.0';

  // 16. Typing Speed
  const [typedChars, setTypedChars] = useState<string>('');
  const [typingMinutes, setTypingMinutes] = useState<string>('');
  const [typingErrors, setTypingErrors] = useState<string>('');

  const typedCharsNum = Math.max(0, Number(typedChars) || 0);
  const typingMinutesNum = Math.max(0, Number(typingMinutes) || 0);
  const typingErrorsNum = Math.max(0, Number(typingErrors) || 0);
  const grossWpmCalc = typingMinutesNum > 0 ? Math.round(typedCharsNum / 5 / typingMinutesNum) : 0;
  const netWpmCalc =
    typingMinutesNum > 0 ? Math.max(0, Math.round(grossWpmCalc - typingErrorsNum / typingMinutesNum)) : 0;
  const typingAccuracyCalc =
    typedCharsNum > 0
      ? Math.max(0, Math.round(((typedCharsNum - typingErrorsNum * 5) / typedCharsNum) * 100))
      : 0;
  const kdphCalc =
    typingMinutesNum > 0 ? Math.round((typedCharsNum / (typingMinutesNum * 60)) * 3600) : 0;

  // 17 & 18. Date Difference
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>(() => formatLocalYmd(new Date()));
  const [includeEndDay, setIncludeEndDay] = useState<boolean>(true);

  const dateDiffResult = useMemo(() => {
    const d1 = parseLocalDate(startDateStr);
    const d2 = parseLocalDate(endDateStr);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

    const start = d1 < d2 ? d1 : d2;
    const end = d1 < d2 ? d2 : d1;

    let totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (includeEndDay) totalDays += 1;

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    let weekdays = 0;
    let weekends = 0;
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur <= end) {
      const day = cur.getDay();
      if (day === 0 || day === 6) weekends++;
      else weekdays++;
      cur.setDate(cur.getDate() + 1);
    }

    return { years, months, days, totalDays, weekdays, weekends };
  }, [startDateStr, endDateStr, includeEndDay]);

  // 19. Application Fee
  const [feeExamPreset, setFeeExamPreset] = useState<string>('ssc');
  const [numPosts, setNumPosts] = useState<number>(1);
  const [candidateCategory, setCandidateCategory] = useState<string>('general');
  const [isFemaleCandidate, setIsFemaleCandidate] = useState<boolean>(false);
  const [isPwD, setIsPwD] = useState<boolean>(false);

  const calculatedFee = useMemo(() => {
    let perPostFee = 100;
    if (feeExamPreset === 'upsc' || feeExamPreset === 'ssc') perPostFee = 100;
    else if (feeExamPreset === 'ibps') perPostFee = 850;
    else if (feeExamPreset === 'sbi') perPostFee = 750;
    else if (feeExamPreset === 'rrb') perPostFee = 500;
    else if (feeExamPreset === 'kpsc') perPostFee = 300;

    let isExempt = false;
    let exemptionReason = '';

    if (
      isFemaleCandidate &&
      (feeExamPreset === 'upsc' || feeExamPreset === 'ssc' || feeExamPreset === 'rrb')
    ) {
      isExempt = true;
      exemptionReason = '100% Fee Exemption for Female candidates under official government norms';
    } else if (candidateCategory === 'sc' || candidateCategory === 'st') {
      if (feeExamPreset === 'upsc' || feeExamPreset === 'ssc') {
        isExempt = true;
        exemptionReason = '100% Fee Exemption for SC/ST candidates';
      } else if (feeExamPreset === 'ibps' || feeExamPreset === 'sbi') {
        perPostFee = 175;
      } else if (feeExamPreset === 'rrb') {
        perPostFee = 250;
      }
    } else if (isPwD) {
      if (feeExamPreset === 'upsc' || feeExamPreset === 'ssc' || feeExamPreset === 'sbi') {
        isExempt = true;
        exemptionReason = '100% Fee Exemption for Persons with Benchmark Disabilities (PwD)';
      }
    }

    const totalFee = isExempt ? 0 : perPostFee * numPosts;
    return { perPostFee, totalFee, isExempt, exemptionReason };
  }, [feeExamPreset, numPosts, candidateCategory, isFemaleCandidate, isPwD]);

  // 20. Working Days Calculator
  const [workStart, setWorkStart] = useState<string>('');
  const [workEnd, setWorkEnd] = useState<string>('');
  const [workWeekType, setWorkWeekType] = useState<'5-day' | '6-day'>('5-day');
  const [excludeHolidays, setExcludeHolidays] = useState<boolean>(true);

  const workingDaysData = useMemo(() => {
    const s = parseLocalDate(workStart);
    const e = parseLocalDate(workEnd);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return null;

    let totalDays = 0;
    let workingDays = 0;
    let weekendDays = 0;
    let holidayDays = 0;

    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    while (cur <= e) {
      totalDays++;
      const day = cur.getDay();
      const dateStr = formatLocalYmd(cur);
      const monthDay = dateStr.slice(5);
      const isWeekend = workWeekType === '5-day' ? day === 0 || day === 6 : day === 0;
      const isHoliday =
        excludeHolidays &&
        (FIXED_MONTH_DAY_HOLIDAYS.includes(monthDay) || VARIABLE_HOLIDAYS.includes(dateStr));

      if (isWeekend) {
        weekendDays++;
      } else if (isHoliday) {
        holidayDays++;
      } else {
        workingDays++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return { totalDays, workingDays, weekendDays, holidayDays };
  }, [workStart, workEnd, workWeekType, excludeHolidays]);

  const handleClearActiveTool = () => {
    setDob('');
    setCutoffDate('');
    setMinAgeLimit('');
    setMaxAgeLimit('');
    setObtainedMarks('');
    setTotalMarks('');
    setValX('');
    setValY('');
    setFromVal('');
    setToVal('');
    setCgpaInput('');
    setPercentageInput('');
    setSubjects([{ id: '1', name: '', obtained: '', max: '' }]);
    setNegQuestions('');
    setNegCorrect('');
    setNegWrong('');
    setNegMarksPerQ('');
    setPapers([{ id: '1', name: '', score: '', maxScore: '', weightPct: '' }]);
    setMathsMarks('');
    setPhysicsMarks('');
    setChemistryMarks('');
    setBiologyMarks('');
    setQualifyingPct('');
    setEntrancePct('');
    setHeightCm('');
    setWeightKg('');
    setBmiHeightCm('');
    setBmiWeightKg('');
    setTypedChars('');
    setTypingMinutes('');
    setTypingErrors('');
    setStartDateStr('');
    setWorkStart('');
    setWorkEnd('');
    setNumPosts(1);
    setIsFemaleCandidate(false);
    setIsPwD(false);
  };

  const getExportSummary = (): { kpis: { label: string; value: string }[]; headers: string[]; rows: (string | number)[][] } => {
    const kpis: { label: string; value: string }[] = [];
    const headers = ['Metric', 'Value'];
    const rows: (string | number)[][] = [];
    const el = document.getElementById('calc-summary-result');
    if (tool.id === 'marks-calculator') {
      kpis.push({ label: 'Total Marks', value: `${marksTotals.obt} / ${marksTotals.max}` });
      kpis.push({ label: 'Percentage', value: `${marksTotals.pct.toFixed(2)}%` });
      kpis.push({ label: 'Division', value: marksTotals.division });
      subjects.forEach((s, i) => rows.push([s.name || `Subject ${i + 1}`, `${Number(s.obtained) || 0} / ${Number(s.max) || 0}`]));
      rows.push(['Grand Total', `${marksTotals.obt} / ${marksTotals.max}`]);
      rows.push(['Aggregate %', `${marksTotals.pct.toFixed(2)}%`]);
    } else if (tool.id === 'exam-score-calculator') {
      kpis.push({ label: 'Combined Merit Score', value: `${weightedTotalScore.toFixed(2)} / 100` });
      papers.forEach((p, i) => rows.push([p.name || `Paper ${i + 1}`, `${Number(p.score) || 0}/${Number(p.maxScore) || 0} (${Number(p.weightPct) || 0}% wt)`]));
      rows.push(['Weighted Merit Index', `${weightedTotalScore.toFixed(2)} / 100`]);
    } else if (el) {
      const lines = el.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
      lines.forEach((line, idx) => rows.push([`Line ${idx + 1}`, line]));
      if (lines.length > 0) kpis.push({ label: tool.title, value: lines.slice(0, 3).join(' · ') });
    }
    return { kpis, headers, rows };
  };

  const inputClass =
    'w-full px-3 py-2 border-[1.5px] border-[#2F3E4E]/40 rounded-xl text-sm bg-white text-[#2F3E4E] font-medium focus:outline-none focus:border-[#2F3E4E]';

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E] font-sans space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-xs font-extrabold text-[#2F3E4E] uppercase tracking-wider flex items-center gap-1.5">
            <Calculator className="w-4 h-4" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2F3E4E] mt-1">
            {tool.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1">
            {tool.description}
          </p>
        </div>

        <button
          type="button"
          onClick={handleClearActiveTool}
          className="px-4 py-2 border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] rounded-xl text-xs font-bold text-[#2F3E4E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Clear All
        </button>
      </div>

      {/* 1. EXACT AGE CALCULATOR */}
      {tool.id === 'age-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase tracking-wider mb-1.5">
                Date of Birth (DOB)
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase tracking-wider mb-1.5">
                Age as on Date
              </label>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {ageData && (
            <div className="space-y-4">
              <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
                <span className="text-xs font-extrabold text-[#2F3E4E]/80 uppercase tracking-wider block mb-1">
                  Your Exact Age
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#2F3E4E] tracking-tight font-mono">
                  {ageData.years} years · {ageData.months} months · {ageData.days} days
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Total Days Lived</span>
                  <span className="text-base font-bold font-mono tabular-nums text-[#2F3E4E]">
                    {ageData.totalDays.toLocaleString()}
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Total Weeks</span>
                  <span className="text-base font-bold font-mono tabular-nums text-[#2F3E4E]">
                    {ageData.totalWeeks.toLocaleString()}
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Total Hours</span>
                  <span className="text-base font-bold font-mono tabular-nums text-[#2F3E4E]">
                    {ageData.totalHours.toLocaleString()}
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Next Birthday In</span>
                  <span className="text-base font-bold font-mono tabular-nums text-[#2F3E4E]">
                    {ageData.daysUntilNextBirthday} days ({ageData.nextBirthdayDayName})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2, 3 & 4. AGE CUTOFF, GOVT ELIGIBILITY & RELAXATION */}
      {isAgeRuleTool && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase tracking-wider mb-1.5">
                Date of Birth (DOB)
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase tracking-wider mb-1.5">
                Notification Cut-off Date
              </label>
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                className={`${inputClass} font-mono`}
              />
              <span className="text-[11px] text-[#64748B] mt-1 block">
                E.g., 01-08-2026 (UPSC) or 01-01-2026 (SSC)
              </span>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase tracking-wider mb-1.5">
                Category Relaxation
              </label>
              <select
                value={categoryRelaxation}
                onChange={(e) => setCategoryRelaxation(e.target.value)}
                className={inputClass}
              >
                <option value="general">General / EWS (No Relaxation)</option>
                <option value="obc">OBC (Non-Creamy Layer) (+3 Years)</option>
                <option value="sc-st">SC / ST (+5 Years)</option>
                <option value="pwd-general">PwD General (+10 Years)</option>
                <option value="pwd-obc">PwD + OBC (+13 Years)</option>
                <option value="pwd-sc-st">PwD + SC/ST (+15 Years)</option>
                <option value="ex-servicemen">Ex-Servicemen (+5 Years)</option>
                <option value="widow-divorced">Widow / Divorced Women (+5 Years)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Min Age Limit
              </label>
              <input
                type="number"
                value={minAgeLimit}
                onChange={(e) => setMinAgeLimit(e.target.value)}
                placeholder="e.g. 18 or 21"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Standard Max Age (Unreserved)
              </label>
              <input
                type="number"
                value={maxAgeLimit}
                onChange={(e) => setMaxAgeLimit(e.target.value)}
                placeholder="e.g. 32"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {ageData && (
            <div className="space-y-4">
              <div
                className={`p-6 rounded-2xl border-[1.5px] text-center ${
                  isEligibleForExam
                    ? 'bg-[#CEE5DC] border-[#2F3E4E]'
                    : 'bg-rose-50 border-rose-700'
                }`}
              >
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider block mb-1 ${
                    isEligibleForExam ? 'text-emerald-900' : 'text-rose-800'
                  }`}
                >
                  {isEligibleForExam
                    ? '✓ ELIGIBLE FOR EXAMINATION'
                    : '✗ NOT ELIGIBLE (OUTSIDE PERMISSIBLE AGE)'}
                </span>

                <div className="text-2xl sm:text-3xl font-extrabold text-[#2F3E4E]">
                  Age on {cutoffDate}: {ageData.years} Years, {ageData.months} Months, {ageData.days} Days
                </div>

                <p className="text-xs text-[#475569] mt-2 max-w-lg mx-auto">
                  {isEligibleForExam
                    ? `Your age falls within ${minAgeNum} to ${relaxedUpperAge} years (includes +${getRelaxationYears(categoryRelaxation)} years category relaxation).`
                    : `Your age falls outside the permissible limits of ${minAgeNum} to ${relaxedUpperAge} years.`}
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25 text-xs text-[#475569] space-y-1.5">
                <span className="font-bold text-[#2F3E4E] block">Rule Verification:</span>
                <p>• Unreserved Upper Age Limit: {maxAgeLimit} Years</p>
                <p>• Category Relaxation Granted: +{getRelaxationYears(categoryRelaxation)} Years</p>
                <p>
                  • Effective Relaxed Upper Age Boundary:{' '}
                  <strong className="text-[#2F3E4E]">{relaxedUpperAge} Years</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. PERCENTAGE CALCULATOR */}
      {tool.id === 'percentage-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="flex flex-wrap border-b border-[#2F3E4E]/15 gap-4 text-xs font-bold">
            {(
              [
                { key: 'marks', label: 'Marks Percentage' },
                { key: 'percent-of', label: 'What is X% of Y?' },
                { key: 'change', label: 'Percentage Increase / Decrease' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPercentMode(m.key)}
                className={`pb-2.5 border-b-2 cursor-pointer transition-colors ${
                  percentMode === m.key
                    ? 'border-[#2F3E4E] text-[#2F3E4E]'
                    : 'border-transparent text-[#64748B] hover:text-[#2F3E4E]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {percentMode === 'marks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                    Marks Obtained
                  </label>
                  <input
                    type="number"
                    value={obtainedMarks}
                    onChange={(e) => setObtainedMarks(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                    Total Maximum Marks
                  </label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>
              <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
                <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
                  Percentage Result
                </span>
                <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
                  {totalMarksNum > 0 ? ((obtainedMarksNum / totalMarksNum) * 100).toFixed(2) : '0.00'}%
                </div>
                <p className="text-xs text-[#475569] mt-2 font-mono">
                  Formula: ({obtainedMarksNum} ÷ {totalMarksNum}) × 100
                </p>
              </div>
            </div>
          )}

          {percentMode === 'percent-of' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                    What is (X)%
                  </label>
                  <input
                    type="number"
                    value={valX}
                    onChange={(e) => setValX(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                    Of Number (Y)
                  </label>
                  <input
                    type="number"
                    value={valY}
                    onChange={(e) => setValY(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>
              <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
                <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
                  Calculated Value
                </span>
                <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
                  {((valXNum * valYNum) / 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <p className="text-xs text-[#475569] mt-2 font-mono">
                  {valXNum}% of {valYNum} = ({valXNum} ÷ 100) × {valYNum}
                </p>
              </div>
            </div>
          )}

          {percentMode === 'change' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                    Original Value (From)
                  </label>
                  <input
                    type="number"
                    value={fromVal}
                    onChange={(e) => setFromVal(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                    New Value (To)
                  </label>
                  <input
                    type="number"
                    value={toVal}
                    onChange={(e) => setToVal(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>
              {fromValNum !== 0 && (
                <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
                  <span className="text-xs font-extrabold uppercase text-[#2F3E4E]/80">
                    Percentage Change
                  </span>
                  <div
                    className={`text-4xl font-extrabold font-mono tabular-nums mt-1 ${
                      toValNum >= fromValNum ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {toValNum >= fromValNum ? '+' : ''}
                    {(((toValNum - fromValNum) / fromValNum) * 100).toFixed(2)}%
                  </div>
                  <p className="text-xs text-[#475569] mt-2">
                    {toValNum >= fromValNum ? 'Net Increase' : 'Net Decrease'} of{' '}
                    {Math.abs(toValNum - fromValNum)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6 & 7. CGPA <-> PERCENTAGE */}
      {(tool.id === 'cgpa-to-percentage' || tool.id === 'percentage-to-cgpa') && (
        <div className="space-y-6" id="calc-summary-result">
          {tool.id === 'cgpa-to-percentage' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                  Enter CGPA (10-Point Scale)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={cgpaInput}
                  onChange={(e) => setCgpaInput(e.target.value)}
                  placeholder="e.g. 8.5"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                  University / Board Formula
                </label>
                <select
                  value={cgpaFormula}
                  onChange={(e) => setCgpaFormula(e.target.value as typeof cgpaFormula)}
                  className={inputClass}
                >
                  <option value="cbse">CBSE Formula (CGPA × 9.5)</option>
                  <option value="vtu">VTU Karnataka ([CGPA - 0.75] × 10)</option>
                  <option value="aicte">AICTE Standard ([CGPA - 0.75] × 10)</option>
                  <option value="mumbai">Mumbai University (Pointer Scale)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                  Enter Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percentageInput}
                  onChange={(e) => setPercentageInput(e.target.value)}
                  placeholder="e.g. 75"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                  Target Grading Standard
                </label>
                <select
                  value={cgpaFormula}
                  onChange={(e) => setCgpaFormula(e.target.value as typeof cgpaFormula)}
                  className={inputClass}
                >
                  <option value="cbse">CBSE Standard (÷ 9.5)</option>
                  <option value="vtu">VTU / AICTE ([% ÷ 10] + 0.75)</option>
                </select>
              </div>
            </div>
          )}

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
            <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
              {tool.id === 'cgpa-to-percentage'
                ? 'Equivalent Aggregate Percentage'
                : 'Equivalent 10-Point CGPA'}
            </span>
            <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
              {tool.id === 'cgpa-to-percentage'
                ? `${cgpaNum > 0 ? Math.max(0, calculateCgpaToPercent(cgpaNum, cgpaFormula)).toFixed(2) : '0.00'}%`
                : percentageNum > 0
                ? cgpaFormula === 'cbse'
                  ? (percentageNum / 9.5).toFixed(2)
                  : (percentageNum / 10 + 0.75).toFixed(2)
                : '0.00'}
            </div>
            <p className="text-xs text-[#475569] mt-2 font-mono">
              {tool.id === 'cgpa-to-percentage'
                ? cgpaNum > 0
                  ? cgpaFormula === 'cbse'
                    ? `${cgpaNum} × 9.5 = ${Math.max(0, calculateCgpaToPercent(cgpaNum, cgpaFormula)).toFixed(2)}%`
                    : `(${cgpaNum} - 0.75) × 10 = ${Math.max(0, calculateCgpaToPercent(cgpaNum, cgpaFormula)).toFixed(2)}%`
                  : 'Enter your CGPA above to compute percentage'
                : `${percentageNum}% converted using ${cgpaFormula.toUpperCase()} norm`}
            </p>
          </div>
        </div>
      )}

      {/* 8. MARKS CALCULATOR */}
      {tool.id === 'marks-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2F3E4E] uppercase">
                Subject-wise Marks Card
              </span>
              <button
                type="button"
                onClick={addSubjectRow}
                className="px-3 py-1.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subject
              </button>
            </div>

            <div className="space-y-2">
              {subjects.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-[#2F3E4E]/25 text-xs"
                >
                  <span className="col-span-1 text-[#64748B] font-mono text-center">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={sub.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSubjects((prev) =>
                        prev.map((s) => (s.id === sub.id ? { ...s, name: val } : s))
                      );
                    }}
                    className="col-span-5 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-[#2F3E4E]"
                    placeholder="Subject Name"
                  />
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={sub.obtained}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjects((prev) =>
                          prev.map((s) => (s.id === sub.id ? { ...s, obtained: val } : s))
                        );
                      }}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono text-[#2F3E4E]"
                      placeholder="Obtained"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-[#64748B]">/</span>
                    <input
                      type="number"
                      value={sub.max}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjects((prev) =>
                          prev.map((s) => (s.id === sub.id ? { ...s, max: val } : s))
                        );
                      }}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono text-[#2F3E4E]"
                      placeholder="Max"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubjectRow(sub.id)}
                    aria-label="Remove subject"
                    className="col-span-1 text-rose-600 hover:text-rose-800 flex justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-xs text-[#475569] uppercase font-bold block">
                Grand Total Marks
              </span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E] mt-1">
                {marksTotals.obt} / {marksTotals.max}
              </div>
            </div>
            <div>
              <span className="text-xs text-[#2F3E4E] uppercase font-extrabold block">
                Aggregate Percentage
              </span>
              <div className="text-3xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
                {marksTotals.pct.toFixed(2)}%
              </div>
            </div>
            <div>
              <span className="text-xs text-[#475569] uppercase font-bold block">
                Academic Division
              </span>
              <div className="text-base font-extrabold text-emerald-900 mt-1">
                {marksTotals.division}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. NEGATIVE MARKING CALCULATOR */}
      {tool.id === 'negative-marking-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">
                Total Questions
              </label>
              <input
                type="number"
                min="1"
                value={negQuestions}
                onChange={(e) => setNegQuestions(e.target.value)}
                placeholder="e.g. 100"
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">
                Marks / Question
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={negMarksPerQ}
                onChange={(e) => setNegMarksPerQ(e.target.value)}
                placeholder="e.g. 2"
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                Correct Answers
              </label>
              <input
                type="number"
                min="0"
                value={negCorrect}
                onChange={(e) => setNegCorrect(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-rose-800 mb-1">
                Wrong Answers
              </label>
              <input
                type="number"
                min="0"
                value={negWrong}
                onChange={(e) => setNegWrong(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">
                Penalty Fraction
              </label>
              <select
                value={negFactor}
                onChange={(e) => setNegFactor(Number(e.target.value))}
                className={`${inputClass} text-xs`}
              >
                <option value={0.3333}>1/3rd (UPSC / RRB)</option>
                <option value={0.25}>1/4th (IBPS / SBI / SSC Tier 1)</option>
                <option value={0.5}>1/2 (50% Penalty)</option>
              </select>
            </div>
          </div>

          {negExceedsTotal && (
            <div className="p-3 bg-[#FFE1B3] border border-[#2F3E4E] rounded-xl text-xs text-[#2F3E4E] font-medium">
              Note: Correct ({safeNegCorrect}) + Wrong ({safeNegWrong}) exceeds Total Questions ({safeNegQuestions}).
            </div>
          )}

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center space-y-4">
            <div>
              <span className="text-xs font-extrabold text-[#2F3E4E]/80 uppercase tracking-wider block">
                Net Score After Penalty
              </span>
              <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
                {negNetScore.toFixed(2)} / {negMaxMarks}
              </div>
              <div className="text-xs text-[#475569] mt-1 font-mono">
                Unattempted: {negUnattempted} questions
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3 text-xs border-t border-[#2F3E4E]/20">
              <div>
                <span className="text-[#475569] block">Gross Positive</span>
                <span className="font-bold text-emerald-900 font-mono text-sm">
                  +{negPositiveMarks}
                </span>
              </div>
              <div>
                <span className="text-[#475569] block">Negative Penalty</span>
                <span className="font-bold text-rose-800 font-mono text-sm">
                  -{negPenalty.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#475569] block">Accuracy %</span>
                <span className="font-bold text-[#2F3E4E] font-mono text-sm">{negAccuracy}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. EXAM SCORE CALCULATOR (WEIGHTED) */}
      {tool.id === 'exam-score-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2F3E4E] uppercase block">
                Multi-Tier Papers &amp; Weightage
              </span>
              <button
                type="button"
                onClick={addPaperRow}
                className="px-3 py-1.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Paper
              </button>
            </div>
            {papers.map((p, idx) => (
              <div
                key={p.id}
                className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-[#2F3E4E]/25 text-xs"
              >
                <span className="col-span-1 text-[#64748B] font-mono text-center">#{idx + 1}</span>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPapers((prev) =>
                      prev.map((item) => (item.id === p.id ? { ...item, name: val } : item))
                    );
                  }}
                  placeholder={`Paper ${idx + 1} Name`}
                  className="col-span-4 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-[#2F3E4E]"
                />
                <div className="col-span-3 flex items-center gap-1">
                  <input
                    type="number"
                    value={p.score}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPapers((prev) =>
                        prev.map((item) => (item.id === p.id ? { ...item, score: val } : item))
                      );
                    }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                    placeholder="Score"
                  />
                  <span className="text-[#64748B]">/</span>
                  <input
                    type="number"
                    value={p.maxScore}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPapers((prev) =>
                        prev.map((item) => (item.id === p.id ? { ...item, maxScore: val } : item))
                      );
                    }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                    placeholder="Max"
                  />
                </div>
                <div className="col-span-3 flex items-center gap-1">
                  <input
                    type="number"
                    value={p.weightPct}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPapers((prev) =>
                        prev.map((item) => (item.id === p.id ? { ...item, weightPct: val } : item))
                      );
                    }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                    placeholder="Weight %"
                  />
                  <span className="text-[#64748B] font-bold">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => removePaperRow(p.id)}
                  aria-label="Remove paper"
                  className="col-span-1 text-rose-600 hover:text-rose-800 flex justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
            <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
              Combined Weighted Merit Index
            </span>
            <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
              {weightedTotalScore.toFixed(2)} / 100
            </div>
            <p className="text-xs text-[#475569] mt-2">
              Sum of (Paper Score ÷ Max Score × Weightage %)
            </p>
          </div>
        </div>
      )}

      {/* 11. CUTOFF MARKS CALCULATOR */}
      {tool.id === 'cutoff-marks-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="max-w-md">
            <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
              Stream Mode
            </label>
            <select
              value={cutoffStream}
              onChange={(e) => setCutoffStream(e.target.value as typeof cutoffStream)}
              className={inputClass}
            >
              <option value="engg-200">Engineering (TNEA Out of 200: M + P/2 + C/2)</option>
              <option value="engg-100">Engineering (KCET Out of 100: M/2 + P/4 + C/4)</option>
              <option value="med-200">Medical / Agri (Out of 200: Bio + P/2 + C/2)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                {cutoffStream === 'med-200' ? 'Biology' : 'Mathematics'} (out of 100)
              </label>
              <input
                type="number"
                value={cutoffStream === 'med-200' ? biologyMarks : mathsMarks}
                onChange={(e) =>
                  cutoffStream === 'med-200'
                    ? setBiologyMarks(e.target.value)
                    : setMathsMarks(e.target.value)
                }
                placeholder="0"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Physics (out of 100)
              </label>
              <input
                type="number"
                value={physicsMarks}
                onChange={(e) => setPhysicsMarks(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Chemistry (out of 100)
              </label>
              <input
                type="number"
                value={chemistryMarks}
                onChange={(e) => setChemistryMarks(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
            <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
              Official Cutoff Score
            </span>
            <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
              {cutoffStream === 'engg-200' && `${engineeringCutoff200.toFixed(2)} / 200`}
              {cutoffStream === 'engg-100' && `${engineeringCutoff100.toFixed(2)} / 100`}
              {cutoffStream === 'med-200' && `${medicalCutoff200.toFixed(2)} / 200`}
            </div>
            <p className="text-xs text-[#475569] mt-2">
              Normalized per Department of Technical Education admission rules.
            </p>
          </div>
        </div>
      )}

      {/* 12. MERIT PERCENTAGE CALCULATOR */}
      {tool.id === 'merit-percentage-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Qualifying Board / Degree %
              </label>
              <input
                type="number"
                step="0.01"
                value={qualifyingPct}
                onChange={(e) => setQualifyingPct(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Entrance Examination %
              </label>
              <input
                type="number"
                step="0.01"
                value={entrancePct}
                onChange={(e) => setEntrancePct(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Weightage Ratio
              </label>
              <select
                value={meritRatio}
                onChange={(e) => setMeritRatio(e.target.value)}
                className={inputClass}
              >
                <option value="50:50">50:50 (50% Board + 50% Entrance)</option>
                <option value="60:40">60:40 (60% Board + 40% Entrance)</option>
                <option value="70:30">70:30 (70% Board + 30% Entrance)</option>
                <option value="80:20">80:20 (80% Board + 20% Entrance)</option>
              </select>
            </div>
          </div>

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
            <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
              Final Composite Merit Score
            </span>
            <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums mt-1">
              {combinedMeritPct.toFixed(2)}%
            </div>
            <p className="text-xs text-[#475569] mt-2 font-mono">
              Formula: ({qualifyingNum}% × {meritRatio.split(':')[0]}%) + ({entranceNum}% ×{' '}
              {meritRatio.split(':')[1]}%)
            </p>
          </div>
        </div>
      )}

      {/* 13. HEIGHT CONVERTER */}
      {tool.id === 'height-converter' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="max-w-sm">
            <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
              Enter Height in Centimeters (cm)
            </label>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="e.g. 170"
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Feet &amp; Inches</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {Math.floor(heightCmNum / 30.48)}&apos; {Math.round((heightCmNum % 30.48) / 2.54)}&quot;
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Total Inches</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(heightCmNum / 2.54).toFixed(1)} in
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Meters</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(heightCmNum / 100).toFixed(2)} m
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Millimeters</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(heightCmNum * 10).toFixed(0)} mm
              </span>
            </div>
          </div>

          <div className="p-4 bg-[#FEF2C8] rounded-xl border border-[#2F3E4E]/25 text-xs space-y-1 text-[#2F3E4E]">
            <span className="font-bold">Recruitment Physical Standards Benchmarks:</span>
            <p>• Police Constable / SI Male: 168 cm (5&apos; 6.1&quot;) | Female: 157 cm (5&apos; 1.8&quot;)</p>
            <p>• Indian Army GD: 169–170 cm (depending on state recruiting zone)</p>
          </div>
        </div>
      )}

      {/* 14. WEIGHT CONVERTER */}
      {tool.id === 'weight-converter' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="max-w-sm">
            <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
              Enter Weight in Kilograms (kg)
            </label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 68"
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Pounds (lbs)</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(weightKgNum * 2.20462).toFixed(2)} lbs
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Grams (g)</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(weightKgNum * 1000).toLocaleString()} g
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Ounces (oz)</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(weightKgNum * 35.274).toFixed(1)} oz
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
              <span className="text-xs text-[#64748B] block">Stones</span>
              <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                {(weightKgNum * 0.157473).toFixed(2)} st
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 15. BMI CALCULATOR */}
      {tool.id === 'bmi-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                Height in Centimeters (cm)
              </label>
              <input
                type="number"
                value={bmiHeightCm}
                onChange={(e) => setBmiHeightCm(e.target.value)}
                placeholder="e.g. 172"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                Weight in Kilograms (kg)
              </label>
              <input
                type="number"
                value={bmiWeightKg}
                onChange={(e) => setBmiWeightKg(e.target.value)}
                placeholder="e.g. 68"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className={`p-6 border-[1.5px] rounded-2xl text-center space-y-2 ${bmiBg}`}>
            <span className="text-xs font-extrabold uppercase tracking-wider block text-[#475569]">
              Your Body Mass Index (BMI)
            </span>
            <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums">
              {calculatedBmi} kg/m²
            </div>
            <div className={`text-sm font-bold ${bmiColor}`}>{bmiVerdict}</div>
            {bmiHeightNum > 0 && (
              <p className="text-xs text-[#475569] pt-2">
                Ideal weight for your height ({bmiHeightNum} cm):{' '}
                <strong className="text-[#2F3E4E]">
                  {minIdealWeight} kg – {maxIdealWeight} kg
                </strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 16. TYPING SPEED CALCULATOR */}
      {tool.id === 'typing-speed-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Total Characters Typed
              </label>
              <input
                type="number"
                value={typedChars}
                onChange={(e) => setTypedChars(e.target.value)}
                placeholder="e.g. 1750"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Time Taken (Minutes)
              </label>
              <input
                type="number"
                step="0.5"
                value={typingMinutes}
                onChange={(e) => setTypingMinutes(e.target.value)}
                placeholder="e.g. 10"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Total Mistyped Words / Errors
              </label>
              <input
                type="number"
                value={typingErrors}
                onChange={(e) => setTypingErrors(e.target.value)}
                placeholder="0"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <span className="text-xs text-[#475569] uppercase font-bold block">Gross Speed</span>
              <div className="text-2xl font-bold font-mono text-[#2F3E4E] mt-1">
                {grossWpmCalc} WPM
              </div>
            </div>
            <div>
              <span className="text-xs text-[#2F3E4E] uppercase font-extrabold block">
                Net Exam Speed
              </span>
              <div className="text-3xl font-extrabold text-[#2F3E4E] font-mono mt-1">
                {netWpmCalc} WPM
              </div>
            </div>
            <div>
              <span className="text-xs text-[#475569] uppercase font-bold block">Accuracy</span>
              <div className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                {typingAccuracyCalc}%
              </div>
            </div>
            <div>
              <span className="text-xs text-[#475569] uppercase font-bold block">KDPH</span>
              <div className="text-2xl font-bold font-mono text-[#2F3E4E] mt-1">{kdphCalc}</div>
            </div>
          </div>
        </div>
      )}

      {/* 17 & 18. DATE DIFFERENCE & DAYS BETWEEN DATES */}
      {(tool.id === 'date-difference-calculator' ||
        tool.id === 'days-between-dates-calculator') && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
            <input
              type="checkbox"
              checked={includeEndDay}
              onChange={(e) => setIncludeEndDay(e.target.checked)}
              className="rounded border-slate-400 text-[#2F3E4E]"
            />
            <span>Include end day in calculation (+1 day)</span>
          </label>

          {dateDiffResult && (
            <div className="space-y-4">
              <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center">
                <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase">
                  Exact Duration Elapsed
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#2F3E4E] font-mono mt-1">
                  {dateDiffResult.years} Years, {dateDiffResult.months} Months,{' '}
                  {dateDiffResult.days} Days
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Total Days</span>
                  <span className="text-xl font-bold font-mono text-[#2F3E4E]">
                    {dateDiffResult.totalDays.toLocaleString()}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Weekdays (Mon-Fri)</span>
                  <span className="text-xl font-bold font-mono text-emerald-800">
                    {dateDiffResult.weekdays}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-[#2F3E4E]/25">
                  <span className="text-[#64748B] block">Weekend Days (Sat-Sun)</span>
                  <span className="text-xl font-bold font-mono text-amber-800">
                    {dateDiffResult.weekends}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 19. APPLICATION FEE CALCULATOR */}
      {tool.id === 'application-fee-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Recruitment Examination
              </label>
              <select
                value={feeExamPreset}
                onChange={(e) => setFeeExamPreset(e.target.value)}
                className={inputClass}
              >
                <option value="upsc">UPSC Civil Services / NDA / CDS (₹100)</option>
                <option value="ssc">SSC CGL / CHSL / MTS (₹100)</option>
                <option value="ibps">IBPS PO / Clerk / SO (₹850 Gen / ₹175 SC/ST)</option>
                <option value="sbi">SBI PO / Clerk (₹750 Gen / Nil SC/ST)</option>
                <option value="rrb">Railway RRB NTPC / ALP (₹500 / ₹250 Refundable)</option>
                <option value="kpsc">KPSC Karnataka Gazetted Probationers (₹300)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Social Category
              </label>
              <select
                value={candidateCategory}
                onChange={(e) => setCandidateCategory(e.target.value)}
                className={inputClass}
              >
                <option value="general">General / Unreserved</option>
                <option value="ews">EWS (Economically Weaker Section)</option>
                <option value="obc">OBC (Other Backward Classes)</option>
                <option value="sc">SC (Scheduled Caste)</option>
                <option value="st">ST (Scheduled Tribe)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Number of Posts / Codes
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={numPosts}
                onChange={(e) => setNumPosts(Math.max(1, Number(e.target.value)))}
                className={`${inputClass} font-mono`}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-[#2F3E4E] font-semibold cursor-pointer pb-2.5">
              <input
                type="checkbox"
                checked={isFemaleCandidate}
                onChange={(e) => setIsFemaleCandidate(e.target.checked)}
                className="rounded border-slate-400 text-[#2F3E4E]"
              />
              <span>Female Candidate (Fee Waiver)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-[#2F3E4E] font-semibold cursor-pointer pb-2.5">
              <input
                type="checkbox"
                checked={isPwD}
                onChange={(e) => setIsPwD(e.target.checked)}
                className="rounded border-slate-400 text-[#2F3E4E]"
              />
              <span>PwD Candidate (Exempted)</span>
            </label>
          </div>

          <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl text-center space-y-2">
            <span className="text-xs text-[#2F3E4E]/80 font-extrabold uppercase tracking-wider block">
              Total Payable Application Fee
            </span>
            <div className="text-4xl font-extrabold text-[#2F3E4E] font-mono tabular-nums">
              ₹{calculatedFee.totalFee}
            </div>
            {calculatedFee.isExempt ? (
              <p className="text-xs text-emerald-900 font-bold">
                ✓ {calculatedFee.exemptionReason}
              </p>
            ) : (
              <p className="text-xs text-[#475569]">
                Calculated at ₹{calculatedFee.perPostFee} per post code × {numPosts} post(s).
              </p>
            )}
          </div>
        </div>
      )}

      {/* 20. WORKING DAYS CALCULATOR */}
      {tool.id === 'working-days-calculator' && (
        <div className="space-y-6" id="calc-summary-result">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                End Date
              </label>
              <input
                type="date"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-bold text-[#2F3E4E]">Schedule:</label>
              <select
                value={workWeekType}
                onChange={(e) => setWorkWeekType(e.target.value as '5-day' | '6-day')}
                className="px-3 py-1.5 border border-[#2F3E4E]/40 rounded-lg bg-white text-[#2F3E4E] font-medium"
              >
                <option value="5-day">5-Day Work Week (Sat &amp; Sun Off)</option>
                <option value="6-day">6-Day Work Week (Sunday Off Only)</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-[#2F3E4E] font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={excludeHolidays}
                onChange={(e) => setExcludeHolidays(e.target.checked)}
                className="rounded border-slate-400 text-[#2F3E4E]"
              />
              <span>Exclude Indian Gazetted National Holidays</span>
            </label>
          </div>

          {workingDaysData && (
            <div className="p-6 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <span className="text-xs text-[#475569] uppercase font-bold block">
                  Total Elapsed Days
                </span>
                <span className="text-2xl font-bold font-mono text-[#2F3E4E] mt-1 block">
                  {workingDaysData.totalDays}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#2F3E4E] uppercase font-extrabold block">
                  Net Working Days
                </span>
                <span className="text-3xl font-extrabold text-emerald-900 font-mono mt-1 block">
                  {workingDaysData.workingDays}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#475569] uppercase font-bold block">
                  Weekend Offs
                </span>
                <span className="text-2xl font-bold font-mono text-[#2F3E4E] mt-1 block">
                  {workingDaysData.weekendDays}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#475569] uppercase font-bold block">
                  Public Holidays
                </span>
                <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">
                  {workingDaysData.holidayDays}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Universal Clear & Export Bar */}
      <ToolExportBar
        onClear={handleClearActiveTool}
        onCopy={() => {
          const el = document.getElementById('calc-summary-result');
          if (el) copyToClipboard(el.innerText);
        }}
        copied={copied}
        copyLabel="Copy Result"
        onExcel={() => {
          const summary = getExportSummary();
          downloadExcelWorkbook({
            filename: `${tool.id.replace(/-/g, '_')}_report.xlsx`,
            sheets: [
              {
                name: 'Report',
                headers: summary.headers,
                rows: summary.rows,
              },
            ],
          });
        }}
        onCsv={() => {
          const summary = getExportSummary();
          downloadBomCsv({
            filename: `${tool.id.replace(/-/g, '_')}_report.csv`,
            headers: summary.headers,
            rows: summary.rows,
          });
        }}
        onWord={() => {
          const summary = getExportSummary();
          void downloadWordDocument({
            filename: `${tool.id.replace(/-/g, '_')}_report.docx`,
            title: tool.title,
            subtitle: tool.description,
            kpis: summary.kpis,
            table: {
              title: 'Calculation Breakdown',
              headers: summary.headers,
              rows: summary.rows.map((r) => r.map(String)),
            },
          });
        }}
        onJson={() => {
          const summary = getExportSummary();
          downloadJsonFile(`${tool.id.replace(/-/g, '_')}_report.json`, summary);
        }}
        onPdf={() => {
          const summary = getExportSummary();
          exportStructuredReportPdf({
            title: tool.title,
            subtitle: tool.description,
            filename: `${tool.id.replace(/-/g, '_')}_report.pdf`,
            kpis: summary.kpis,
            table: {
              title: 'Calculation Breakdown',
              headers: summary.headers,
              rows: summary.rows.map((r) => r.map(String)),
            },
          });
        }}
        onPrint={() => {
          const summary = getExportSummary();
          void printHtmlDocument({
            title: tool.title,
            bodyHtml: `
              <h1>${tool.title}</h1>
              <p>${tool.description}</p>
              <table>
                <thead><tr>${summary.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${summary.rows.map((r) => `<tr>${r.map((c) => `<td>${String(c)}</td>`).join('')}</tr>`).join('')}</tbody>
              </table>
            `,
          });
        }}
      />
    </div>
  );
};

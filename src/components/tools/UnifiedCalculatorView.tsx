import React, { useMemo, useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { FINANCIAL_CALCULATORS } from '../../data/financialCalculators';
import { ToolCatalogItem } from '../../types/tools';
import { copyTextToClipboard } from '../../hooks/useRightClickProtection';
import {
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { CurrencyConverterPanel } from './CurrencyConverterPanel';
import { ExamUtilityCalculatorView } from './ExamUtilityCalculatorView';
import { FinancialCalculatorView } from './FinancialCalculatorView';
import { ScientificCalculatorPanel } from './ScientificCalculatorPanel';
import { TaxCalculatorView } from './TaxCalculatorView';
import { ToolExportBar } from './ToolExportBar';

interface UnifiedCalculatorViewProps {
  onClose: () => void;
}

type CalculatorDomainTab = 'standard' | 'currency' | 'financial' | 'tax' | 'exam' | 'dates' | 'student';

const EXAM_CALCULATORS: { id: string; label: string; description: string }[] = [
  { id: 'age-calculator', label: 'Exact Age', description: 'Calculate exact chronological age in years, months, days, and next birthday.' },
  { id: 'age-cutoff-calculator', label: 'Govt Exam Age Cutoff', description: 'Check age on UPSC/SSC/IBPS cut-off dates with category relaxation.' },
  { id: 'govt-age-eligibility-calculator', label: 'Age Eligibility Checker', description: 'Verify minimum and relaxed maximum age limits across categories.' },
  { id: 'percentage-calculator', label: 'Percentage', description: 'Compute marks %, X% of Y, and net percentage increase or decrease.' },
  { id: 'cgpa-to-percentage', label: 'CGPA to Percentage', description: 'Convert 10-point CGPA using CBSE, VTU, AICTE, and Mumbai University rules.' },
  { id: 'percentage-to-cgpa', label: 'Percentage to CGPA', description: 'Reverse-convert aggregate percentage into equivalent 10-point CGPA.' },
  { id: 'marks-calculator', label: 'Subject Marks Card', description: 'Add subjects dynamically to compute total marks, percentage, and division.' },
  { id: 'negative-marking-calculator', label: 'Negative Marking Score', description: 'Calculate net OMR/CBT scores with 1/3, 1/4, or 1/2 penalty fractions.' },
  { id: 'exam-score-calculator', label: 'Weighted Exam Score', description: 'Combine Prelims, Mains, and Interview marks by weightage %.' },
  { id: 'cutoff-marks-calculator', label: 'Engg & Medical Cutoff', description: 'Compute TNEA, KCET, and Biology/Medical normalized cutoffs.' },
  { id: 'merit-percentage-calculator', label: 'Composite Merit %', description: 'Blend qualifying marks and entrance scores across standard ratios.' },
];

const DATE_HEALTH_CALCULATORS: { id: string; label: string; description: string }[] = [
  { id: 'date-difference-calculator', label: 'Date Difference', description: 'Find exact elapsed years, months, days, weekdays, and weekends.' },
  { id: 'days-between-dates-calculator', label: 'Days Between Dates', description: 'Count inclusive or exclusive calendar and business weekdays.' },
  { id: 'working-days-calculator', label: 'Working Days & Holidays', description: 'Compute net working days excluding Indian Gazetted Holidays.' },
  { id: 'bmi-calculator', label: 'BMI & Ideal Weight', description: 'Calculate Body Mass Index and healthy fitness weight range.' },
  { id: 'height-converter', label: 'Height Converter', description: 'Convert cm to feet/inches, total inches, meters, and mm.' },
  { id: 'weight-converter', label: 'Weight Converter', description: 'Instant unit conversion between kg, lbs, grams, and ounces.' },
  { id: 'typing-speed-calculator', label: 'Typing WPM & KDPH', description: 'Compute Gross WPM, Net Exam WPM, accuracy %, and KDPH.' },
  { id: 'application-fee-calculator', label: 'Exam Application Fee', description: 'Calculate UPSC, SSC, IBPS, SBI, RRB & KPSC fees with waivers.' },
];

export const UnifiedCalculatorView: React.FC<UnifiedCalculatorViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<CalculatorDomainTab>('standard');
  const [calcMode, setCalcMode] = useState<'scientific' | 'standard'>('scientific');
  const [financialId, setFinancialId] = useState<string>(FINANCIAL_CALCULATORS[0].id);
  const [examId, setExamId] = useState<string>(EXAM_CALCULATORS[0].id);
  const [dateHealthId, setDateHealthId] = useState<string>(DATE_HEALTH_CALCULATORS[0].id);
  const [tabResetNonce, setTabResetNonce] = useState<number>(0);

  const activeFinancial = useMemo(
    () => FINANCIAL_CALCULATORS.find((c) => c.id === financialId) || FINANCIAL_CALCULATORS[0],
    [financialId]
  );

  // Student & GPA Hub state (clean blank initial state)
  const [studentBoard, setStudentBoard] = useState<'sslc' | 'puc' | 'cbse'>('sslc');
  const [boardMarks, setBoardMarks] = useState<string>('');
  const [semesters, setSemesters] = useState<{ name: string; sgpa: string; credits: string }[]>([
    { name: 'Semester 1', sgpa: '', credits: '' },
  ]);
  const [attHeld, setAttHeld] = useState<string>('');
  const [attPresent, setAttPresent] = useState<string>('');
  const [attTarget, setAttTarget] = useState<number>(75);
  const [studentCopied, setStudentCopied] = useState<boolean>(false);

  const syntheticExamTool: ToolCatalogItem = useMemo(() => {
    const list = activeTab === 'dates' ? DATE_HEALTH_CALCULATORS : EXAM_CALCULATORS;
    const picked = list.find((i) => i.id === (activeTab === 'dates' ? dateHealthId : examId)) || list[0];
    return {
      id: picked.id,
      code: 'CL-01',
      suite: 'Calculator',
      suiteAccent: '#1D4ED8',
      category: 'Calculator',
      categoryName: activeTab === 'dates' ? 'Dates & Physical' : 'Exam & Academic',
      kind: 'exam-utility-calc',
      title: picked.label,
      description: picked.description,
      priorityStars: 5,
      statusLabel: 'All-in-One Calculator',
    };
  }, [activeTab, examId, dateHealthId]);

  const DOMAIN_TABS: { key: CalculatorDomainTab; label: string }[] = [
    {
      key: 'standard',
      label: calcMode === 'standard' ? 'Standard Calculator' : 'Scientific & Engg Calculator',
    },
    { key: 'currency', label: 'Currency Converter' },
    { key: 'financial', label: 'Financial & Loans (15)' },
    { key: 'tax', label: 'Income Tax (FY 25-26)' },
    { key: 'exam', label: 'Exam & Academic (11)' },
    { key: 'dates', label: 'Dates & Health (8)' },
    { key: 'student', label: 'Student & GPA (3)' },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Unified Calculator Header & Mode Switcher */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#475569]">
              <Calculator className="w-4 h-4 text-[#2F3E4E]" />
              <span>All-in-One Calculator</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-[#2F3E4E]">CL-01</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2F3E4E] tracking-tight mt-1">
              Unified Calculator Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-1">
              {activeTab === 'standard' && calcMode === 'standard'
                ? 'Standard Arithmetic mode active — switch back to Scientific & Engg anytime for trig, logs, and constants.'
                : 'All-in-one workspace combining Scientific & Engineering Trig (cos/sin/tan, DEG/RAD), Currency Converter, Financial & Advanced Home Loan planners, FY 25-26 Income Tax, Exam Merit, and Date tools.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setTabResetNonce((n) => n + 1);
              if (activeTab === 'student') {
                setBoardMarks('');
                setSemesters([{ name: 'Semester 1', sgpa: '', credits: '' }]);
                setAttHeld('');
                setAttPresent('');
                setAttTarget(75);
              }
            }}
            className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Active Tab</span>
          </button>
        </div>

        <div role="tablist" aria-label="Calculator Categories" className="flex flex-wrap gap-2 pt-1">
          {DOMAIN_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border-[1.5px] border-[#2F3E4E] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                    : 'bg-white text-[#2F3E4E] hover:bg-[#FEF2C8]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. SCIENTIFIC & ENGINEERING CALCULATOR */}
      {activeTab === 'standard' && (
        <ScientificCalculatorPanel key={`sci-${tabResetNonce}`} onModeChange={setCalcMode} />
      )}

      {/* 1B. CURRENCY CONVERTER */}
      {activeTab === 'currency' && <CurrencyConverterPanel key={`cur-${tabResetNonce}`} />}

      {/* 2. FINANCIAL & LOANS (15 CALCULATORS) */}
      {activeTab === 'financial' && (
        <div className="space-y-5">
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 no-print">
            <label htmlFor="fin-calc-picker" className="block text-xs font-bold text-[#475569] mb-2">
              Select Financial Calculator ({FINANCIAL_CALCULATORS.length} Modes)
            </label>
            <div className="flex flex-wrap gap-2">
              {FINANCIAL_CALCULATORS.map((calc) => (
                <button
                  key={calc.id}
                  type="button"
                  onClick={() => setFinancialId(calc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    financialId === calc.id
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {calc.name.replace(' Calculator', '')}
                </button>
              ))}
            </div>
          </div>

          <FinancialCalculatorView
            key={`fin-${financialId}-${tabResetNonce}`}
            calculator={activeFinancial}
            onSelectTool={(id) => setFinancialId(id)}
          />
        </div>
      )}

      {/* 3. INCOME TAX (FY 25-26) */}
      {activeTab === 'tax' && (
        <TaxCalculatorView key={`tax-${tabResetNonce}`} onBack={onClose} />
      )}

      {/* 4. EXAM & ACADEMIC (11 CALCULATORS) */}
      {activeTab === 'exam' && (
        <div className="space-y-5">
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 no-print">
            <p className="text-xs font-bold text-[#475569] mb-2">
              Select Exam &amp; Academic Calculator ({EXAM_CALCULATORS.length} Modes)
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAM_CALCULATORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setExamId(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    examId === item.id
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <ExamUtilityCalculatorView key={`exam-${examId}-${tabResetNonce}`} tool={syntheticExamTool} />
        </div>
      )}

      {/* 5. DATES & HEALTH (8 CALCULATORS) */}
      {activeTab === 'dates' && (
        <div className="space-y-5">
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 no-print">
            <p className="text-xs font-bold text-[#475569] mb-2">
              Select Date &amp; Physical Calculator ({DATE_HEALTH_CALCULATORS.length} Modes)
            </p>
            <div className="flex flex-wrap gap-2">
              {DATE_HEALTH_CALCULATORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateHealthId(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dateHealthId === item.id
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <ExamUtilityCalculatorView key={`dates-${dateHealthId}-${tabResetNonce}`} tool={syntheticExamTool} />
        </div>
      )}

      {/* 6. STUDENT & GPA HUB (3 TOOLS) */}
      {activeTab === 'student' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Card 1: SSLC / 2nd PUC / CBSE Marks % */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  SSLC (625) / PUC (600) Percentage
                </h2>
                <button
                  type="button"
                  onClick={() => setBoardMarks('')}
                  className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white hover:bg-[#FFE1B3] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {[
                  { id: 'sslc', label: 'KSEAB SSLC (625)' },
                  { id: 'puc', label: '2nd PUC (600)' },
                  { id: 'cbse', label: 'CBSE / ICSE (500)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setStudentBoard(b.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] cursor-pointer ${
                      studentBoard === b.id ? 'bg-[#F9C80E]' : 'bg-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1">
                  Total Marks Obtained (out of {studentBoard === 'sslc' ? 625 : studentBoard === 'puc' ? 600 : 500})
                </label>
                <input
                  type="number"
                  value={boardMarks}
                  onChange={(e) => setBoardMarks(e.target.value)}
                  placeholder="Enter marks e.g. 540"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-lg font-bold"
                />
              </div>
              {(() => {
                const max = studentBoard === 'sslc' ? 625 : studentBoard === 'puc' ? 600 : 500;
                const hasInput = boardMarks.trim() !== '';
                const val = Math.min(max, Math.max(0, Number(boardMarks) || 0));
                const pct = hasInput ? (val / max) * 100 : 0;
                const grade = !hasInput
                  ? 'Enter Marks'
                  : pct >= 85
                  ? 'Distinction'
                  : pct >= 60
                  ? 'First Class'
                  : pct >= 50
                  ? 'Second Class'
                  : pct >= 35
                  ? 'Pass Class'
                  : 'Needs Re-Exam';
                return (
                  <div className="p-4 rounded-xl bg-[#CEE5DC]/65 border border-[#2F3E4E] flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-[#475569] uppercase">Board Percentage</div>
                      <div className="font-mono text-2xl font-extrabold text-[#2F3E4E]">{pct.toFixed(2)}%</div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-[#FFFDF5] border border-[#2F3E4E] text-xs font-bold text-[#2F3E4E]">
                      {grade}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Card 2: Credit-Weighted Degree SGPA & CGPA */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Degree CGPA Aggregate
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSemesters([{ name: 'Semester 1', sgpa: '', credits: '' }])}
                    className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white hover:bg-[#FFE1B3] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSemesters((p) => [...p, { name: `Semester ${p.length + 1}`, sgpa: '', credits: '' }])
                    }
                    className="px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold cursor-pointer"
                  >
                    + Sem
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {semesters.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 items-center text-xs">
                    <span className="col-span-2 font-bold text-[#2F3E4E] truncate">{s.name}</span>
                    <input
                      type="number"
                      step={0.1}
                      max={10}
                      min={0}
                      value={s.sgpa}
                      onChange={(e) =>
                        setSemesters((p) => p.map((x, i) => (i === idx ? { ...x, sgpa: e.target.value } : x)))
                      }
                      placeholder="SGPA"
                      title="SGPA"
                      className="px-2 py-1 rounded border border-[#2F3E4E] bg-white font-mono"
                    />
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={s.credits}
                      onChange={(e) =>
                        setSemesters((p) => p.map((x, i) => (i === idx ? { ...x, credits: e.target.value } : x)))
                      }
                      placeholder="Credits"
                      title="Credits"
                      className="px-2 py-1 rounded border border-[#2F3E4E] bg-white font-mono"
                    />
                    <button
                      type="button"
                      disabled={semesters.length <= 1}
                      onClick={() => setSemesters((p) => p.filter((_, i) => i !== idx))}
                      className="text-red-700 font-bold cursor-pointer disabled:opacity-30"
                    >
                      Del
                    </button>
                  </div>
                ))}
              </div>
              {(() => {
                const totCredits = semesters.reduce((sum, s) => sum + Math.max(0, Number(s.credits) || 0), 0);
                const weighted = semesters.reduce(
                  (sum, s) => sum + (Math.max(0, Number(s.sgpa) || 0) * Math.max(0, Number(s.credits) || 0)),
                  0
                );
                const cgpa = totCredits > 0 ? weighted / totCredits : 0;
                return (
                  <div className="p-4 rounded-xl bg-[#FEF2C8] border border-[#2F3E4E] flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-[#475569] uppercase">Cumulative CGPA</div>
                      <div className="font-mono text-2xl font-extrabold text-[#2F3E4E]">{cgpa.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-bold text-[#475569] uppercase">AICTE Eq %</div>
                      <div className="font-mono text-sm font-bold text-[#2F3E4E]">
                        {cgpa > 0 ? Math.max(0, (cgpa - 0.75) * 10).toFixed(1) : '0.0'}%
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Card 3: 75% / 85% Attendance & Bunk Planner */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Attendance &amp; Bunk Planner
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setAttHeld('');
                    setAttPresent('');
                    setAttTarget(75);
                  }}
                  className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white hover:bg-[#FFE1B3] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Classes Held</label>
                  <input
                    type="number"
                    min={0}
                    value={attHeld}
                    onChange={(e) => setAttHeld(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full px-2.5 py-2 rounded-lg border border-[#2F3E4E] bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Attended</label>
                  <input
                    type="number"
                    min={0}
                    value={attPresent}
                    onChange={(e) => setAttPresent(e.target.value)}
                    placeholder="e.g. 48"
                    className="w-full px-2.5 py-2 rounded-lg border border-[#2F3E4E] bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Target %</label>
                  <select value={attTarget} onChange={(e) => setAttTarget(Number(e.target.value))} className="w-full px-2 py-2 rounded-lg border border-[#2F3E4E] bg-white font-bold">
                    <option value={75}>75%</option>
                    <option value={80}>80%</option>
                    <option value={85}>85%</option>
                  </select>
                </div>
              </div>
              {(() => {
                const heldNum = Math.max(0, Number(attHeld) || 0);
                const presNum = Math.max(0, Number(attPresent) || 0);
                if (heldNum === 0) {
                  return (
                    <div className="p-4 rounded-xl border border-[#2F3E4E] bg-[#FEF2C8]/55 space-y-1">
                      <div className="font-mono text-2xl font-extrabold text-[#2F3E4E]">0.0%</div>
                      <div className="text-xs font-medium text-[#475569]">
                        Enter classes held and attended above to check attendance buffer.
                      </div>
                    </div>
                  );
                }
                const curPct = (presNum / heldNum) * 100;
                const req = attTarget / 100;
                const canBunk = curPct >= attTarget ? Math.floor((presNum - req * heldNum) / req) : 0;
                const needAttend = curPct < attTarget ? Math.ceil((req * heldNum - presNum) / (1 - req)) : 0;
                return (
                  <div className={`p-4 rounded-xl border border-[#2F3E4E] space-y-1 ${curPct >= attTarget ? 'bg-[#CEE5DC]/65' : 'bg-[#FFE1B3]/70'}`}>
                    <div className="font-mono text-2xl font-extrabold text-[#2F3E4E]">{curPct.toFixed(1)}%</div>
                    <div className="text-xs font-bold text-[#2F3E4E]">
                      {curPct >= attTarget
                        ? `Safe! You may bunk up to ${canBunk} upcoming class(es) and stay ≥ ${attTarget}%.`
                        : `Shortfall! Attend next ${needAttend} consecutive class(es) to reach ${attTarget}%.`}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {(() => {
            const maxMarks = studentBoard === 'sslc' ? 625 : studentBoard === 'puc' ? 600 : 500;
            const marksObt = Math.min(maxMarks, Math.max(0, Number(boardMarks) || 0));
            const boardPct = boardMarks.trim() ? (marksObt / maxMarks) * 100 : 0;
            const totCredits = semesters.reduce((sum, s) => sum + Math.max(0, Number(s.credits) || 0), 0);
            const weighted = semesters.reduce(
              (sum, s) => sum + (Math.max(0, Number(s.sgpa) || 0) * Math.max(0, Number(s.credits) || 0)),
              0
            );
            const cgpa = totCredits > 0 ? weighted / totCredits : 0;
            const heldNum = Math.max(0, Number(attHeld) || 0);
            const presNum = Math.max(0, Number(attPresent) || 0);
            const attPct = heldNum > 0 ? (presNum / heldNum) * 100 : 0;
            const clearAllStudent = () => {
              setBoardMarks('');
              setSemesters([{ name: 'Semester 1', sgpa: '', credits: '' }]);
              setAttHeld('');
              setAttPresent('');
              setAttTarget(75);
            };
            return (
              <ToolExportBar
                onClear={clearAllStudent}
                onCopy={() => {
                  const summaryLines = [
                    'Student Academic & Attendance Summary',
                    `Board (${studentBoard.toUpperCase()}): ${marksObt}/${maxMarks} (${boardPct.toFixed(2)}%)`,
                    `Cumulative CGPA: ${cgpa.toFixed(2)} (AICTE Eq: ${cgpa > 0 ? Math.max(0, (cgpa - 0.75) * 10).toFixed(1) : '0.0'}%)`,
                    `Attendance: ${presNum}/${heldNum} (${attPct.toFixed(1)}%, Target: ${attTarget}%)`,
                  ];
                  void copyTextToClipboard(summaryLines.join('\n')).then((ok) => {
                    if (ok) {
                      setStudentCopied(true);
                      window.setTimeout(() => setStudentCopied(false), 1800);
                    }
                  });
                }}
                copied={studentCopied}
                copyLabel="Copy Summary"
                onExcel={() => {
                  downloadExcelWorkbook({
                    filename: 'Student_GPA_Summary.xlsx',
                    sheets: [
                      {
                        name: 'Summary',
                        headers: ['Metric', 'Value'],
                        rows: [
                          ['Board Exam', `${studentBoard.toUpperCase()} (${marksObt}/${maxMarks})`],
                          ['Board Percentage', `${boardPct.toFixed(2)}%`],
                          ['Cumulative CGPA', cgpa.toFixed(2)],
                          ['AICTE Equivalent %', `${cgpa > 0 ? Math.max(0, (cgpa - 0.75) * 10).toFixed(1) : '0.0'}%`],
                          ['Attendance', `${presNum}/${heldNum} (${attPct.toFixed(1)}%)`],
                        ],
                      },
                      {
                        name: 'Semesters',
                        headers: ['Semester', 'SGPA', 'Credits'],
                        rows: semesters.map((s) => [s.name, s.sgpa || '0', s.credits || '0']),
                      },
                    ],
                  });
                }}
                onWord={() => {
                  void downloadWordDocument({
                    filename: 'Student_GPA_Summary.docx',
                    title: 'Student Academic & Attendance Report',
                    kpis: [
                      { label: 'Board %', value: `${boardPct.toFixed(2)}%` },
                      { label: 'Cumulative CGPA', value: cgpa.toFixed(2) },
                      { label: 'Attendance', value: `${attPct.toFixed(1)}%` },
                    ],
                    table: {
                      title: 'Semester SGPA Breakdown',
                      headers: ['Semester', 'SGPA', 'Credits'],
                      rows: semesters.map((s) => [s.name, s.sgpa || '—', s.credits || '—']),
                    },
                  });
                }}
                onJson={() => {
                  downloadJsonFile('Student_GPA_Summary.json', {
                    board: { studentBoard, marksObt, maxMarks, boardPct: Number(boardPct.toFixed(2)) },
                    cgpa: { semesters, cumulativeCgpa: Number(cgpa.toFixed(2)) },
                    attendance: { held: heldNum, present: presNum, target: attTarget, percentage: Number(attPct.toFixed(1)) },
                  });
                }}
                onPdf={() => {
                  exportStructuredReportPdf({
                    title: 'Student Academic & Attendance Report',
                    filename: 'Student_GPA_Summary.pdf',
                    kpis: [
                      { label: 'Board Percentage', value: `${boardPct.toFixed(2)}%` },
                      { label: 'Cumulative CGPA', value: cgpa.toFixed(2) },
                      { label: 'Attendance %', value: `${attPct.toFixed(1)}%` },
                    ],
                    table: {
                      title: 'Semester-wise SGPA & Credits',
                      headers: ['Semester', 'SGPA', 'Credits'],
                      rows: semesters.map((s) => [s.name, s.sgpa || '0', s.credits || '0']),
                    },
                  });
                }}
                onPrint={() => {
                  void printHtmlDocument({
                    title: 'Student Academic & Attendance Report',
                    bodyHtml: `
                      <h1>Student Academic &amp; Attendance Report</h1>
                      <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-label">Board (${studentBoard.toUpperCase()})</div><div class="kpi-val">${boardPct.toFixed(2)}%</div></div>
                        <div class="kpi-card"><div class="kpi-label">Cumulative CGPA</div><div class="kpi-val">${cgpa.toFixed(2)}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Attendance</div><div class="kpi-val">${attPct.toFixed(1)}%</div></div>
                      </div>
                      <table>
                        <thead><tr><th>Semester</th><th class="num">SGPA</th><th class="num">Credits</th></tr></thead>
                        <tbody>${semesters.map((s) => `<tr><td>${s.name}</td><td class="num">${s.sgpa || '—'}</td><td class="num">${s.credits || '—'}</td></tr>`).join('')}</tbody>
                      </table>
                    `,
                  });
                }}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

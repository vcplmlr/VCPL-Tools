import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Keyboard,
  Laptop,
  Monitor,
  Printer,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';

interface KeyboardShortcutsViewProps {
  tool?: ToolCatalogItem;
}

type PlatformView = 'both' | 'windows' | 'mac';

interface ShortcutItem {
  id: string;
  category:
    | 'Essentials & Clipboard'
    | 'Typing & Text Editing'
    | 'Desktop & File Manager'
    | 'Screenshots & Screen'
    | 'Browser & Tabs'
    | 'Office, Word & Excel'
    | 'Function Keys (F1–F12)';
  action: string;
  explanation: string;
  winKeys: string[];
  macKeys: string[];
  tip?: string;
}

const SHORTCUT_CATEGORIES: ShortcutItem['category'][] = [
  'Essentials & Clipboard',
  'Typing & Text Editing',
  'Desktop & File Manager',
  'Screenshots & Screen',
  'Browser & Tabs',
  'Office, Word & Excel',
  'Function Keys (F1–F12)',
];

const KEYBOARD_SHORTCUTS: ShortcutItem[] = [
  // 1. Essentials & Clipboard
  {
    id: 'copy',
    category: 'Essentials & Clipboard',
    action: 'Copy Selected Item or Text',
    explanation:
      'Copies highlighted text, files, cells, or images to your clipboard without deleting the original.',
    winKeys: ['Ctrl', 'C'],
    macKeys: ['⌘ Cmd', 'C'],
  },
  {
    id: 'paste',
    category: 'Essentials & Clipboard',
    action: 'Paste Copied Content',
    explanation:
      'Inserts whatever you last copied or cut directly at the active cursor position or folder.',
    winKeys: ['Ctrl', 'V'],
    macKeys: ['⌘ Cmd', 'V'],
  },
  {
    id: 'paste-plain',
    category: 'Essentials & Clipboard',
    action: 'Paste as Plain Text (No Formatting)',
    explanation:
      'Strips fonts, background highlights, and website styling when pasting into Word, emails, or forms.',
    winKeys: ['Ctrl', 'Shift', 'V'],
    macKeys: ['⌘ Cmd', '⌥ Option', 'Shift', 'V'],
    tip: 'Ideal when copying text from web pages into documents',
  },
  {
    id: 'clipboard-history',
    category: 'Essentials & Clipboard',
    action: 'Open Clipboard History',
    explanation:
      'Shows your last multiple copied snippets and screenshots so you can pick older items to paste.',
    winKeys: ['Win', 'V'],
    macKeys: ['⌘ Cmd', 'Space'],
    tip: 'Built into Windows 10/11; macOS Spotlight/notes or Clipboard managers provide history',
  },
  {
    id: 'cut',
    category: 'Essentials & Clipboard',
    action: 'Cut Selected Text or File',
    explanation:
      'Removes the selected text immediately to move it elsewhere; in macOS Finder, copy first then move.',
    winKeys: ['Ctrl', 'X'],
    macKeys: ['⌘ Cmd', 'X'],
    tip: 'For moving files in Mac Finder, copy with ⌘+C then move with ⌘+⌥+V',
  },
  {
    id: 'undo-redo',
    category: 'Essentials & Clipboard',
    action: 'Undo & Redo Last Action',
    explanation:
      'Reverses your most recent edit or restores an action you just undid.',
    winKeys: ['Ctrl', 'Z / Ctrl+Y'],
    macKeys: ['⌘ Cmd', 'Z / ⌘+Shift+Z'],
  },
  {
    id: 'select-all',
    category: 'Essentials & Clipboard',
    action: 'Select All Content',
    explanation:
      'Highlights all text in an editor, every cell in a sheet, or all files inside the open folder.',
    winKeys: ['Ctrl', 'A'],
    macKeys: ['⌘ Cmd', 'A'],
  },
  {
    id: 'save-print-find',
    category: 'Essentials & Clipboard',
    action: 'Save / Print / Find in Page',
    explanation:
      'Universal productivity trio across browsers, editors, PDF readers, and spreadsheets.',
    winKeys: ['Ctrl', 'S / P / F'],
    macKeys: ['⌘ Cmd', 'S / P / F'],
  },

  // 2. Typing & Text Editing
  {
    id: 'jump-word',
    category: 'Typing & Text Editing',
    action: 'Move Cursor One Word Left or Right',
    explanation:
      'Jumps word-by-word across sentences much faster than tapping Left/Right arrows repeatedly.',
    winKeys: ['Ctrl', '← / →'],
    macKeys: ['⌥ Option', '← / →'],
  },
  {
    id: 'select-word',
    category: 'Typing & Text Editing',
    action: 'Highlight Whole Word by Word',
    explanation:
      'Expands your text selection one complete word at a time in either direction.',
    winKeys: ['Ctrl', 'Shift', '← / →'],
    macKeys: ['⌥ Option', 'Shift', '← / →'],
  },
  {
    id: 'delete-word',
    category: 'Typing & Text Editing',
    action: 'Delete Entire Previous Word',
    explanation:
      'Erases the entire word to the left of the cursor in a single keystroke instead of single characters.',
    winKeys: ['Ctrl', 'Backspace'],
    macKeys: ['⌥ Option', 'Delete ⌫'],
  },
  {
    id: 'line-start-end',
    category: 'Typing & Text Editing',
    action: 'Jump to Start or End of Current Line',
    explanation:
      'Moves the cursor straight to the beginning or end of the line you are currently typing on.',
    winKeys: ['Home / End'],
    macKeys: ['⌘ Cmd', '← / →'],
    tip: 'On laptops without dedicated Home/End keys, try Fn + ← / → on Windows',
  },
  {
    id: 'doc-start-end',
    category: 'Typing & Text Editing',
    action: 'Jump to Top or Bottom of Document',
    explanation:
      'Scrolls and places the cursor immediately at the very first or very last character of a long file.',
    winKeys: ['Ctrl', 'Home / End'],
    macKeys: ['⌘ Cmd', '↑ / ↓'],
  },
  {
    id: 'emoji-picker',
    category: 'Typing & Text Editing',
    action: 'Open Built-in Emoji & Symbol Picker',
    explanation:
      'Pops up emojis, currency symbols (₹), arrows, and special punctuation inside any text box.',
    winKeys: ['Win', '. (Period)'],
    macKeys: ['⌃ Ctrl', '⌘ Cmd', 'Space'],
  },

  // 3. Desktop & File Manager
  {
    id: 'switch-apps',
    category: 'Desktop & File Manager',
    action: 'Switch Between Open Apps',
    explanation:
      'Cycles rapidly through all running windows/applications; hold modifier key and tap Tab to pick.',
    winKeys: ['Alt', 'Tab'],
    macKeys: ['⌘ Cmd', 'Tab'],
  },
  {
    id: 'close-window-quit',
    category: 'Desktop & File Manager',
    action: 'Close Window vs Quit Full App',
    explanation:
      'Windows closes the app window; Mac differentiates closing a window (⌘+W) vs quitting the whole app (⌘+Q).',
    winKeys: ['Alt', 'F4'],
    macKeys: ['⌘ Cmd', 'Q (or ⌘+W window)'],
  },
  {
    id: 'file-manager',
    category: 'Desktop & File Manager',
    action: 'Open File Explorer / New Finder Window',
    explanation:
      'Opens your computer folders immediately so you can access Downloads, Desktop, and drives.',
    winKeys: ['Win', 'E'],
    macKeys: ['⌘ Cmd', 'N (in Finder)'],
  },
  {
    id: 'rename-file',
    category: 'Desktop & File Manager',
    action: 'Rename Selected File or Folder',
    explanation:
      'Highlights the filename for quick renaming without right-clicking.',
    winKeys: ['F2'],
    macKeys: ['Return ⏎'],
    tip: 'On Mac, pressing Enter/Return renames a file; ⌘+O opens it',
  },
  {
    id: 'new-folder',
    category: 'Desktop & File Manager',
    action: 'Create a New Folder Instantly',
    explanation:
      'Creates an untitled folder right inside the active directory ready for typing its name.',
    winKeys: ['Ctrl', 'Shift', 'N'],
    macKeys: ['⌘ Cmd', 'Shift', 'N'],
  },
  {
    id: 'permanent-delete',
    category: 'Desktop & File Manager',
    action: 'Delete Permanently (Skip Recycle Bin / Trash)',
    explanation:
      'Erases selected files immediately without moving them into Recycle Bin or Trash—use carefully.',
    winKeys: ['Shift', 'Delete'],
    macKeys: ['⌘ Cmd', '⌥ Option', 'Delete ⌫'],
  },
  {
    id: 'lock-screen',
    category: 'Desktop & File Manager',
    action: 'Lock Laptop / Desktop Screen Immediately',
    explanation:
      'Secures your session before stepping away from your desk in an office or public space.',
    winKeys: ['Win', 'L'],
    macKeys: ['⌃ Ctrl', '⌘ Cmd', 'Q'],
  },
  {
    id: 'snap-minimize',
    category: 'Desktop & File Manager',
    action: 'Snap Window Left/Right or Show Desktop',
    explanation:
      'Tile two apps side-by-side cleanly on screen, or minimize/hide clutter to see Desktop.',
    winKeys: ['Win', '← / → (or Win+D)'],
    macKeys: ['Fn', '⌃ Ctrl', '← / → (Sequoia+)'],
    tip: 'On Mac, ⌘+H hides current app and ⌘+M minimizes active window',
  },
  {
    id: 'force-quit',
    category: 'Desktop & File Manager',
    action: 'Task Manager / Force Quit Frozen App',
    explanation:
      'Opens the system monitor to close an unresponsive application cleanly without rebooting.',
    winKeys: ['Ctrl', 'Shift', 'Esc'],
    macKeys: ['⌘ Cmd', '⌥ Option', 'Esc'],
  },

  // 4. Screenshots & Screen
  {
    id: 'snip-area',
    category: 'Screenshots & Screen',
    action: 'Capture Selected Area / Snipping Tool',
    explanation:
      'Dims the screen so you can drag a rectangle around any region, receipt, or error dialog.',
    winKeys: ['Win', 'Shift', 'S'],
    macKeys: ['⌘ Cmd', 'Shift', '4'],
    tip: 'On Mac, press Space after ⌘+Shift+4 to capture an exact window cleanly',
  },
  {
    id: 'fullscreen-shot',
    category: 'Screenshots & Screen',
    action: 'Capture Entire Screen to File / Clipboard',
    explanation:
      'Saves a full-screen image directly (Mac saves to Desktop; Win+PrtScn saves to Pictures > Screenshots).',
    winKeys: ['Win', 'PrtScn'],
    macKeys: ['⌘ Cmd', 'Shift', '3'],
  },
  {
    id: 'screen-record',
    category: 'Screenshots & Screen',
    action: 'Open Screen Recording & Capture Toolbar',
    explanation:
      'Launches video recording or delayed screenshot controls natively without third-party apps.',
    winKeys: ['Win', 'Alt', 'R (Game Bar)'],
    macKeys: ['⌘ Cmd', 'Shift', '5'],
  },

  // 5. Browser & Tabs
  {
    id: 'new-close-tab',
    category: 'Browser & Tabs',
    action: 'New Tab & Close Active Tab',
    explanation:
      'Opens a fresh browser tab or closes only the active tab without shutting down the browser.',
    winKeys: ['Ctrl', 'T / Ctrl+W'],
    macKeys: ['⌘ Cmd', 'T / ⌘+W'],
  },
  {
    id: 'reopen-tab',
    category: 'Browser & Tabs',
    action: 'Reopen Accidentally Closed Tab',
    explanation:
      'Brings back the last tab(s) you closed, including form page history, in reverse order.',
    winKeys: ['Ctrl', 'Shift', 'T'],
    macKeys: ['⌘ Cmd', 'Shift', 'T'],
  },
  {
    id: 'address-bar',
    category: 'Browser & Tabs',
    action: 'Jump to Address / Search Bar',
    explanation:
      'Highlights the current website URL immediately so you can type a new link or search term.',
    winKeys: ['Ctrl', 'L (or Alt+D)'],
    macKeys: ['⌘ Cmd', 'L'],
  },
  {
    id: 'incognito',
    category: 'Browser & Tabs',
    action: 'Open Private / Incognito Window',
    explanation:
      'Launches a clean session without saved cookies or login state—great for testing portals.',
    winKeys: ['Ctrl', 'Shift', 'N'],
    macKeys: ['⌘ Cmd', 'Shift', 'N'],
    tip: 'In Firefox on Windows use Ctrl+Shift+P; on Mac use ⌘+Shift+P',
  },
  {
    id: 'hard-refresh',
    category: 'Browser & Tabs',
    action: 'Hard Reload Page (Bypass Cache)',
    explanation:
      'Forces the browser to re-download fresh page code and styles instead of using cached files.',
    winKeys: ['Ctrl', 'Shift', 'R (or Ctrl+F5)'],
    macKeys: ['⌘ Cmd', 'Shift', 'R'],
  },
  {
    id: 'zoom-reset',
    category: 'Browser & Tabs',
    action: 'Zoom In, Zoom Out & Reset 100%',
    explanation:
      'Scales page text larger or smaller for readability and snaps straight back to default size.',
    winKeys: ['Ctrl', '+ / - / 0'],
    macKeys: ['⌘ Cmd', '+ / - / 0'],
  },

  // 6. Office, Word & Excel
  {
    id: 'bold-italic-under',
    category: 'Office, Word & Excel',
    action: 'Bold, Italic & Underline Formatting',
    explanation:
      'Applies or removes standard emphasis styling to selected text in Word, Docs, Excel, and Notion.',
    winKeys: ['Ctrl', 'B / I / U'],
    macKeys: ['⌘ Cmd', 'B / I / U'],
  },
  {
    id: 'find-replace',
    category: 'Office, Word & Excel',
    action: 'Find & Replace Text / Values',
    explanation:
      'Replaces repeated spelling mistakes, GST rates, or dates across an entire sheet or document.',
    winKeys: ['Ctrl', 'H'],
    macKeys: ['⌘ Cmd', 'Shift', 'H (or ⌘+F)'],
  },
  {
    id: 'excel-filter',
    category: 'Office, Word & Excel',
    action: 'Toggle Table Column Filters (Excel / Sheets)',
    explanation:
      'Adds or removes filter dropdown arrows on the header row of your spreadsheet.',
    winKeys: ['Ctrl', 'Shift', 'L'],
    macKeys: ['⌘ Cmd', 'Shift', 'F (or L)'],
  },
  {
    id: 'excel-autosum',
    category: 'Office, Word & Excel',
    action: 'Insert =SUM() Formula Automatically',
    explanation:
      'Detects adjacent numeric columns/rows and writes the SUM range formula in one press.',
    winKeys: ['Alt', '='],
    macKeys: ['⌘ Cmd', 'Shift', 'T'],
  },
  {
    id: 'excel-date',
    category: 'Office, Word & Excel',
    action: 'Insert Today’s Static Date in Cell',
    explanation:
      'Stamps the current date into the active spreadsheet cell without changing tomorrow.',
    winKeys: ['Ctrl', ';'],
    macKeys: ['⌃ Ctrl', ';'],
  },
  {
    id: 'insert-link',
    category: 'Office, Word & Excel',
    action: 'Insert Hyperlink on Selected Text',
    explanation:
      'Turns highlighted text into a clickable URL link in documents, emails, and spreadsheets.',
    winKeys: ['Ctrl', 'K'],
    macKeys: ['⌘ Cmd', 'K'],
  },

  // 7. Function Keys (F1–F12)
  {
    id: 'f1-f2-f3',
    category: 'Function Keys (F1–F12)',
    action: 'F1 (Help) · F2 (Rename / Edit Cell) · F3 (Search)',
    explanation:
      'F2 edits the active Excel cell without double-clicking or renames files in Explorer; on MacBook hold Fn to use F-keys.',
    winKeys: ['F1 / F2 / F3'],
    macKeys: ['Fn', 'F1 / F2 / F3'],
    tip: 'MacBook top row defaults to brightness/volume unless you hold Fn or toggle System Settings',
  },
  {
    id: 'f4-f5-f11',
    category: 'Function Keys (F1–F12)',
    action: 'F4 (Repeat / Lock $) · F5 (Refresh / Slide Show) · F11 (Fullscreen)',
    explanation:
      'In Excel, F4 toggles absolute cell references ($A$1). F5 reloads browsers or starts PowerPoint presentations.',
    winKeys: ['F4 / F5 / F11'],
    macKeys: ['Fn+F4 (⌘+T in Excel) / ⌘+R / ⌃+⌘+F'],
  },
  {
    id: 'f12-saveas',
    category: 'Function Keys (F1–F12)',
    action: 'F12 (Save As in Office / Browser DevTools)',
    explanation:
      'Opens Save As dialog immediately in Word/Excel or opens Developer Inspector in Chrome & Edge.',
    winKeys: ['F12'],
    macKeys: ['⌘ Cmd', 'Shift', 'S / ⌘+⌥+I'],
  },
];

function KeyCapGroup({ keys, tone }: { keys: string[]; tone: 'win' | 'mac' }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((key, idx) => (
        <React.Fragment key={`${key}-${idx}`}>
          {idx > 0 && (
            <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400">+</span>
          )}
          <kbd
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold shadow-[0_1.5px_0_rgba(47,62,78,0.35)] whitespace-nowrap ${
              tone === 'win'
                ? 'bg-[#FFFDF5] dark:bg-[#0B1120] border-[#2F3E4E]/45 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-100'
                : 'bg-[#EEF2FF] dark:bg-indigo-950/60 border-[#4338CA]/35 dark:border-indigo-500/50 text-[#312E81] dark:text-indigo-200'
            }`}
          >
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

export const KeyboardShortcutsView: React.FC<KeyboardShortcutsViewProps> = ({ tool }) => {
  const [platformView, setPlatformView] = useState<PlatformView>('both');
  const [activeCategory, setActiveCategory] = useState<'All' | ShortcutItem['category']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return KEYBOARD_SHORTCUTS.filter((item) => {
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.action.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.winKeys.join(' ').toLowerCase().includes(q) ||
        item.macKeys.join(' ').toLowerCase().includes(q) ||
        (item.tip?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activeCategory, searchQuery]);

  const handleCopyShortcut = async (item: ShortcutItem) => {
    const text = `${item.action}\nWindows / Laptop: ${item.winKeys.join(' + ')}\nMacBook / macOS: ${item.macKeys.join(' + ')}\n${item.explanation}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls Card */}
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-display font-extrabold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E]">
                {tool?.code || 'LN-01'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#CEE5DC] dark:bg-emerald-950/70 text-[#12805C] dark:text-emerald-300 border border-[#2F3E4E]/30 dark:border-emerald-500/40">
                Learn Tools · Typing &amp; Text
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]/30">
                {KEYBOARD_SHORTCUTS.length} Shortcuts Explained
              </span>
            </div>

            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight flex items-center gap-2">
              <Keyboard className="w-6 h-6 text-[#12805C] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
              <span>Keyboard Shortcuts Guide — Windows Laptop, Desktop &amp; MacBook</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl">
              Side-by-side keyboard shortcuts with clear explanations for normal Windows/Linux
              laptops &amp; desktop keyboards and Apple MacBooks.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] text-xs font-display font-bold shadow-[0_2px_0_#1A242F] hover:-translate-y-0.5 transition-all cursor-pointer shrink-0"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print Cheat Sheet</span>
          </button>
        </div>

        {/* Mac vs Windows Key Translation Legend */}
        <div className="rounded-xl bg-[#FEF2C8]/75 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded bg-[#EEF2FF] dark:bg-indigo-950 border border-[#4338CA]/40 font-mono font-bold text-[#312E81] dark:text-indigo-200">
              ⌘ Cmd
            </kbd>
            <span className="text-[#475569] dark:text-slate-300">
              ≈ <strong>Ctrl</strong> on Windows/Linux
            </span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded bg-[#EEF2FF] dark:bg-indigo-950 border border-[#4338CA]/40 font-mono font-bold text-[#312E81] dark:text-indigo-200">
              ⌥ Option
            </kbd>
            <span className="text-[#475569] dark:text-slate-300">
              ≈ <strong>Alt</strong> on normal keyboards
            </span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded bg-[#EEF2FF] dark:bg-indigo-950 border border-[#4338CA]/40 font-mono font-bold text-[#312E81] dark:text-indigo-200">
              ⌫ Delete
            </kbd>
            <span className="text-[#475569] dark:text-slate-300">
              ≈ <strong>Backspace</strong> (Fn+⌫ = Del)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 rounded bg-[#FFFDF5] dark:bg-slate-900 border border-[#2F3E4E]/40 font-mono font-bold text-[#2F3E4E] dark:text-slate-100">
              Fn + F1–F12
            </kbd>
            <span className="text-[#475569] dark:text-slate-300">
              For laptop &amp; MacBook top-row keys
            </span>
          </div>
        </div>

        {/* Filter Bar: Platform Toggle + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Platform Filter">
            {[
              { id: 'both' as PlatformView, label: 'Compare Both', Icon: Sparkles },
              { id: 'windows' as PlatformView, label: 'Windows / Laptop & Desktop', Icon: Monitor },
              { id: 'mac' as PlatformView, label: 'MacBook / macOS', Icon: Laptop },
            ].map(({ id, label, Icon }) => {
              const active = platformView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlatformView(id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-display font-bold border-[1.5px] transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                      : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search key or action (e.g. screenshot, Cmd, F2)..."
              aria-label="Search keyboard shortcuts"
              className="w-full pl-9 pr-8 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear shortcut search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#64748B] hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-800">
          {(['All', ...SHORTCUT_CATEGORIES] as const).map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                    : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results List */}
      {filteredShortcuts.length === 0 ? (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-8 text-center space-y-2">
          <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
            No keyboard shortcuts matched &ldquo;{searchQuery}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('All');
            }}
            className="text-xs font-bold text-[#12805C] dark:text-[#F9C80E] underline cursor-pointer"
          >
            Reset search &amp; filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShortcuts.map((item) => {
            const isCopied = copiedId === item.id;
            return (
              <article
                key={item.id}
                className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-[0_3px_0_rgba(47,62,78,0.2)] dark:shadow-[0_3px_0_#020617]"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#12805C] dark:text-emerald-300 bg-[#CEE5DC]/65 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyShortcut(item)}
                      title="Copy shortcut explanation"
                      className="no-print inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[11px] font-semibold text-[#475569] dark:text-slate-300 cursor-pointer shrink-0"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-[#12805C]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <h3 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-50 leading-snug">
                    {item.action}
                  </h3>

                  <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                    {item.explanation}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-2">
                  {(platformView === 'both' || platformView === 'windows') && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-300">
                        <Monitor className="w-3.5 h-3.5 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
                        <span>Windows / Laptop:</span>
                      </span>
                      <KeyCapGroup keys={item.winKeys} tone="win" />
                    </div>
                  )}

                  {(platformView === 'both' || platformView === 'mac') && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#312E81] dark:text-indigo-300">
                        <Laptop className="w-3.5 h-3.5 text-[#4338CA] dark:text-indigo-400" aria-hidden="true" />
                        <span>MacBook / macOS:</span>
                      </span>
                      <KeyCapGroup keys={item.macKeys} tone="mac" />
                    </div>
                  )}

                  {item.tip && (
                    <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 bg-[#FEF2C8]/60 dark:bg-[#0B1120] rounded-lg px-2.5 py-1.5 border border-[#2F3E4E]/15 dark:border-slate-800">
                      Tip: {item.tip}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

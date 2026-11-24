import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  ListChecks,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Star,
  Table,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ToolCatalogItem } from '../../types/tools';
import { GoogleSignInButton } from '../GoogleSignInButton';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from '../../services/googleWorkspaceAuth';
import {
  CalendarEventItem,
  CalendarListItem,
  ChatMemberItem,
  ChatMessageItem,
  ChatSetupRequiredError,
  ChatSpaceItem,
  DriveActivityEntry,
  DriveFileItem,
  DriveFilterMode,
  GOOGLE_CHAT_CONSOLE_CONFIG_URL,
  GoogleFormDocument,
  GoogleFormResponseItem,
  MeetAccessType,
  MeetConferenceRecord,
  MeetEntryPointAccess,
  MeetParticipant,
  MeetRecording,
  MeetSpace,
  SpreadsheetMetadata,
  WorkspaceAuthExpiredError,
  appendSpreadsheetRow,
  batchUpdateGoogleForm,
  createCalendarEvent,
  createChatSpace,
  createDriveFolder,
  createGoogleForm,
  createMeetSpace,
  createSpreadsheet,
  deleteCalendarEvent,
  deleteChatMessage,
  deleteDriveFilePermanently,
  downloadDriveFile,
  endMeetActiveConference,
  formatSheetRange,
  getGoogleForm,
  getMeetSpace,
  getSpreadsheetMetadata,
  getSpreadsheetValues,
  listCalendarEvents,
  listChatMemberships,
  listChatMessages,
  listChatSpaces,
  listDriveFiles,
  listFormsFromDrive,
  listGoogleFormResponses,
  listMeetConferenceRecords,
  listMeetParticipants,
  listMeetRecordings,
  listSpreadsheetsFromDrive,
  listUserCalendars,
  patchMeetSpaceConfig,
  queryDriveActivity,
  renameDriveFile,
  sendChatMessage,
  setDriveFileStarred,
  setDriveFileTrashed,
  updateCalendarEvent,
  updateSpreadsheetValues,
  uploadFileToDrive,
} from '../../services/googleWorkspaceApis';

type WorkspaceTab = 'drive' | 'sheets' | 'calendar' | 'forms' | 'meet' | 'chat';

interface PendingConfirmAction {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'danger' | 'warning';
  affectedItems?: string[];
  onConfirm: () => Promise<void>;
}

function getInitialTabForTool(toolId: string): WorkspaceTab {
  if (toolId === 'google-sheets-studio') return 'sheets';
  if (toolId === 'google-calendar-planner') return 'calendar';
  if (toolId === 'google-forms-studio') return 'forms';
  if (toolId === 'google-meet-spaces') return 'meet';
  if (toolId === 'google-chat-hub') return 'chat';
  return 'drive';
}

function formatFileSize(sizeStr?: string): string {
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatIsoDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function describeDriveAction(entry: DriveActivityEntry): string {
  const detail = entry.primaryActionDetail || {};
  const keys = Object.keys(detail);
  if (keys.length === 0) return 'Activity';
  return keys[0].replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export const GoogleWorkspaceSuiteView: React.FC<{ tool: ToolCatalogItem }> = ({ tool }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => getInitialTabForTool(tool.id));
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Sync tab when switching between the 3 Workspace catalog tools
  useEffect(() => {
    setActiveTab(getInitialTabForTool(tool.id));
  }, [tool.id]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      (firebaseUser) => {
        setUser(firebaseUser);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      setStatusMessage(`Connected as ${result.user.email || result.user.displayName || 'Google User'}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed or was cancelled.';
      setErrorMessage(msg);
      setNeedsAuth(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
  };

  const requireToken = useCallback(async (): Promise<string | null> => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setNeedsAuth(true);
      setErrorMessage('Please sign in with Google to continue.');
      return null;
    }
    return token;
  }, [accessToken]);

  const [chatSetupError, setChatSetupError] = useState<{
    message: string;
    consoleUrl: string;
  } | null>(null);

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof WorkspaceAuthExpiredError) {
      setAccessToken(null);
      setNeedsAuth(true);
      setErrorMessage(err.message);
      return;
    }
    if (err instanceof ChatSetupRequiredError) {
      setChatSetupError({
        message: err.message,
        consoleUrl: err.consoleUrl,
      });
      setErrorMessage(err.message);
      return;
    }
    setErrorMessage(err instanceof Error ? err.message : 'Google Workspace API request failed.');
  }, []);

  // ===========================================================================
  // DRIVE STATE & ACTIONS
  // ===========================================================================
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveFilter, setDriveFilter] = useState<DriveFilterMode>('all');
  const [driveSearch, setDriveSearch] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [driveActivity, setDriveActivity] = useState<DriveActivityEntry[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDriveFiles = useCallback(
    async (mode: DriveFilterMode = driveFilter, q: string = driveSearch) => {
      const token = await requireToken();
      if (!token) return;
      setDriveLoading(true);
      setErrorMessage(null);
      try {
        const res = await listDriveFiles(token, {
          filterMode: mode,
          queryText: q,
          pageSize: 30,
        });
        setDriveFiles(res.files);
      } catch (err) {
        handleApiError(err);
      } finally {
        setDriveLoading(false);
      }
    },
    [driveFilter, driveSearch, handleApiError, requireToken]
  );

  const loadDriveActivityFeed = useCallback(async () => {
    const token = await requireToken();
    if (!token) return;
    setDriveLoading(true);
    setErrorMessage(null);
    try {
      const entries = await queryDriveActivity(token, 15);
      setDriveActivity(entries);
      setShowActivity(true);
    } catch (err) {
      handleApiError(err);
    } finally {
      setDriveLoading(false);
    }
  }, [handleApiError, requireToken]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const token = await requireToken();
    if (!token) return;
    setDriveLoading(true);
    setErrorMessage(null);
    try {
      const created = await createDriveFolder(token, newFolderName.trim());
      setNewFolderName('');
      setStatusMessage(`Created folder "${created.name}".`);
      await loadDriveFiles();
    } catch (err) {
      handleApiError(err);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const token = await requireToken();
    if (!token) return;
    setDriveLoading(true);
    setErrorMessage(null);
    try {
      const uploaded = await uploadFileToDrive(token, file);
      setStatusMessage(`Uploaded "${uploaded.name}" to Google Drive.`);
      await loadDriveFiles();
    } catch (err) {
      handleApiError(err);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDownloadDriveFile = async (file: DriveFileItem) => {
    const token = await requireToken();
    if (!token) return;
    setDriveLoading(true);
    setErrorMessage(null);
    try {
      const { blob, filename } = await downloadDriveFile(token, file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusMessage(`Downloaded "${filename}".`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setDriveLoading(false);
    }
  };

  const requestRenameDriveFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    const target = renameTarget;
    const nextName = renameValue.trim();
    setPendingConfirm({
      title: 'Rename Google Drive File?',
      description: `Rename "${target.currentName}" to "${nextName}" in your Google Drive?`,
      confirmLabel: 'Confirm Rename',
      tone: 'warning',
      affectedItems: [`Current: ${target.currentName}`, `New: ${nextName}`],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await renameDriveFile(token, target.id, nextName);
        setRenameTarget(null);
        setRenameValue('');
        setStatusMessage(`Renamed file to "${nextName}".`);
        await loadDriveFiles();
      },
    });
  };

  const requestToggleStar = (file: DriveFileItem) => {
    const nextStarred = !file.starred;
    setPendingConfirm({
      title: nextStarred ? 'Star Google Drive File?' : 'Remove Star from File?',
      description: `${nextStarred ? 'Add' : 'Remove'} star for "${file.name}" in Google Drive?`,
      confirmLabel: nextStarred ? 'Star File' : 'Remove Star',
      tone: 'warning',
      affectedItems: [file.name],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await setDriveFileStarred(token, file.id, nextStarred);
        setStatusMessage(`${nextStarred ? 'Starred' : 'Unstarred'} "${file.name}".`);
        await loadDriveFiles();
      },
    });
  };

  const requestTrashToggle = (file: DriveFileItem, trashed: boolean) => {
    setPendingConfirm({
      title: trashed ? 'Move File to Trash?' : 'Restore File from Trash?',
      description: trashed
        ? `Move "${file.name}" to your Google Drive Trash?`
        : `Restore "${file.name}" from Trash back into your Google Drive?`,
      confirmLabel: trashed ? 'Move to Trash' : 'Restore File',
      tone: trashed ? 'danger' : 'warning',
      affectedItems: [file.name],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await setDriveFileTrashed(token, file.id, trashed);
        setStatusMessage(
          trashed ? `Moved "${file.name}" to Trash.` : `Restored "${file.name}".`
        );
        await loadDriveFiles();
      },
    });
  };

  const requestPermanentDelete = (file: DriveFileItem) => {
    setPendingConfirm({
      title: 'Permanently Delete File from Google Drive?',
      description: `Are you sure you want to permanently delete "${file.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      tone: 'danger',
      affectedItems: [`${file.name} (ID: ${file.id})`],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await deleteDriveFilePermanently(token, file.id);
        setStatusMessage(`Permanently deleted "${file.name}".`);
        await loadDriveFiles();
      },
    });
  };

  // ===========================================================================
  // FORMS STATE & ACTIONS
  // ===========================================================================
  const [driveForms, setDriveForms] = useState<DriveFileItem[]>([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [activeForm, setActiveForm] = useState<GoogleFormDocument | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponseItem[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'SHORT' | 'PARAGRAPH' | 'RADIO'>('SHORT');
  const [newQuestionOptions, setNewQuestionOptions] = useState('Option 1, Option 2');
  const [editFormDescription, setEditFormDescription] = useState('');

  const loadFormsList = useCallback(async () => {
    const token = await requireToken();
    if (!token) return;
    setFormsLoading(true);
    setErrorMessage(null);
    try {
      const forms = await listFormsFromDrive(token);
      setDriveForms(forms);
    } catch (err) {
      handleApiError(err);
    } finally {
      setFormsLoading(false);
    }
  }, [handleApiError, requireToken]);

  const loadFormDetails = useCallback(
    async (formId: string) => {
      if (!formId.trim()) return;
      const token = await requireToken();
      if (!token) return;
      setFormsLoading(true);
      setErrorMessage(null);
      try {
        const [doc, responses] = await Promise.all([
          getGoogleForm(token, formId),
          listGoogleFormResponses(token, formId).catch(() => []),
        ]);
        setSelectedFormId(doc.formId);
        setActiveForm(doc);
        setEditFormDescription(doc.info?.description || '');
        setFormResponses(responses);
      } catch (err) {
        handleApiError(err);
      } finally {
        setFormsLoading(false);
      }
    },
    [handleApiError, requireToken]
  );

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormTitle.trim()) return;
    const token = await requireToken();
    if (!token) return;
    setFormsLoading(true);
    setErrorMessage(null);
    try {
      const created = await createGoogleForm(token, newFormTitle.trim());
      setNewFormTitle('');
      setStatusMessage(`Created Google Form "${created.info?.title || created.formId}".`);
      await loadFormsList();
      await loadFormDetails(created.formId);
    } catch (err) {
      handleApiError(err);
    } finally {
      setFormsLoading(false);
    }
  };

  const requestUpdateFormDescription = () => {
    if (!activeForm) return;
    const targetForm = activeForm;
    const nextDesc = editFormDescription.trim();
    setPendingConfirm({
      title: 'Update Google Form Description?',
      description: `Update the description of "${targetForm.info?.title || targetForm.formId}"?`,
      confirmLabel: 'Update Form',
      tone: 'warning',
      affectedItems: [targetForm.info?.title || targetForm.formId],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        const result = await batchUpdateGoogleForm(token, targetForm.formId, [
          {
            updateFormInfo: {
              info: { description: nextDesc },
              updateMask: 'description',
            },
          },
        ]);
        if (result.form) {
          setActiveForm(result.form);
        } else {
          await loadFormDetails(targetForm.formId);
        }
        setStatusMessage('Updated Google Form description.');
      },
    });
  };

  const requestAddFormQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !newQuestionTitle.trim()) return;
    const targetForm = activeForm;
    const questionText = newQuestionTitle.trim();
    const insertIndex = targetForm.items?.length ?? 0;

    const questionPayload: Record<string, unknown> =
      newQuestionType === 'RADIO'
        ? {
            required: false,
            choiceQuestion: {
              type: 'RADIO',
              options: newQuestionOptions
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((value) => ({ value })),
            },
          }
        : {
            required: false,
            textQuestion: {
              paragraph: newQuestionType === 'PARAGRAPH',
            },
          };

    setPendingConfirm({
      title: 'Add Question to Google Form?',
      description: `Append a new ${newQuestionType.toLowerCase()} question "${questionText}" to "${targetForm.info?.title || targetForm.formId}"?`,
      confirmLabel: 'Add Question',
      tone: 'warning',
      affectedItems: [
        `Form: ${targetForm.info?.title || targetForm.formId}`,
        `Question: ${questionText}`,
      ],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        const result = await batchUpdateGoogleForm(token, targetForm.formId, [
          {
            createItem: {
              item: {
                title: questionText,
                questionItem: {
                  question: questionPayload,
                },
              },
              location: { index: insertIndex },
            },
          },
        ]);
        setNewQuestionTitle('');
        if (result.form) {
          setActiveForm(result.form);
        } else {
          await loadFormDetails(targetForm.formId);
        }
        setStatusMessage(`Added question "${questionText}" to form.`);
      },
    });
  };

  const questionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of activeForm?.items || []) {
      const qId = item.questionItem?.question?.questionId;
      if (qId) {
        map.set(qId, item.title || qId);
      }
    }
    return map;
  }, [activeForm]);

  const handleExportResponsesCsv = () => {
    if (!activeForm || formResponses.length === 0) return;
    const qIds = Array.from(questionTitleById.keys());
    const headers = ['Response ID', 'Submitted At', 'Respondent Email', ...qIds.map((id) => questionTitleById.get(id) || id)];
    const escapeCsv = (val: string) =>
      /[",\r\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;

    const rows = formResponses.map((r) => {
      const cells = [
        r.responseId,
        r.lastSubmittedTime || r.createTime || '',
        r.respondentEmail || '',
        ...qIds.map((id) => {
          const ans = r.answers?.[id]?.textAnswers?.answers || [];
          return ans.map((a) => a.value || '').join('; ');
        }),
      ];
      return cells.map(escapeCsv).join(',');
    });

    const csv = `\uFEFF${[headers.map(escapeCsv).join(','), ...rows].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeForm.info?.title || 'google-form').replace(/[^a-z0-9-_]+/gi, '_')}_responses.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ===========================================================================
  // MEET STATE & ACTIONS
  // ===========================================================================
  const [meetSpace, setMeetSpace] = useState<MeetSpace | null>(null);
  const [meetLookupInput, setMeetLookupInput] = useState('');
  const [meetAccessType, setMeetAccessType] = useState<MeetAccessType>('TRUSTED');
  const [meetEntryPoint, setMeetEntryPoint] = useState<MeetEntryPointAccess>('ALL');
  const [meetRecords, setMeetRecords] = useState<MeetConferenceRecord[]>([]);
  const [selectedRecordName, setSelectedRecordName] = useState<string | null>(null);
  const [meetParticipants, setMeetParticipants] = useState<MeetParticipant[]>([]);
  const [meetRecordings, setMeetRecordings] = useState<MeetRecording[]>([]);
  const [meetLoading, setMeetLoading] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCreateMeetSpace = async () => {
    const token = await requireToken();
    if (!token) return;
    setMeetLoading(true);
    setErrorMessage(null);
    try {
      const created = await createMeetSpace(token, {
        accessType: meetAccessType,
        entryPointAccess: meetEntryPoint,
      });
      setMeetSpace(created);
      setMeetLookupInput(created.name);
      setStatusMessage(`Created Google Meet space (${created.meetingCode || created.name}).`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setMeetLoading(false);
    }
  };

  const handleLookupMeetSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetLookupInput.trim()) return;
    const token = await requireToken();
    if (!token) return;
    setMeetLoading(true);
    setErrorMessage(null);
    try {
      const space = await getMeetSpace(token, meetLookupInput.trim());
      setMeetSpace(space);
      if (space.config?.accessType) setMeetAccessType(space.config.accessType);
      if (space.config?.entryPointAccess) setMeetEntryPoint(space.config.entryPointAccess);
      setStatusMessage(`Loaded Meet space ${space.meetingCode || space.name}.`);
    } catch (err) {
      handleApiError(err);
    } finally {
      setMeetLoading(false);
    }
  };

  const requestUpdateMeetConfig = () => {
    if (!meetSpace) return;
    const targetSpace = meetSpace;
    const nextAccess = meetAccessType;
    const nextEntry = meetEntryPoint;
    setPendingConfirm({
      title: 'Update Google Meet Space Settings?',
      description: `Apply accessType="${nextAccess}" and entryPointAccess="${nextEntry}" to Meet space ${targetSpace.meetingCode || targetSpace.name}?`,
      confirmLabel: 'Apply Settings',
      tone: 'warning',
      affectedItems: [targetSpace.meetingUri || targetSpace.name],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        const updated = await patchMeetSpaceConfig(token, targetSpace.name, {
          accessType: nextAccess,
          entryPointAccess: nextEntry,
        });
        setMeetSpace(updated);
        setStatusMessage('Updated Google Meet space configuration.');
      },
    });
  };

  const requestEndActiveConference = () => {
    if (!meetSpace) return;
    const targetSpace = meetSpace;
    setPendingConfirm({
      title: 'End Active Google Meet Conference?',
      description: `Disconnect all participants and end the active call in ${targetSpace.meetingCode || targetSpace.name}?`,
      confirmLabel: 'End Conference',
      tone: 'danger',
      affectedItems: [targetSpace.meetingUri || targetSpace.name],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await endMeetActiveConference(token, targetSpace.name);
        const refreshed = await getMeetSpace(token, targetSpace.name);
        setMeetSpace(refreshed);
        setStatusMessage('Ended active Google Meet conference.');
      },
    });
  };

  const loadMeetRecords = useCallback(async () => {
    const token = await requireToken();
    if (!token) return;
    setMeetLoading(true);
    setErrorMessage(null);
    try {
      const records = await listMeetConferenceRecords(token, 20);
      setMeetRecords(records);
    } catch (err) {
      handleApiError(err);
    } finally {
      setMeetLoading(false);
    }
  }, [handleApiError, requireToken]);

  const loadMeetRecordDetails = async (recordName: string) => {
    const token = await requireToken();
    if (!token) return;
    setMeetLoading(true);
    setErrorMessage(null);
    setSelectedRecordName(recordName);
    try {
      const [participants, recordings] = await Promise.all([
        listMeetParticipants(token, recordName).catch(() => []),
        listMeetRecordings(token, recordName).catch(() => []),
      ]);
      setMeetParticipants(participants);
      setMeetRecordings(recordings);
    } catch (err) {
      handleApiError(err);
    } finally {
      setMeetLoading(false);
    }
  };

  // ===========================================================================
  // SHEETS STATE & ACTIONS
  // ===========================================================================
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveFileItem[]>([]);
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [newSpreadsheetTitle, setNewSpreadsheetTitle] = useState('');
  const [activeSpreadsheet, setActiveSpreadsheet] = useState<SpreadsheetMetadata | null>(null);
  const [selectedSheetTitle, setSelectedSheetTitle] = useState('');
  const [sheetRangeInput, setSheetRangeInput] = useState('A1:H25');
  const [sheetValues, setSheetValues] = useState<string[][]>([]);
  const [newRowInput, setNewRowInput] = useState('');
  const [cellUpdateRange, setCellUpdateRange] = useState('');
  const [cellUpdateValue, setCellUpdateValue] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);

  const loadSpreadsheetsList = useCallback(async () => {
    const token = await requireToken();
    if (!token) return;
    setSheetsLoading(true);
    setErrorMessage(null);
    try {
      const files = await listSpreadsheetsFromDrive(token, 25);
      setDriveSpreadsheets(files);
    } catch (err) {
      handleApiError(err);
    } finally {
      setSheetsLoading(false);
    }
  }, [handleApiError, requireToken]);

  const loadSpreadsheetTabValues = useCallback(
    async (spreadsheetId: string, tabTitle: string, a1Range = sheetRangeInput) => {
      const token = await requireToken();
      if (!token || !tabTitle) return;
      setSheetsLoading(true);
      setErrorMessage(null);
      try {
        const fullRange = formatSheetRange(tabTitle, a1Range.trim() || 'A1:H25');
        const res = await getSpreadsheetValues(token, spreadsheetId, fullRange);
        setSheetValues(res.values);
      } catch (err) {
        handleApiError(err);
      } finally {
        setSheetsLoading(false);
      }
    },
    [handleApiError, requireToken, sheetRangeInput]
  );

  const openSpreadsheet = useCallback(
    async (spreadsheetId: string) => {
      const cleanId = spreadsheetId.trim();
      if (!cleanId) return;
      const token = await requireToken();
      if (!token) return;
      setSheetsLoading(true);
      setErrorMessage(null);
      try {
        const meta = await getSpreadsheetMetadata(token, cleanId);
        setActiveSpreadsheet(meta);
        setSheetIdInput(meta.spreadsheetId);
        const firstTab = meta.sheets?.[0]?.properties?.title || '';
        setSelectedSheetTitle(firstTab);
        if (firstTab) {
          const fullRange = formatSheetRange(firstTab, sheetRangeInput.trim() || 'A1:H25');
          const res = await getSpreadsheetValues(token, meta.spreadsheetId, fullRange);
          setSheetValues(res.values);
        } else {
          setSheetValues([]);
        }
      } catch (err) {
        handleApiError(err);
      } finally {
        setSheetsLoading(false);
      }
    },
    [handleApiError, requireToken, sheetRangeInput]
  );

  const handleCreateSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpreadsheetTitle.trim()) return;
    const token = await requireToken();
    if (!token) return;
    setSheetsLoading(true);
    setErrorMessage(null);
    try {
      const created = await createSpreadsheet(token, newSpreadsheetTitle.trim(), 'SheetData');
      setNewSpreadsheetTitle('');
      setActiveSpreadsheet(created);
      setSheetIdInput(created.spreadsheetId);
      const firstTab = created.sheets?.[0]?.properties?.title || 'SheetData';
      setSelectedSheetTitle(firstTab);
      setSheetValues([]);
      setStatusMessage(`Created spreadsheet "${created.properties.title}".`);
      await loadSpreadsheetsList();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSheetsLoading(false);
    }
  };

  const requestAppendSheetRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpreadsheet || !selectedSheetTitle || !newRowInput.trim()) return;
    const rowCells = newRowInput.split(',').map((c) => c.trim());
    const targetId = activeSpreadsheet.spreadsheetId;
    const targetTitle = activeSpreadsheet.properties.title;
    const targetTab = selectedSheetTitle;

    setPendingConfirm({
      title: 'Append Row to Google Sheet?',
      description: `Append ${rowCells.length} column value(s) to tab "${targetTab}" in "${targetTitle}"?`,
      confirmLabel: 'Append Row',
      tone: 'warning',
      affectedItems: [targetTitle, `Tab: ${targetTab}`, `Values: ${rowCells.join(' | ')}`],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        const range = formatSheetRange(targetTab, 'A1');
        await appendSpreadsheetRow(token, targetId, range, rowCells);
        setNewRowInput('');
        await loadSpreadsheetTabValues(targetId, targetTab);
        setStatusMessage(`Appended row to "${targetTab}".`);
      },
    });
  };

  const requestUpdateSheetCells = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpreadsheet || !selectedSheetTitle || !cellUpdateRange.trim()) return;
    const targetId = activeSpreadsheet.spreadsheetId;
    const targetTitle = activeSpreadsheet.properties.title;
    const targetTab = selectedSheetTitle;
    const a1 = cellUpdateRange.trim();
    const rowValues = cellUpdateValue.split(',').map((c) => c.trim());
    const fullRange = formatSheetRange(targetTab, a1);

    setPendingConfirm({
      title: 'Overwrite Google Sheet Cells?',
      description: `Update range ${fullRange} in "${targetTitle}"? Existing cell values in this range will be overwritten.`,
      confirmLabel: 'Update Cells',
      tone: 'warning',
      affectedItems: [targetTitle, `Range: ${fullRange}`, `New Values: ${rowValues.join(' | ')}`],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await updateSpreadsheetValues(token, targetId, fullRange, [rowValues]);
        setCellUpdateRange('');
        setCellUpdateValue('');
        await loadSpreadsheetTabValues(targetId, targetTab);
        setStatusMessage(`Updated ${fullRange}.`);
      },
    });
  };

  const handleExportSheetCsv = () => {
    if (!activeSpreadsheet || sheetValues.length === 0) return;
    const escapeCsv = (val: string) =>
      /[",\r\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
    const csv = `\uFEFF${sheetValues
      .map((row) => row.map(escapeCsv).join(','))
      .join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeSpreadsheet.properties.title || 'sheet')
      .replace(/[^a-z0-9-_]+/gi, '_')}_${(selectedSheetTitle || 'tab').replace(/[^a-z0-9-_]+/gi, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ===========================================================================
  // CALENDAR STATE & ACTIONS
  // ===========================================================================
  const [calendars, setCalendars] = useState<CalendarListItem[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [eventSummary, setEventSummary] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStartLocal, setEventStartLocal] = useState(() => {
    const d = new Date(Date.now() + 3600_000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [eventEndLocal, setEventEndLocal] = useState(() => {
    const d = new Date(Date.now() + 7200_000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [eventAttendees, setEventAttendees] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventSummary, setEditingEventSummary] = useState('');

  const loadCalendarData = useCallback(
    async (calId = selectedCalendarId, q = calendarSearch) => {
      const token = await requireToken();
      if (!token) return;
      setCalendarLoading(true);
      setErrorMessage(null);
      try {
        const [calList, evList] = await Promise.all([
          listUserCalendars(token),
          listCalendarEvents(token, calId, {
            timeMin: new Date(Date.now() - 7 * 86400_000).toISOString(),
            maxResults: 30,
            q,
          }),
        ]);
        setCalendars(calList);
        setCalendarEvents(evList);
      } catch (err) {
        handleApiError(err);
      } finally {
        setCalendarLoading(false);
      }
    },
    [calendarSearch, handleApiError, requireToken, selectedCalendarId]
  );

  const requestCreateCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventSummary.trim() || !eventStartLocal || !eventEndLocal) return;
    const startIso = new Date(eventStartLocal).toISOString();
    const endIso = new Date(eventEndLocal).toISOString();
    const summary = eventSummary.trim();
    const calId = selectedCalendarId;
    const attendeeList = eventAttendees
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setPendingConfirm({
      title: 'Create Google Calendar Event?',
      description: `Schedule "${summary}" on calendar "${calId}"${attendeeList.length ? ` and invite ${attendeeList.length} attendee(s)` : ''}?`,
      confirmLabel: 'Create Event',
      tone: 'warning',
      affectedItems: [
        summary,
        `Start: ${new Date(startIso).toLocaleString('en-IN')}`,
        ...(attendeeList.length ? [`Attendees: ${attendeeList.join(', ')}`] : []),
      ],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await createCalendarEvent(token, calId, {
          summary,
          location: eventLocation,
          description: eventDescription,
          startIso,
          endIso,
          attendeeEmails: attendeeList,
        });
        setEventSummary('');
        setEventLocation('');
        setEventDescription('');
        setEventAttendees('');
        await loadCalendarData(calId, calendarSearch);
        setStatusMessage(`Created calendar event "${summary}".`);
      },
    });
  };

  const requestSaveEventTitleEdit = (ev: CalendarEventItem) => {
    const nextSummary = editingEventSummary.trim();
    if (!nextSummary || nextSummary === (ev.summary || '')) {
      setEditingEventId(null);
      return;
    }
    const calId = selectedCalendarId;
    setPendingConfirm({
      title: 'Update Calendar Event?',
      description: `Rename event "${ev.summary || '(Untitled)'}" to "${nextSummary}"?`,
      confirmLabel: 'Update Event',
      tone: 'warning',
      affectedItems: [ev.summary || ev.id, `New Title: ${nextSummary}`],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await updateCalendarEvent(token, calId, ev.id, { summary: nextSummary });
        setEditingEventId(null);
        await loadCalendarData(calId, calendarSearch);
        setStatusMessage(`Updated calendar event "${nextSummary}".`);
      },
    });
  };

  const requestDeleteCalendarEvent = (ev: CalendarEventItem) => {
    const calId = selectedCalendarId;
    setPendingConfirm({
      title: 'Delete Google Calendar Event?',
      description: `Permanently delete "${ev.summary || '(Untitled Event)'}" from Google Calendar?`,
      confirmLabel: 'Delete Event',
      tone: 'danger',
      affectedItems: [ev.summary || ev.id],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await deleteCalendarEvent(token, calId, ev.id);
        await loadCalendarData(calId, calendarSearch);
        setStatusMessage(`Deleted calendar event "${ev.summary || ev.id}".`);
      },
    });
  };

  // ===========================================================================
  // CHAT STATE & ACTIONS
  // ===========================================================================
  const [chatSpaces, setChatSpaces] = useState<ChatSpaceItem[]>([]);
  const [selectedChatSpace, setSelectedChatSpace] = useState<ChatSpaceItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatMembers, setChatMembers] = useState<ChatMemberItem[]>([]);
  const [newChatSpaceName, setNewChatSpaceName] = useState('');
  const [newChatMessageText, setNewChatMessageText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const loadChatSpacesList = useCallback(async () => {
    const token = await requireToken();
    if (!token) return;
    setChatLoading(true);
    setErrorMessage(null);
    setChatSetupError(null);
    try {
      const spaces = await listChatSpaces(token, 50);
      setChatSpaces(spaces);
    } catch (err) {
      handleApiError(err);
    } finally {
      setChatLoading(false);
    }
  }, [handleApiError, requireToken]);

  const loadChatSpaceDetails = useCallback(
    async (space: ChatSpaceItem) => {
      const token = await requireToken();
      if (!token) return;
      setSelectedChatSpace(space);
      setChatLoading(true);
      setErrorMessage(null);
      try {
        const [messages, members] = await Promise.all([
          listChatMessages(token, space.name, 30),
          listChatMemberships(token, space.name).catch(() => []),
        ]);
        setChatMessages(messages);
        setChatMembers(members);
      } catch (err) {
        handleApiError(err);
      } finally {
        setChatLoading(false);
      }
    },
    [handleApiError, requireToken]
  );

  const requestCreateChatSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatSpaceName.trim()) return;
    const displayName = newChatSpaceName.trim();
    setPendingConfirm({
      title: 'Create Google Chat Space?',
      description: `Create a new Google Chat space named "${displayName}"?`,
      confirmLabel: 'Create Space',
      tone: 'warning',
      affectedItems: [displayName],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        const created = await createChatSpace(token, displayName, 'SPACE');
        setNewChatSpaceName('');
        await loadChatSpacesList();
        await loadChatSpaceDetails(created);
        setStatusMessage(`Created Google Chat space "${displayName}".`);
      },
    });
  };

  const requestSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatSpace || !newChatMessageText.trim()) return;
    const targetSpace = selectedChatSpace;
    const msgText = newChatMessageText.trim();
    setPendingConfirm({
      title: 'Send Google Chat Message?',
      description: `Post this message to "${targetSpace.displayName || targetSpace.name}" as your signed-in Google Workspace user?`,
      confirmLabel: 'Send Message',
      tone: 'warning',
      affectedItems: [targetSpace.displayName || targetSpace.name, msgText],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await sendChatMessage(token, targetSpace.name, msgText);
        setNewChatMessageText('');
        await loadChatSpaceDetails(targetSpace);
        setStatusMessage('Sent Google Chat message.');
      },
    });
  };

  const requestDeleteChatMessage = (msg: ChatMessageItem) => {
    if (!selectedChatSpace) return;
    const targetSpace = selectedChatSpace;
    setPendingConfirm({
      title: 'Delete Google Chat Message?',
      description: 'Permanently delete this Google Chat message?',
      confirmLabel: 'Delete Message',
      tone: 'danger',
      affectedItems: [msg.text || msg.name],
      onConfirm: async () => {
        const token = await requireToken();
        if (!token) return;
        await deleteChatMessage(token, msg.name);
        await loadChatSpaceDetails(targetSpace);
        setStatusMessage('Deleted Google Chat message.');
      },
    });
  };

  // Auto-load current tab data once signed in
  useEffect(() => {
    if (!accessToken || needsAuth) return;
    if (activeTab === 'drive' && driveFiles.length === 0) {
      void loadDriveFiles();
    } else if (activeTab === 'sheets' && driveSpreadsheets.length === 0) {
      void loadSpreadsheetsList();
    } else if (activeTab === 'calendar' && calendars.length === 0) {
      void loadCalendarData();
    } else if (activeTab === 'forms' && driveForms.length === 0) {
      void loadFormsList();
    } else if (activeTab === 'meet' && meetRecords.length === 0) {
      void loadMeetRecords();
    } else if (activeTab === 'chat' && chatSpaces.length === 0 && !chatSetupError) {
      void loadChatSpacesList();
    }
  }, [
    accessToken,
    activeTab,
    calendars.length,
    chatSetupError,
    chatSpaces.length,
    driveFiles.length,
    driveForms.length,
    driveSpreadsheets.length,
    loadCalendarData,
    loadChatSpacesList,
    loadDriveFiles,
    loadFormsList,
    loadMeetRecords,
    loadSpreadsheetsList,
    meetRecords.length,
    needsAuth,
  ]);

  const executePendingConfirm = async () => {
    if (!pendingConfirm) return;
    setConfirmBusy(true);
    setErrorMessage(null);
    try {
      await pendingConfirm.onConfirm();
      setPendingConfirm(null);
    } catch (err) {
      handleApiError(err);
      setPendingConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUri(true);
      window.setTimeout(() => setCopiedUri(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] overflow-hidden">
      {/* Studio Header */}
      <div className="px-5 py-4 bg-[#2F3E4E] dark:bg-[#0B1120] text-[#FFFDF5] border-b-[1.5px] border-[#2F3E4E] dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-[#F9C80E] text-[#2F3E4E] text-[10px] font-mono font-bold uppercase tracking-wider">
              Google Workspace
            </span>
            <h1 className="font-display font-extrabold text-lg sm:text-xl text-[#FFFDF5]">
              Google Workspace Studio
            </h1>
          </div>
          <p className="text-xs text-[#CBD5E1]">
            Google Drive, Sheets, Calendar, Forms, Meet &amp; Chat powered by your signed-in Google account with in-memory OAuth access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user && !needsAuth ? (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FFFDF5]/10 border border-white/15 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-[#FEF2C8] max-w-[200px] truncate">
                  {user.email || user.displayName || 'Connected'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFDF5]/10 hover:bg-rose-500/80 text-xs font-bold text-[#FFFDF5] border border-white/15 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <GoogleSignInButton onClick={handleLogin} loading={isLoggingIn} />
          )}
        </div>
      </div>

      {/* Workspace Service Tabs */}
      <div className="px-5 pt-3 pb-0 bg-[#FEF2C8]/55 dark:bg-[#0F172A] border-b border-[#2F3E4E]/15 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('drive')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-display font-extrabold border-t-[1.5px] border-x-[1.5px] transition cursor-pointer whitespace-nowrap ${
            activeTab === 'drive'
              ? 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-[#F9C80E] border-[#2F3E4E] dark:border-slate-700'
              : 'bg-transparent text-[#475569] dark:text-slate-400 border-transparent hover:text-[#2F3E4E] dark:hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Google Drive</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sheets')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-display font-extrabold border-t-[1.5px] border-x-[1.5px] transition cursor-pointer whitespace-nowrap ${
            activeTab === 'sheets'
              ? 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-[#F9C80E] border-[#2F3E4E] dark:border-slate-700'
              : 'bg-transparent text-[#475569] dark:text-slate-400 border-transparent hover:text-[#2F3E4E] dark:hover:text-slate-200'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Google Sheets</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-display font-extrabold border-t-[1.5px] border-x-[1.5px] transition cursor-pointer whitespace-nowrap ${
            activeTab === 'calendar'
              ? 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-[#F9C80E] border-[#2F3E4E] dark:border-slate-700'
              : 'bg-transparent text-[#475569] dark:text-slate-400 border-transparent hover:text-[#2F3E4E] dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Google Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('forms')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-display font-extrabold border-t-[1.5px] border-x-[1.5px] transition cursor-pointer whitespace-nowrap ${
            activeTab === 'forms'
              ? 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-[#F9C80E] border-[#2F3E4E] dark:border-slate-700'
              : 'bg-transparent text-[#475569] dark:text-slate-400 border-transparent hover:text-[#2F3E4E] dark:hover:text-slate-200'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>Google Forms</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('meet')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-display font-extrabold border-t-[1.5px] border-x-[1.5px] transition cursor-pointer whitespace-nowrap ${
            activeTab === 'meet'
              ? 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-[#F9C80E] border-[#2F3E4E] dark:border-slate-700'
              : 'bg-transparent text-[#475569] dark:text-slate-400 border-transparent hover:text-[#2F3E4E] dark:hover:text-slate-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Google Meet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-display font-extrabold border-t-[1.5px] border-x-[1.5px] transition cursor-pointer whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-[#F9C80E] border-[#2F3E4E] dark:border-slate-700'
              : 'bg-transparent text-[#475569] dark:text-slate-400 border-transparent hover:text-[#2F3E4E] dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Google Chat</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {(statusMessage || errorMessage) && (
        <div className="px-5 pt-4 space-y-2">
          {statusMessage && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#CEE5DC] dark:bg-emerald-950/60 border border-[#12805C]/40 text-xs font-semibold text-[#12805C] dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                aria-label="Dismiss status message"
                className="p-0.5 hover:opacity-70 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss error message"
                className="p-0.5 hover:opacity-70 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auth Gate when unauthenticated or token cleared */}
      {needsAuth || !accessToken ? (
        <div className="p-6 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FEF2C8] dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 flex items-center justify-center">
            {activeTab === 'drive' && <HardDrive className="w-7 h-7 text-[#2F3E4E] dark:text-[#F9C80E]" />}
            {activeTab === 'sheets' && <Table className="w-7 h-7 text-[#2F3E4E] dark:text-[#F9C80E]" />}
            {activeTab === 'calendar' && <Calendar className="w-7 h-7 text-[#2F3E4E] dark:text-[#F9C80E]" />}
            {activeTab === 'forms' && <ListChecks className="w-7 h-7 text-[#2F3E4E] dark:text-[#F9C80E]" />}
            {activeTab === 'meet' && <Video className="w-7 h-7 text-[#2F3E4E] dark:text-[#F9C80E]" />}
            {activeTab === 'chat' && <MessageSquare className="w-7 h-7 text-[#2F3E4E] dark:text-[#F9C80E]" />}
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
              Connect Your Google Account
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 leading-relaxed">
              Sign in with Google to manage Drive files, edit Google Sheets, schedule Google Calendar events, inspect Google Forms, launch Google Meet spaces, and collaborate in Google Chat.
            </p>
          </div>
          <div className="flex justify-center pt-1">
            <GoogleSignInButton onClick={handleLogin} loading={isLoggingIn} />
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* =============================================================== */}
          {/* TAB 1: GOOGLE DRIVE */}
          {/* =============================================================== */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              {/* Controls Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadDriveFiles(driveFilter, driveSearch);
                  }}
                  className="lg:col-span-6 flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                    <input
                      type="text"
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      placeholder="Search Drive files by name..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={driveLoading}
                    className="h-10 px-4 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Search
                  </button>
                </form>

                <form onSubmit={handleCreateFolder} className="lg:col-span-4 flex items-center gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name..."
                    className="flex-1 h-10 px-3 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={driveLoading || !newFolderName.trim()}
                    className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer disabled:opacity-50"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Folder</span>
                  </button>
                </form>

                <div className="lg:col-span-2 flex items-center gap-2 justify-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={driveLoading}
                    className="inline-flex items-center justify-center gap-1.5 flex-1 lg:flex-initial h-10 px-3.5 rounded-xl bg-[#12805C] hover:bg-[#0F6A4C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>

              {/* Filter Pills + Activity Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['all', 'All Files'],
                      ['folders', 'Folders'],
                      ['forms', 'Google Forms'],
                      ['meet', 'Meet Files'],
                      ['starred', 'Starred'],
                      ['trashed', 'Trash'],
                    ] as Array<[DriveFilterMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setDriveFilter(mode);
                        setShowActivity(false);
                        void loadDriveFiles(mode, driveSearch);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        !showActivity && driveFilter === mode
                          ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                          : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/20 dark:border-slate-700 hover:border-[#2F3E4E]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadDriveActivityFeed()}
                    disabled={driveLoading}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      showActivity
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                        : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Recent Activity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadDriveFiles()}
                    disabled={driveLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/30 dark:border-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Inline Rename Form */}
              {renameTarget && (
                <form
                  onSubmit={requestRenameDriveFile}
                  className="p-3 rounded-xl bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E] dark:border-slate-600 flex flex-wrap items-center gap-2"
                >
                  <span className="text-xs font-bold text-[#2F3E4E] dark:text-slate-200">
                    Rename &ldquo;{renameTarget.currentName}&rdquo;:
                  </span>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3.5 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenameTarget(null)}
                    className="h-9 px-3 rounded-lg border border-[#2F3E4E]/40 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}

              {/* Activity Feed or Files Table */}
              {showActivity ? (
                <div className="border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#FEF2C8]/60 dark:bg-[#0B1120] border-b border-[#2F3E4E]/15 dark:border-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-200">
                    Recent Google Drive Activity ({driveActivity.length})
                  </div>
                  {driveActivity.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#64748B]">
                      No recent Drive activity found.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {driveActivity.map((entry, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                              {entry.targets?.[0]?.driveItem?.title || 'Drive Item'}
                            </div>
                            <div className="text-[#64748B] dark:text-slate-400">
                              Action: {describeDriveAction(entry)}
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-[#64748B] shrink-0">
                            {formatIsoDate(entry.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FEF2C8]/70 dark:bg-[#0B1120] border-b border-[#2F3E4E]/15 dark:border-slate-700 text-[#2F3E4E] dark:text-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-display font-extrabold">Name</th>
                        <th className="px-3 py-2.5 font-display font-extrabold">Modified</th>
                        <th className="px-3 py-2.5 font-display font-extrabold">Size</th>
                        <th className="px-4 py-2.5 font-display font-extrabold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {driveLoading && driveFiles.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[#64748B]">
                            Loading files from Google Drive...
                          </td>
                        </tr>
                      ) : driveFiles.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[#64748B]">
                            No files match this filter.
                          </td>
                        </tr>
                      ) : (
                        driveFiles.map((file) => {
                          const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                          const isForm = file.mimeType === 'application/vnd.google-apps.form';
                          return (
                            <tr
                              key={file.id}
                              className="hover:bg-[#FEF2C8]/30 dark:hover:bg-slate-800/40"
                            >
                              <td className="px-4 py-2.5 max-w-[340px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isFolder ? (
                                    <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                                  ) : isForm ? (
                                    <ListChecks className="w-4 h-4 text-purple-600 shrink-0" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300 shrink-0" />
                                  )}
                                  <span className="font-semibold text-[#2F3E4E] dark:text-slate-100 truncate">
                                    {file.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                                {formatIsoDate(file.modifiedTime)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                                {formatFileSize(file.size)}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isForm && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTab('forms');
                                        void loadFormDetails(file.id);
                                      }}
                                      title="Open in Forms Studio"
                                      className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[11px] font-bold cursor-pointer"
                                    >
                                      Form
                                    </button>
                                  )}
                                  {file.webViewLink && (
                                    <a
                                      href={file.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open in Google Drive"
                                      className="p-1.5 rounded-lg border border-[#2F3E4E]/20 dark:border-slate-700 hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A]"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  {!isFolder && !isForm && (
                                    <button
                                      type="button"
                                      onClick={() => void handleDownloadDriveFile(file)}
                                      title="Download / Export"
                                      className="p-1.5 rounded-lg border border-[#2F3E4E]/20 dark:border-slate-700 hover:bg-[#CEE5DC] text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => requestToggleStar(file)}
                                    title={file.starred ? 'Unstar' : 'Star'}
                                    className="p-1.5 rounded-lg border border-[#2F3E4E]/20 dark:border-slate-700 hover:bg-[#FEF2C8] cursor-pointer"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        file.starred
                                          ? 'fill-[#F9C80E] text-[#B45309]'
                                          : 'text-[#64748B]'
                                      }`}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenameTarget({ id: file.id, currentName: file.name });
                                      setRenameValue(file.name);
                                    }}
                                    title="Rename"
                                    className="p-1.5 rounded-lg border border-[#2F3E4E]/20 dark:border-slate-700 hover:bg-[#FEF2C8] text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  {file.trashed ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => requestTrashToggle(file, false)}
                                        title="Restore from Trash"
                                        className="p-1.5 rounded-lg border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 cursor-pointer"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => requestPermanentDelete(file)}
                                        title="Delete Permanently"
                                        className="p-1.5 rounded-lg border border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => requestTrashToggle(file, true)}
                                      title="Move to Trash"
                                      className="p-1.5 rounded-lg border border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: GOOGLE FORMS */}
          {/* =============================================================== */}
          {activeTab === 'forms' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Create Form + Existing Forms */}
              <div className="lg:col-span-4 space-y-4">
                <form
                  onSubmit={handleCreateForm}
                  className="p-4 rounded-xl bg-[#FEF2C8]/55 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-2.5"
                >
                  <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Create New Google Form
                  </h3>
                  <input
                    type="text"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder="Form title (e.g. Client GST Onboarding)"
                    className="w-full h-10 px-3 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <button
                    type="submit"
                    disabled={formsLoading || !newFormTitle.trim()}
                    className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Form</span>
                  </button>
                </form>

                <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                      Your Google Forms ({driveForms.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => void loadFormsList()}
                      disabled={formsLoading}
                      className="text-xs font-bold text-[#12805C] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void loadFormDetails(selectedFormId);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={selectedFormId}
                      onChange={(e) => setSelectedFormId(e.target.value)}
                      placeholder="Or paste Form ID..."
                      className="flex-1 h-8 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-mono"
                    />
                    <button
                      type="submit"
                      disabled={formsLoading || !selectedFormId.trim()}
                      className="h-8 px-3 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/40 text-xs font-bold cursor-pointer"
                    >
                      Load
                    </button>
                  </form>

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {driveForms.length === 0 ? (
                      <p className="py-4 text-xs text-[#64748B]">
                        No Google Forms found in Drive yet.
                      </p>
                    ) : (
                      driveForms.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => void loadFormDetails(f.id)}
                          className={`w-full text-left py-2.5 px-2 rounded-lg transition cursor-pointer ${
                            activeForm?.formId === f.id
                              ? 'bg-[#F9C80E]/35 font-bold'
                              : 'hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 truncate">
                            {f.name}
                          </div>
                          <div className="text-[10px] font-mono text-[#64748B] truncate">
                            {f.id}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Form Structure, Editor & Responses */}
              <div className="lg:col-span-8 space-y-4">
                {!activeForm ? (
                  <div className="p-8 rounded-xl border border-dashed border-[#2F3E4E]/30 dark:border-slate-700 text-center text-xs text-[#64748B]">
                    Select a Google Form from the left or create a new one to inspect questions, add items, and view responses.
                  </div>
                ) : (
                  <>
                    {/* Form Header & Description Update */}
                    <div className="p-4 rounded-xl bg-[#FEF2C8]/45 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
                            {activeForm.info?.title || 'Untitled Form'}
                          </h3>
                          <p className="text-[11px] font-mono text-[#64748B]">
                            Form ID: {activeForm.formId}
                          </p>
                        </div>
                        {activeForm.responderUri && (
                          <a
                            href={activeForm.responderUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold"
                          >
                            <span>Open Live Form</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={editFormDescription}
                          onChange={(e) => setEditFormDescription(e.target.value)}
                          placeholder="Form description..."
                          className="flex-1 h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                        />
                        <button
                          type="button"
                          onClick={requestUpdateFormDescription}
                          className="h-9 px-3.5 rounded-lg bg-white dark:bg-slate-800 border border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
                        >
                          Save Description
                        </button>
                      </div>
                    </div>

                    {/* Add Question */}
                    <form
                      onSubmit={requestAddFormQuestion}
                      className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-2.5"
                    >
                      <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                        Add Question to Form
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={newQuestionTitle}
                          onChange={(e) => setNewQuestionTitle(e.target.value)}
                          placeholder="Question prompt..."
                          className="sm:col-span-6 h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs"
                        />
                        <select
                          value={newQuestionType}
                          onChange={(e) =>
                            setNewQuestionType(e.target.value as 'SHORT' | 'PARAGRAPH' | 'RADIO')
                          }
                          className="sm:col-span-3 h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-semibold"
                        >
                          <option value="SHORT">Short Answer</option>
                          <option value="PARAGRAPH">Paragraph</option>
                          <option value="RADIO">Multiple Choice</option>
                        </select>
                        <button
                          type="submit"
                          disabled={formsLoading || !newQuestionTitle.trim()}
                          className="sm:col-span-3 h-9 rounded-lg bg-[#12805C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          Add Question
                        </button>
                      </div>
                      {newQuestionType === 'RADIO' && (
                        <input
                          type="text"
                          value={newQuestionOptions}
                          onChange={(e) => setNewQuestionOptions(e.target.value)}
                          placeholder="Comma-separated choices (e.g. Yes, No, Maybe)"
                          className="w-full h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs"
                        />
                      )}
                    </form>

                    {/* Form Questions */}
                    <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-2">
                      <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                        Questions ({activeForm.items?.length || 0})
                      </h4>
                      {!activeForm.items || activeForm.items.length === 0 ? (
                        <p className="text-xs text-[#64748B]">No questions in this form yet.</p>
                      ) : (
                        <ol className="space-y-1.5 list-decimal list-inside text-xs text-[#2F3E4E] dark:text-slate-200">
                          {activeForm.items.map((item, idx) => (
                            <li key={item.itemId || idx} className="py-1 border-b border-[#2F3E4E]/10 dark:border-slate-800 last:border-b-0">
                              <span className="font-semibold">{item.title || 'Untitled item'}</span>
                              {item.questionItem?.question?.choiceQuestion && (
                                <span className="ml-2 text-[11px] text-[#64748B]">
                                  (
                                  {item.questionItem.question.choiceQuestion.options
                                    ?.map((o) => o.value)
                                    .join(', ')}
                                  )
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    {/* Responses */}
                    <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                          Responses ({formResponses.length})
                        </h4>
                        {formResponses.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportResponsesCsv}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CEE5DC] dark:bg-emerald-950/70 text-[#12805C] dark:text-emerald-300 text-xs font-bold cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Export CSV</span>
                          </button>
                        )}
                      </div>

                      {formResponses.length === 0 ? (
                        <p className="text-xs text-[#64748B]">No submissions recorded yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {formResponses.map((resp) => (
                            <div
                              key={resp.responseId}
                              className="p-3 rounded-lg bg-[#FEF2C8]/40 dark:bg-[#131C2E] border border-[#2F3E4E]/15 dark:border-slate-700 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                                <span>{resp.respondentEmail || resp.responseId}</span>
                                <span>{formatIsoDate(resp.lastSubmittedTime || resp.createTime)}</span>
                              </div>
                              {resp.answers &&
                                Object.entries(resp.answers).map(([qId, ans]) => (
                                  <div key={qId} className="text-xs">
                                    <span className="font-bold text-[#2F3E4E] dark:text-slate-200">
                                      {questionTitleById.get(qId) || qId}:{' '}
                                    </span>
                                    <span className="text-[#475569] dark:text-slate-300">
                                      {ans.textAnswers?.answers?.map((a) => a.value).join(', ') || '—'}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: GOOGLE MEET */}
          {/* =============================================================== */}
          {activeTab === 'meet' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Create / Lookup / Configure Space */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 rounded-xl bg-[#FEF2C8]/55 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                      Create or Open Meet Space
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
                        Access Type
                      </label>
                      <select
                        value={meetAccessType}
                        onChange={(e) => setMeetAccessType(e.target.value as MeetAccessType)}
                        className="w-full h-9 px-2.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-semibold"
                      >
                        <option value="OPEN">OPEN (Anyone with link)</option>
                        <option value="TRUSTED">TRUSTED (Org &amp; invited)</option>
                        <option value="RESTRICTED">RESTRICTED (Invited only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
                        Entry Points
                      </label>
                      <select
                        value={meetEntryPoint}
                        onChange={(e) => setMeetEntryPoint(e.target.value as MeetEntryPointAccess)}
                        className="w-full h-9 px-2.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-semibold"
                      >
                        <option value="ALL">ALL Entry Points</option>
                        <option value="CREATOR_APP_ONLY">CREATOR_APP_ONLY</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCreateMeetSpace()}
                    disabled={meetLoading}
                    className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Video className="w-4 h-4" />
                    <span>Create New Google Meet Space</span>
                  </button>

                  <form onSubmit={handleLookupMeetSpace} className="pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex items-center gap-2">
                    <input
                      type="text"
                      value={meetLookupInput}
                      onChange={(e) => setMeetLookupInput(e.target.value)}
                      placeholder="Lookup space (spaces/... or meeting code)"
                      className="flex-1 h-9 px-3 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-mono"
                    />
                    <button
                      type="submit"
                      disabled={meetLoading || !meetLookupInput.trim()}
                      className="h-9 px-3.5 rounded-lg bg-white dark:bg-slate-800 border border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
                    >
                      Lookup
                    </button>
                  </form>
                </div>

                {meetSpace && (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#12805C] dark:text-emerald-400 font-bold">
                          Active Space Details
                        </span>
                        <h4 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
                          {meetSpace.meetingCode || meetSpace.name}
                        </h4>
                        <p className="text-[11px] font-mono text-[#64748B]">{meetSpace.name}</p>
                      </div>
                      {meetSpace.meetingUri && (
                        <a
                          href={meetSpace.meetingUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12805C] text-white text-xs font-bold"
                        >
                          <span>Join Meet</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {meetSpace.meetingUri && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FEF2C8]/50 dark:bg-[#131C2E] border border-[#2F3E4E]/15 dark:border-slate-700">
                        <span className="flex-1 text-xs font-mono truncate text-[#2F3E4E] dark:text-slate-200">
                          {meetSpace.meetingUri}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyText(meetSpace.meetingUri || '')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-[#2F3E4E]/30 text-[11px] font-bold cursor-pointer"
                        >
                          {copiedUri ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedUri ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={requestUpdateMeetConfig}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Save Space Access Settings</span>
                      </button>

                      {meetSpace.activeConference?.conferenceRecord && (
                        <button
                          type="button"
                          onClick={requestEndActiveConference}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>End Active Conference</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Conference Records, Participants & Recordings */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                      Recent Conference Records ({meetRecords.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => void loadMeetRecords()}
                      disabled={meetLoading}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#12805C] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${meetLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {meetRecords.length === 0 ? (
                    <p className="text-xs text-[#64748B]">
                      No past or active Google Meet conference records found for this account.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {meetRecords.map((rec) => (
                        <button
                          key={rec.name}
                          type="button"
                          onClick={() => void loadMeetRecordDetails(rec.name)}
                          className={`w-full text-left py-2.5 px-2.5 rounded-lg transition cursor-pointer ${
                            selectedRecordName === rec.name
                              ? 'bg-[#F9C80E]/35'
                              : 'hover:bg-[#FEF2C8]/40 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                              {rec.name}
                            </span>
                            <span className="text-[11px] text-[#64748B] shrink-0">
                              {formatIsoDate(rec.startTime)}
                            </span>
                          </div>
                          {rec.space && (
                            <div className="text-[11px] text-[#64748B] truncate">{rec.space}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRecordName && (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-3">
                    <h4 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Participants ({meetParticipants.length}) &amp; Recordings ({meetRecordings.length})</span>
                    </h4>

                    <div className="space-y-1.5">
                      {meetParticipants.length === 0 ? (
                        <p className="text-xs text-[#64748B]">No participant records returned.</p>
                      ) : (
                        meetParticipants.map((p) => {
                          const display =
                            p.signedinUser?.displayName ||
                            p.anonymousUser?.displayName ||
                            p.phoneUser?.displayName ||
                            p.name;
                          return (
                            <div
                              key={p.name}
                              className="flex items-center justify-between text-xs py-1 border-b border-[#2F3E4E]/10 dark:border-slate-800"
                            >
                              <span className="font-semibold text-[#2F3E4E] dark:text-slate-100">
                                {display}
                              </span>
                              <span className="font-mono text-[11px] text-[#64748B]">
                                {formatIsoDate(p.earliestStartTime)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {meetRecordings.length > 0 && (
                      <div className="pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-700 space-y-1.5">
                        <div className="text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                          Recordings
                        </div>
                        {meetRecordings.map((r) => (
                          <div key={r.name} className="flex items-center justify-between text-xs">
                            <span className="font-mono truncate">{r.state || r.name}</span>
                            {r.driveDestination?.exportUri && (
                              <a
                                href={r.driveDestination.exportUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#12805C] font-bold hover:underline"
                              >
                                <span>Open Recording</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: GOOGLE SHEETS */}
          {/* =============================================================== */}
          {activeTab === 'sheets' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-4 space-y-4">
                <form
                  onSubmit={handleCreateSpreadsheet}
                  className="p-4 rounded-xl bg-[#FEF2C8]/55 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-2.5"
                >
                  <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Create New Spreadsheet
                  </h3>
                  <input
                    type="text"
                    value={newSpreadsheetTitle}
                    onChange={(e) => setNewSpreadsheetTitle(e.target.value)}
                    placeholder="e.g. VCPL GST Monthly Tracker"
                    className="w-full h-9 px-3 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <button
                    type="submit"
                    disabled={sheetsLoading || !newSpreadsheetTitle.trim()}
                    className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Google Sheet</span>
                  </button>
                </form>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void openSpreadsheet(sheetIdInput);
                  }}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-2"
                >
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-300">
                    Open by Spreadsheet ID
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sheetIdInput}
                      onChange={(e) => setSheetIdInput(e.target.value)}
                      placeholder="Paste Spreadsheet ID..."
                      className="flex-1 h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-mono"
                    />
                    <button
                      type="submit"
                      disabled={sheetsLoading || !sheetIdInput.trim()}
                      className="h-9 px-3 rounded-lg bg-[#2F3E4E] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Open
                    </button>
                  </div>
                </form>

                <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                      Your Spreadsheets ({driveSpreadsheets.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => void loadSpreadsheetsList()}
                      disabled={sheetsLoading}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#12805C] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${sheetsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  {driveSpreadsheets.length === 0 ? (
                    <p className="text-xs text-[#64748B]">
                      No spreadsheets found yet. Create a new sheet or paste a Spreadsheet ID.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {driveSpreadsheets.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => void openSpreadsheet(file.id)}
                          className={`w-full text-left py-2.5 px-2.5 rounded-lg transition cursor-pointer ${
                            activeSpreadsheet?.spreadsheetId === file.id
                              ? 'bg-[#F9C80E]/35'
                              : 'hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                            {file.name}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            Updated {formatIsoDate(file.modifiedTime)}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-8 space-y-4">
                {!activeSpreadsheet ? (
                  <div className="p-8 rounded-xl border border-dashed border-[#2F3E4E]/30 dark:border-slate-700 text-center space-y-2">
                    <Table className="w-8 h-8 mx-auto text-[#64748B]" />
                    <p className="text-sm font-bold text-[#2F3E4E] dark:text-slate-200">
                      Select or create a Google Sheet to view &amp; edit data
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Tabs are fetched dynamically from workbook metadata (never hardcoded).
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
                          {activeSpreadsheet.properties.title}
                        </h3>
                        <p className="text-[11px] font-mono text-[#64748B]">
                          ID: {activeSpreadsheet.spreadsheetId} · {activeSpreadsheet.sheets.length} tab(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sheetValues.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportSheetCsv}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12805C] text-white text-xs font-bold cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export CSV</span>
                          </button>
                        )}
                        {activeSpreadsheet.spreadsheetUrl && (
                          <a
                            href={activeSpreadsheet.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/30 text-xs font-bold"
                          >
                            <span>Open in Sheets</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Dynamic Tab Switcher + Range Reload */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedSheetTitle}
                        onChange={(e) => {
                          const nextTab = e.target.value;
                          setSelectedSheetTitle(nextTab);
                          void loadSpreadsheetTabValues(activeSpreadsheet.spreadsheetId, nextTab);
                        }}
                        className="h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-bold"
                      >
                        {activeSpreadsheet.sheets.map((s) => (
                          <option key={s.properties.sheetId} value={s.properties.title}>
                            {s.properties.title}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={sheetRangeInput}
                        onChange={(e) => setSheetRangeInput(e.target.value)}
                        placeholder="A1:H25"
                        className="w-28 h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void loadSpreadsheetTabValues(
                            activeSpreadsheet.spreadsheetId,
                            selectedSheetTitle,
                            sheetRangeInput
                          )
                        }
                        disabled={sheetsLoading}
                        className="h-9 px-3 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/30 text-xs font-bold cursor-pointer"
                      >
                        Load Range
                      </button>
                    </div>

                    {/* Sheet Values Table */}
                    <div className="overflow-x-auto border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl">
                      {sheetValues.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#64748B]">
                          No cell values found in range {sheetRangeInput}. Append a row below to start.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs">
                          <tbody>
                            {sheetValues.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={
                                  rIdx === 0
                                    ? 'bg-[#FEF2C8]/70 dark:bg-[#131C2E] font-bold text-[#2F3E4E] dark:text-[#F9C80E]'
                                    : 'border-t border-[#2F3E4E]/10 dark:border-slate-800 hover:bg-[#FEF2C8]/25'
                                }
                              >
                                <td className="px-2.5 py-1.5 font-mono text-[10px] text-[#64748B] border-r border-[#2F3E4E]/10 w-10">
                                  {rIdx + 1}
                                </td>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-2.5 py-1.5 border-r border-[#2F3E4E]/10 dark:border-slate-800 max-w-[200px] truncate"
                                    title={cell}
                                  >
                                    {cell || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Mutating Actions (Behind Confirmation Modal) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-700">
                      <form onSubmit={requestAppendSheetRow} className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                          Append New Row (comma-separated)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newRowInput}
                            onChange={(e) => setNewRowInput(e.target.value)}
                            placeholder="e.g. INV-102, 24 Nov 2026, 18500"
                            className="flex-1 h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                          />
                          <button
                            type="submit"
                            disabled={!newRowInput.trim()}
                            className="h-9 px-3.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Append
                          </button>
                        </div>
                      </form>

                      <form onSubmit={requestUpdateSheetCells} className="space-y-2">
                        <label className="block text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                          Update Cell / Row Range
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={cellUpdateRange}
                            onChange={(e) => setCellUpdateRange(e.target.value)}
                            placeholder="A2:C2"
                            className="w-20 h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-mono"
                          />
                          <input
                            type="text"
                            value={cellUpdateValue}
                            onChange={(e) => setCellUpdateValue(e.target.value)}
                            placeholder="Comma values..."
                            className="flex-1 h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                          />
                          <button
                            type="submit"
                            disabled={!cellUpdateRange.trim()}
                            className="h-9 px-3 rounded-lg border border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 5: GOOGLE CALENDAR */}
          {/* =============================================================== */}
          {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-4">
                <form
                  onSubmit={requestCreateCalendarEvent}
                  className="p-4 rounded-xl bg-[#FEF2C8]/55 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-2.5"
                >
                  <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Schedule Calendar Event
                  </h3>
                  <input
                    type="text"
                    value={eventSummary}
                    onChange={(e) => setEventSummary(e.target.value)}
                    placeholder="Event title (e.g. GSTR-3B Review Meeting)"
                    className="w-full h-9 px-3 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#475569] dark:text-slate-300 mb-1">
                        Start Time
                      </label>
                      <input
                        type="datetime-local"
                        value={eventStartLocal}
                        onChange={(e) => setEventStartLocal(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#475569] dark:text-slate-300 mb-1">
                        End Time
                      </label>
                      <input
                        type="datetime-local"
                        value={eventEndLocal}
                        onChange={(e) => setEventEndLocal(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Location or meeting link (optional)"
                    className="w-full h-9 px-3 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <input
                    type="text"
                    value={eventAttendees}
                    onChange={(e) => setEventAttendees(e.target.value)}
                    placeholder="Attendee emails comma-separated (optional)"
                    className="w-full h-9 px-3 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <textarea
                    rows={2}
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Agenda / notes (optional)"
                    className="w-full p-2.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                  />
                  <button
                    type="submit"
                    disabled={calendarLoading || !eventSummary.trim()}
                    className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule Event</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <select
                        value={selectedCalendarId}
                        onChange={(e) => {
                          const nextCal = e.target.value;
                          setSelectedCalendarId(nextCal);
                          void loadCalendarData(nextCal, calendarSearch);
                        }}
                        className="h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs font-bold max-w-[220px]"
                      >
                        {calendars.length === 0 ? (
                          <option value="primary">Primary Calendar</option>
                        ) : (
                          calendars.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.summary} {c.primary ? '(Primary)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                      <input
                        type="text"
                        value={calendarSearch}
                        onChange={(e) => setCalendarSearch(e.target.value)}
                        placeholder="Filter events..."
                        className="flex-1 h-9 px-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadCalendarData(selectedCalendarId, calendarSearch)}
                      disabled={calendarLoading}
                      className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 text-xs font-bold cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${calendarLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {calendarEvents.length === 0 ? (
                    <p className="text-xs text-[#64748B] py-4 text-center">
                      No upcoming or recent events found in the selected calendar.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
                      {calendarEvents.map((ev) => {
                        const startLabel = ev.start?.dateTime || ev.start?.date || '';
                        const isEditing = editingEventId === ev.id;
                        return (
                          <div key={ev.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editingEventSummary}
                                    onChange={(e) => setEditingEventSummary(e.target.value)}
                                    className="h-8 px-2.5 rounded border border-[#2F3E4E]/40 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => requestSaveEventTitleEdit(ev)}
                                    className="px-2.5 h-8 rounded bg-[#12805C] text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingEventId(null)}
                                    className="px-2 h-8 rounded border border-[#2F3E4E]/30 text-[11px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                                  {ev.summary || '(Untitled Event)'}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatIsoDate(startLabel)}
                                </span>
                                {ev.location && <span>· {ev.location}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {ev.htmlLink && (
                                <a
                                  href={ev.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-[#2F3E4E]/20 hover:bg-[#FEF2C8]/60 text-[#2F3E4E] dark:text-slate-300"
                                  title="Open in Google Calendar"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEventId(ev.id);
                                  setEditingEventSummary(ev.summary || '');
                                }}
                                className="p-1.5 rounded-lg border border-[#2F3E4E]/20 hover:bg-[#FEF2C8]/60 text-[#2F3E4E] dark:text-slate-300 cursor-pointer"
                                title="Rename event"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteCalendarEvent(ev)}
                                className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                                title="Delete event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 6: GOOGLE CHAT */}
          {/* =============================================================== */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              {chatSetupError && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-[1.5px] border-amber-400 dark:border-amber-700 space-y-2 text-xs text-amber-950 dark:text-amber-200">
                  <div className="font-display font-extrabold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Google Chat App &amp; Workspace Prerequisites Required</span>
                  </div>
                  <p>{chatSetupError.message}</p>
                  <p className="text-[11px] leading-relaxed">
                    Google Chat API requires (1) a Business or Enterprise Google Workspace account (consumer @gmail.com accounts are not supported by Google Chat API) and (2) configuring the Chat App details in Google Cloud Console.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={chatSetupError.consoleUrl || GOOGLE_CHAT_CONSOLE_CONFIG_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-white font-bold"
                    >
                      <span>Open Google Chat Console Config</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void loadChatSpacesList()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 font-bold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-4 space-y-4">
                  <form
                    onSubmit={requestCreateChatSpace}
                    className="p-4 rounded-xl bg-[#FEF2C8]/55 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-2.5"
                  >
                    <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                      Create Google Chat Space
                    </h3>
                    <input
                      type="text"
                      value={newChatSpaceName}
                      onChange={(e) => setNewChatSpaceName(e.target.value)}
                      placeholder="e.g. VCPL Accounts Desk"
                      className="w-full h-9 px-3 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !newChatSpaceName.trim()}
                      className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Chat Space</span>
                    </button>
                  </form>

                  <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                        Chat Spaces ({chatSpaces.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => void loadChatSpacesList()}
                        disabled={chatLoading}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#12805C] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${chatLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                    {chatSpaces.length === 0 ? (
                      <p className="text-xs text-[#64748B]">
                        No Google Chat spaces loaded yet. Note: requires a Google Workspace Business/Enterprise account.
                      </p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                        {chatSpaces.map((sp) => (
                          <button
                            key={sp.name}
                            type="button"
                            onClick={() => void loadChatSpaceDetails(sp)}
                            className={`w-full text-left py-2.5 px-2.5 rounded-lg transition cursor-pointer ${
                              selectedChatSpace?.name === sp.name
                                ? 'bg-[#F9C80E]/35'
                                : 'hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                              {sp.displayName || sp.name}
                            </div>
                            <div className="text-[10px] font-mono text-[#64748B]">
                              {sp.spaceType || sp.type || 'SPACE'} · {sp.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  {!selectedChatSpace ? (
                    <div className="p-8 rounded-xl border border-dashed border-[#2F3E4E]/30 dark:border-slate-700 text-center space-y-2">
                      <MessageSquare className="w-8 h-8 mx-auto text-[#64748B]" />
                      <p className="text-sm font-bold text-[#2F3E4E] dark:text-slate-200">
                        Select a Google Chat space to inspect messages &amp; members
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Sending or deleting messages always displays an explicit confirmation step.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
                            {selectedChatSpace.displayName || selectedChatSpace.name}
                          </h3>
                          <p className="text-[11px] font-mono text-[#64748B]">
                            {selectedChatSpace.name} · {chatMembers.length} member(s)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void loadChatSpaceDetails(selectedChatSpace)}
                          disabled={chatLoading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 text-xs font-bold cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${chatLoading ? 'animate-spin' : ''}`} />
                          <span>Reload Messages</span>
                        </button>
                      </div>

                      <form onSubmit={requestSendChatMessage} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newChatMessageText}
                          onChange={(e) => setNewChatMessageText(e.target.value)}
                          placeholder="Write a message to this Google Chat space..."
                          className="flex-1 h-10 px-3 rounded-xl border border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs"
                        />
                        <button
                          type="submit"
                          disabled={chatLoading || !newChatMessageText.trim()}
                          className="h-10 px-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </form>

                      <div className="max-h-80 overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                        {chatMessages.length === 0 ? (
                          <p className="text-xs text-[#64748B] py-4 text-center">
                            No messages returned for this space.
                          </p>
                        ) : (
                          chatMessages.map((msg) => (
                            <div key={msg.name} className="py-2.5 flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="font-bold text-[#2F3E4E] dark:text-slate-100">
                                    {msg.sender?.displayName || msg.sender?.name || 'Member'}
                                  </span>
                                  <span className="text-[#64748B]">{formatIsoDate(msg.createTime)}</span>
                                </div>
                                <p className="text-xs text-[#334155] dark:text-slate-300 whitespace-pre-wrap break-words">
                                  {msg.text || msg.formattedText || '(Attachment / Card)'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => requestDeleteChatMessage(msg)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mandatory Explicit Confirmation Modal for Destructive / Mutating Workspace Operations */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  pendingConfirm.tone === 'danger'
                    ? 'bg-rose-100 dark:bg-rose-950/70 border-rose-400 text-rose-700 dark:text-rose-300'
                    : 'bg-[#FEF2C8] dark:bg-amber-950/70 border-[#2F3E4E] dark:border-amber-500/40 text-[#B45309] dark:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3
                  id="workspace-confirm-title"
                  className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100"
                >
                  {pendingConfirm.title}
                </h3>
                <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                  {pendingConfirm.description}
                </p>
              </div>
            </div>

            {pendingConfirm.affectedItems && pendingConfirm.affectedItems.length > 0 && (
              <div className="p-3 rounded-xl bg-[#FEF2C8]/50 dark:bg-[#0B1120] border border-[#2F3E4E]/15 dark:border-slate-700 space-y-1">
                {pendingConfirm.affectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="text-xs font-mono text-[#2F3E4E] dark:text-slate-200 truncate"
                  >
                    • {item}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setPendingConfirm(null)}
                className="h-9 px-4 rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => void executePendingConfirm()}
                className={`h-9 px-4 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                  pendingConfirm.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#2F3E4E] hover:bg-[#1E293B] dark:bg-[#F9C80E] dark:text-[#0F172A]'
                }`}
              >
                {confirmBusy ? 'Applying...' : pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useRef, useState } from 'react';
import type { Project } from '../project/types';
import { parseProjectJson, projectFileName, projectToJson, serializeProject } from '../project/serialize';

/**
 * Project top bar (PRD §4.4): project-name field, JSON save (download),
 * JSON load (file picker with STRICT validation), and the debounced
 * autosave status readout.
 *
 * Load safety: the picked file is fully validated before anything is
 * handed back to the caller, so a bad file produces a clear message and
 * leaves the current drawing untouched — never a half-loaded project.
 */
export default function ProjectTopBar({
  project,
  projectName,
  onProjectNameChange,
  autosaveStatus,
  onLoad,
  onOpenLists,
}: {
  project: Project;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'unavailable';
  onLoad: (project: Project) => void;
  onOpenLists: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [loadOk, setLoadOk] = useState<string | null>(null);

  function handleSave() {
    const text = projectToJson(project);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectFileName(projectName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLoadOk(`Saved ${projectFileName(projectName)} (${serializeProject(project).sheets.length} sheet(s)).`);
    setLoadErrors([]);
  }

  async function handleFilePicked(file: File) {
    setLoadErrors([]);
    setLoadOk(null);
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      setLoadErrors([`Could not read "${file.name}": ${(err as Error).message}`]);
      return;
    }

    // Strict validation BEFORE any state mutation: a rejected file must
    // leave the current project exactly as it was.
    const result = parseProjectJson(text);
    if (!result.ok || !result.project) {
      setLoadErrors(result.errors.slice(0, 12));
      return;
    }

    const sheetCount = result.project.sheets.length;
    const nodeCount = result.project.sheets.reduce((n, s) => n + s.nodes.length, 0);
    const proceed = window.confirm(
      `Load project "${result.project.projectName}"?\n\n` +
        `${sheetCount} sheet(s), ${nodeCount} item(s) total.\n` +
        `This REPLACES the project currently open.`,
    );
    if (!proceed) return;

    onLoad(result.project);
    setLoadOk(`Loaded "${result.project.projectName}" — ${sheetCount} sheet(s), ${nodeCount} item(s).`);
  }

  const statusCopy: Record<typeof autosaveStatus, string> = {
    idle: 'Autosave ready',
    saving: 'Autosaving…',
    saved: 'Autosaved',
    unavailable: 'Autosave off',
  };

  return (
    <header className="project-topbar" data-testid="project-topbar">
      <label className="topbar-field">
        <span>Project</span>
        <input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="Project name"
          data-testid="project-name-input"
        />
      </label>

      <button
        onClick={onOpenLists}
        data-testid="open-lists-btn"
        title="Auto-generated line / valve / instrument / equipment lists, derived from the drawing"
      >
        Lists
      </button>
      <button onClick={handleSave} data-testid="save-json-btn" title="Download the whole project as JSON">
        Save JSON
      </button>
      <button onClick={() => fileInputRef.current?.click()} data-testid="load-json-btn" title="Load a project JSON file">
        Load JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        data-testid="load-json-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file twice still fires onChange.
          e.target.value = '';
          if (file) void handleFilePicked(file);
        }}
      />

      <span
        className={`autosave-status autosave-${autosaveStatus}`}
        data-testid="autosave-status"
        title="The current project is stored in this browser's local storage, debounced by about a second."
      >
        {statusCopy[autosaveStatus]}
      </span>

      {loadOk && (
        <span className="topbar-note ok" data-testid="load-ok">
          {loadOk}
        </span>
      )}
      {loadErrors.length > 0 && (
        <div className="topbar-load-errors" data-testid="load-errors">
          <strong>Could not load that file — nothing was changed:</strong>
          <ul>
            {loadErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
          <button className="topbar-dismiss" onClick={() => setLoadErrors([])}>
            Dismiss
          </button>
        </div>
      )}
    </header>
  );
}

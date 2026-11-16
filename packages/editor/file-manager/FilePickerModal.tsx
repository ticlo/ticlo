import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Input, Modal, Select, Space} from 'antd';
import {FolderAddOutlined} from '@ant-design/icons';
import {filePath, type FileAccess, type FileEntry, type ProjectFiles} from '@ticlo/core';
import {translateEditor} from '@ticlo/core/editor.ts';
import {FileManager, type FileManagerHandle} from './FileManager.tsx';
import {TicloI18NContext} from '../component/LayoutContext.ts';
import {t} from '../component/LocalizedLabel.tsx';

export type PickerStorage = FileAccess & Partial<Pick<ProjectFiles, 'listProjects'>>;

export interface FilePickerModalProps {
  open: boolean;
  storage: PickerStorage;
  frontendStorage?: PickerStorage;
  currentProject: string;
  initialValue?: unknown;
  onSelectPath: (filePath: string) => void;
  onCancel: () => void;
}

interface PickerTarget {
  project: string;
  frontend: boolean;
}

function parsePickerKey(key: string): PickerTarget {
  if (key.startsWith('++')) {
    return {project: key.slice(2), frontend: true};
  }
  return {project: key.startsWith('+') ? key.slice(1) : key, frontend: false};
}

function parseInitialPickerState(
  value: unknown,
  currentProject: string,
  hasFrontendStorage: boolean
): {key: string; relativePath: string} {
  if (typeof value === 'string') {
    if (value.startsWith('++')) {
      const slash = value.indexOf('/');
      if (slash > 2 && hasFrontendStorage) {
        return {key: value.slice(0, slash), relativePath: value.slice(slash + 1)};
      }
    } else if (value.startsWith('+/')) {
      return {key: `+${currentProject}`, relativePath: value.slice(2)};
    } else if (value.startsWith('+')) {
      const slash = value.indexOf('/');
      if (slash > 1) {
        return {key: value.slice(0, slash), relativePath: value.slice(slash + 1)};
      }
    }
  }
  return {key: `+${currentProject}`, relativePath: ''};
}

function stripProjectPrefix(entryPath: string, selectedProject: string): string {
  if (entryPath === selectedProject) return '';
  const prefix = `${selectedProject}/`;
  return entryPath.startsWith(prefix) ? entryPath.slice(prefix.length) : entryPath;
}

export function formatPickedRelativePath(
  relativePath: string,
  selectedProject: string,
  currentProject: string,
  frontend = false
): string {
  if (frontend) {
    return `++${selectedProject}/${relativePath}`;
  }
  return selectedProject === currentProject ? `+/${relativePath}` : `+${selectedProject}/${relativePath}`;
}

export function formatPickedFilePath(
  entryPath: string,
  selectedProject: string,
  currentProject: string,
  frontend = false
): string {
  return formatPickedRelativePath(
    stripProjectPrefix(entryPath, selectedProject),
    selectedProject,
    currentProject,
    frontend
  );
}

function normalizePickedRelativePath(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return filePath(trimmed);
  } catch {
    return undefined;
  }
}

async function loadStorageProjects(storage: PickerStorage, signal: AbortSignal): Promise<string[]> {
  try {
    return storage.listProjects
      ? (await storage.listProjects({signal})).map((item) => item.id)
      : (await storage.listFiles('', {signal})).filter((entry) => entry.type === 'folder').map((entry) => entry.name);
  } catch {
    return [];
  }
}

export function FilePickerModal({
  open,
  storage,
  frontendStorage,
  currentProject,
  initialValue,
  onSelectPath,
  onCancel,
}: FilePickerModalProps) {
  useContext(TicloI18NContext);
  const initial = parseInitialPickerState(initialValue, currentProject, Boolean(frontendStorage));
  const [selectedKey, setSelectedKey] = useState(initial.key);
  const [projects, setProjects] = useState<string[]>([]);
  const [frontendProjects, setFrontendProjects] = useState<string[]>([]);
  const [pathInput, setPathInput] = useState(initial.relativePath);
  const manualEditedRef = useRef(false);
  const fileManagerRef = useRef<FileManagerHandle>(null);

  useEffect(() => {
    if (!open) return;
    const nextInitial = parseInitialPickerState(initialValue, currentProject, Boolean(frontendStorage));
    setSelectedKey(nextInitial.key);
    setPathInput(nextInitial.relativePath);
    manualEditedRef.current = false;

    const controller = new AbortController();
    let active = true;
    const loadProjects = async () => {
      const [backendList, frontendList] = await Promise.all([
        loadStorageProjects(storage, controller.signal),
        frontendStorage ? loadStorageProjects(frontendStorage, controller.signal) : Promise.resolve([]),
      ]);
      if (active) {
        setProjects(backendList);
        setFrontendProjects(frontendList);
      }
    };
    void loadProjects();
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, storage, frontendStorage, currentProject, initialValue]);

  const target = useMemo(() => parsePickerKey(selectedKey), [selectedKey]);
  const frontendLabel = translateEditor('frontend');

  const projectOptions = useMemo(() => {
    const backendIds = [
      ...new Set([currentProject, ...(target.frontend ? [] : [target.project]), ...projects].filter(Boolean)),
    ];
    const options = backendIds.map((id) => ({value: `+${id}`, label: id}));
    if (frontendStorage) {
      const frontendIds = [
        ...new Set([...(target.frontend ? [target.project] : []), ...frontendProjects].filter(Boolean)),
      ];
      for (const id of frontendIds) {
        options.push({value: `++${id}`, label: `${id} (${frontendLabel})`});
      }
    }
    return options;
  }, [currentProject, target, projects, frontendStorage, frontendProjects, frontendLabel]);

  const activeStorage = target.frontend && frontendStorage ? frontendStorage : storage;
  const canCreateFolder = Boolean(activeStorage.getCapabilities(target.project).write);
  const normalizedPath = normalizePickedRelativePath(pathInput);
  const projectPrefix = formatPickedRelativePath('', target.project, currentProject, target.frontend);

  const confirmEntry = (entry: FileEntry) => {
    if (entry.type !== 'file' || entry.gitStatus === 'deleted') return;
    onSelectPath(formatPickedFilePath(entry.path, target.project, currentProject, target.frontend));
  };

  const confirmPath = () => {
    if (!normalizedPath) return;
    onSelectPath(formatPickedRelativePath(normalizedPath, target.project, currentProject, target.frontend));
  };

  const handleTreeSelect = (entries: FileEntry[]) => {
    const entry = entries.length === 1 ? entries[0] : null;
    if (!entry || entry.gitStatus === 'deleted') return;
    const rel = stripProjectPrefix(entry.path, target.project);
    if (entry.type === 'file') {
      manualEditedRef.current = false;
      setPathInput(rel);
      return;
    }
    setPathInput((prev) => {
      if (manualEditedRef.current) {
        const trimmed = prev.trim();
        const base = trimmed.endsWith('/') ? '' : (trimmed.split('/').pop() ?? '');
        return base ? (rel ? `${rel}/${base}` : base) : rel ? `${rel}/` : '';
      }
      return rel ? `${rel}/` : '';
    });
  };

  return (
    <Modal
      title={t('Select File')}
      open={open}
      onOk={confirmPath}
      onCancel={onCancel}
      okButtonProps={{disabled: !normalizedPath}}
      destroyOnHidden
    >
      <div className="ticl-e-file-picker-project">
        <Select
          size="small"
          value={selectedKey}
          options={projectOptions}
          onChange={(next) => {
            setSelectedKey(next);
            manualEditedRef.current = false;
            setPathInput('');
          }}
        />
        <Button
          size="small"
          className="ticl-e-file-picker-new-folder"
          title={translateEditor('New Folder')}
          icon={<FolderAddOutlined />}
          disabled={!canCreateFolder}
          onClick={() => fileManagerRef.current?.createFolder()}
        />
      </div>
      <div style={{height: 360}}>
        {open && (
          <FileManager
            key={selectedKey}
            actionsRef={fileManagerRef}
            storage={activeStorage}
            project={target.project}
            picker
            allowCreateFolder
            defaultPreview={false}
            onSelect={handleTreeSelect}
            onOpen={confirmEntry}
          />
        )}
      </div>
      <div className="ticl-e-file-picker-input">
        <Space.Compact size="small" style={{width: '100%'}}>
          <span className="ticl-e-file-picker-prefix">{projectPrefix}</span>
          <Input
            size="small"
            value={pathInput}
            placeholder={translateEditor('File Name')}
            onChange={(event) => {
              const next = event.target.value;
              manualEditedRef.current = Boolean(next.trim() && !next.endsWith('/'));
              setPathInput(next);
            }}
            onPressEnter={confirmPath}
          />
        </Space.Compact>
      </div>
    </Modal>
  );
}

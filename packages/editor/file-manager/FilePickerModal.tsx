import React, {useContext, useEffect, useMemo, useState} from 'react';
import {Modal, Select} from 'antd';
import type {FileAccess, FileEntry, ProjectFiles} from '@ticlo/core';
import {translateEditor} from '@ticlo/core/editor.ts';
import {FileManager} from './FileManager.tsx';
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

function initialTargetKey(value: unknown, currentProject: string, hasFrontendStorage: boolean): string {
  if (typeof value === 'string') {
    if (value.startsWith('++')) {
      const slash = value.indexOf('/');
      if (slash > 2 && hasFrontendStorage) {
        return value.slice(0, slash);
      }
    } else if (value.startsWith('+') && !value.startsWith('+/')) {
      const slash = value.indexOf('/');
      if (slash > 1) return value.slice(0, slash);
    }
  }
  return `+${currentProject}`;
}

export function formatPickedFilePath(
  entryPath: string,
  selectedProject: string,
  currentProject: string,
  frontend = false
): string {
  const prefix = `${selectedProject}/`;
  const relativePath = entryPath.startsWith(prefix) ? entryPath.slice(prefix.length) : entryPath;
  if (frontend) {
    return `++${selectedProject}/${relativePath}`;
  }
  return selectedProject === currentProject ? `+/${relativePath}` : `+${selectedProject}/${relativePath}`;
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
  const [selectedKey, setSelectedKey] = useState(() =>
    initialTargetKey(initialValue, currentProject, Boolean(frontendStorage))
  );
  const [projects, setProjects] = useState<string[]>([]);
  const [frontendProjects, setFrontendProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState<FileEntry | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedKey(initialTargetKey(initialValue, currentProject, Boolean(frontendStorage)));
    setSelected(null);

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

  const confirm = (entry: FileEntry) => {
    if (entry.type !== 'file' || entry.gitStatus === 'deleted') return;
    onSelectPath(formatPickedFilePath(entry.path, target.project, currentProject, target.frontend));
  };

  return (
    <Modal
      title={t('Select File')}
      open={open}
      onOk={() => selected && confirm(selected)}
      onCancel={onCancel}
      okButtonProps={{disabled: !selected}}
      destroyOnHidden
    >
      <div className="ticl-e-file-picker-project">
        <Select
          size="small"
          value={selectedKey}
          options={projectOptions}
          onChange={(next) => {
            setSelectedKey(next);
            setSelected(null);
          }}
        />
      </div>
      <div style={{height: 400}}>
        {open && (
          <FileManager
            key={selectedKey}
            storage={activeStorage}
            project={target.project}
            picker
            defaultPreview={false}
            onSelect={(entries) => {
              const entry = entries.length === 1 ? entries[0] : null;
              setSelected(entry?.type === 'file' && entry.gitStatus !== 'deleted' ? entry : null);
            }}
            onOpen={confirm}
          />
        )}
      </div>
    </Modal>
  );
}

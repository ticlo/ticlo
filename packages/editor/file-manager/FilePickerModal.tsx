import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Select} from 'antd';
import type {FileAccess, FileEntry, ProjectFiles} from '@ticlo/core';
import {FileManager} from './FileManager.tsx';
import {t} from '../component/LocalizedLabel.tsx';

export type PickerStorage = FileAccess & Partial<Pick<ProjectFiles, 'listProjects'>>;

export interface FilePickerModalProps {
  open: boolean;
  storage: PickerStorage;
  currentProject: string;
  initialValue?: unknown;
  onSelectPath: (filePath: string) => void;
  onCancel: () => void;
}

function initialProjectFromValue(value: unknown, currentProject: string): string {
  if (typeof value === 'string' && value.startsWith('+') && !value.startsWith('+/')) {
    const slash = value.indexOf('/');
    if (slash > 1) return value.slice(1, slash);
  }
  return currentProject;
}

export function formatPickedFilePath(entryPath: string, selectedProject: string, currentProject: string): string {
  const prefix = `${selectedProject}/`;
  const relativePath = entryPath.startsWith(prefix) ? entryPath.slice(prefix.length) : entryPath;
  return selectedProject === currentProject ? `+/${relativePath}` : `+${selectedProject}/${relativePath}`;
}

export function FilePickerModal({
  open,
  storage,
  currentProject,
  initialValue,
  onSelectPath,
  onCancel,
}: FilePickerModalProps) {
  const [project, setProject] = useState(() => initialProjectFromValue(initialValue, currentProject));
  const [projects, setProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState<FileEntry | null>(null);

  useEffect(() => {
    if (!open) return;
    setProject(initialProjectFromValue(initialValue, currentProject));
    setSelected(null);

    const controller = new AbortController();
    let active = true;
    const loadProjects = async () => {
      try {
        const list = storage.listProjects
          ? (await storage.listProjects({signal: controller.signal})).map((item) => item.id)
          : (await storage.listFiles('', {signal: controller.signal}))
              .filter((entry) => entry.type === 'folder')
              .map((entry) => entry.name);
        if (active) setProjects(list);
      } catch {
        if (active) setProjects([]);
      }
    };
    void loadProjects();
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, storage, currentProject, initialValue]);

  const projectOptions = useMemo(() => {
    const ids = [...new Set([currentProject, project, ...projects].filter(Boolean))];
    return ids.map((id) => ({value: id, label: id}));
  }, [currentProject, project, projects]);

  const confirm = (entry: FileEntry) => {
    if (entry.type !== 'file' || entry.gitStatus === 'deleted') return;
    onSelectPath(formatPickedFilePath(entry.path, project, currentProject));
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
          value={project}
          options={projectOptions}
          onChange={(next) => {
            setProject(next);
            setSelected(null);
          }}
        />
      </div>
      <div style={{height: 400}}>
        {open && (
          <FileManager
            storage={storage}
            project={project}
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

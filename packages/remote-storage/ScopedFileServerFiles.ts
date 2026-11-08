import type {AxiosRequestConfig} from 'axios';
import {filePath, type FileRequest, type ProjectGit} from '@ticlo/core/storage/FileAccess.ts';
import {LocalFileBackups} from './LocalFileBackups.ts';
import {RemoteFiles} from './RemoteStorage.ts';
import {TicloFileClient} from './TicloFileClient.ts';

/** File and Git access for one server scope, independent of flow storage. */
export class ScopedFileServerFiles extends RemoteFiles implements ProjectGit {
  private readonly client: TicloFileClient;
  private readonly backupStore: LocalFileBackups;
  private readonly listeners: Set<(path: string) => void>;

  constructor(
    baseURL: string,
    private readonly scope: 'proj' | 'serv'
  ) {
    const backups = new LocalFileBackups();
    const client = new TicloFileClient({baseURL});
    const userKey = `ticlo-file-user:${baseURL.replace(/\/$/, '')}`;
    let knownUser: string | undefined;
    let lookup: Promise<string> | undefined;
    const backupScope = async () => {
      if (!knownUser) {
        try {
          lookup ??= client.getCurrentUser().then(({id}) => {
            filePath(id);
            if (id.includes('/')) throw new Error('Invalid user ID');
            return id;
          });
          knownUser = await lookup;
          try {
            localStorage.setItem(userKey, knownUser);
          } catch {}
        } catch (error) {
          lookup = undefined;
          try {
            knownUser = localStorage.getItem(userKey) ?? undefined;
          } catch {}
          if (!knownUser) throw error;
        }
      }
      return `${baseURL}:${scope}:${knownUser}`;
    };
    const listeners = new Set<(path: string) => void>();
    super(
      {baseURL},
      async () => scope,
      backups,
      (path) => listeners.forEach((listener) => listener(path)),
      backupScope
    );
    this.client = client;
    this.backupStore = backups;
    this.listeners = listeners;
  }

  subscribeFileChanges(listener: (path: string) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyFileChange(path: string) {
    this.listeners.forEach((listener) => listener(path));
  }

  async close() {
    await this.backupStore.close();
  }

  private config(options?: FileRequest): AxiosRequestConfig {
    return {signal: options?.signal, params: {scope: this.scope}};
  }

  supportsGit(_project: string) {
    return true;
  }

  listProjects(options?: FileRequest) {
    return this.client.listProjects(this.config(options));
  }

  async createProject(name: string) {
    const project = await this.client.createProject(name, undefined, this.config());
    this.notifyFileChange(name);
    return project;
  }

  async getGitInfo(project: string, options?: FileRequest) {
    const info = await this.client.getGitInfo(project, this.config(options));
    if (info.initialized && !info.hasUncommittedChanges && (await this.hasProjectBackups(project))) {
      return {...info, hasUncommittedChanges: true};
    }
    return info;
  }

  initGit(project: string, options?: FileRequest) {
    return this.client.initGit(project, this.config(options));
  }

  commitGit(project: string, message: string, options?: FileRequest) {
    return this.client.commitGit(project, message, this.config(options));
  }

  getGitBranches(project: string, options?: FileRequest) {
    return this.client.getGitBranches(project, this.config(options));
  }

  deleteGitBranch(project: string, branch: string, options?: FileRequest) {
    return this.client.deleteGitBranch(project, branch, this.config(options));
  }

  getGitHistory(project: string, options?: FileRequest & {branch?: string}) {
    return this.client.getGitHistory(project, this.config(options), options?.branch);
  }

  async resetGitToCommit(project: string, commit: string, options?: FileRequest) {
    const result = await this.client.resetGitToCommit(project, commit, this.config(options));
    await this.discardProjectBackups(project);
    this.notifyFileChange(project);
    return result;
  }

  createProjectFromCommit(project: string, name: string, commit: string, options?: FileRequest) {
    return this.client.createProjectFromCommit(name, project, commit, this.config(options));
  }

  async restoreGitFile(path: string, options?: FileRequest) {
    filePath(path);
    await this.client.restoreGitFile(`${this.scope}/${path}`, this.config(options));
    this.notifyFileChange(path);
  }
}

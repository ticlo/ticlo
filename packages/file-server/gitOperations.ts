import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import type {UserAuth} from './auth.ts';
import {StorageError} from './types.ts';

const exec = promisify(execFile);
const LOG_FILE = '.gitlog';
const IGNORE_FILE = '.gitignore';

type GitStatus = 'added' | 'modified' | 'deleted';

interface GitLogEntry {
  time: string;
  user: string;
  action: string;
  file: string;
}

interface UserIdentity {
  user: string;
  name: string;
  email: string;
  realEmail?: string;
}

interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

async function git(projectRoot: string, ...args: string[]): Promise<string> {
  try {
    const {stdout} = await exec('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: {...process.env, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0'},
    });
    return stdout;
  } catch (error) {
    const detail = (error as {stderr?: string}).stderr?.trim();
    throw new StorageError(detail || (error as Error).message, 500);
  }
}

async function hasGit(projectRoot: string): Promise<boolean> {
  try {
    return (await fs.lstat(path.join(projectRoot, '.git'))).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function hasCommit(projectRoot: string): Promise<boolean> {
  try {
    await git(projectRoot, 'rev-parse', '--verify', 'HEAD');
    return true;
  } catch (error) {
    if (error instanceof StorageError && error.message.includes('Needed a single revision')) return false;
    throw error;
  }
}

async function ensureGit(projectRoot: string): Promise<void> {
  if (!(await hasGit(projectRoot))) throw new StorageError('Git is not initialized', 409);
}

async function ensureGitignore(projectRoot: string): Promise<void> {
  const ignorePath = path.join(projectRoot, IGNORE_FILE);
  let content = '';
  try {
    content = await fs.readFile(ignorePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!content.split(/\r?\n/).includes('/.gitlog')) {
    await fs.writeFile(ignorePath, `${content}${content && !content.endsWith('\n') ? '\n' : ''}/.gitlog\n`);
  }
  await fs.writeFile(path.join(projectRoot, LOG_FILE), '', {flag: 'a'});
}

async function initGit(projectRoot: string, projectId: string): Promise<void> {
  if (await hasGit(projectRoot)) throw new StorageError('Git is already initialized', 409);
  await git(projectRoot, 'check-ref-format', '--branch', projectId);
  await git(projectRoot, 'init', '-b', projectId);
  await ensureGitignore(projectRoot);
  await git(projectRoot, 'add', '-A');
}

async function forkGit(sourceRoot: string, targetRoot: string, projectId: string): Promise<void> {
  await git(targetRoot, 'init', '-b', projectId);
  await ensureGitignore(targetRoot);
  if (await hasCommit(sourceRoot)) {
    await git(targetRoot, 'fetch', '--no-tags', sourceRoot, 'HEAD');
    await git(targetRoot, 'reset', '--mixed', 'FETCH_HEAD');
  }
  await git(targetRoot, 'add', '-A');
}

function virtualEmail(user: string, name: string): string {
  const sanitized = name.replace(/[^A-Za-z0-9._+-]/g, '_').replace(/^[.+-]+|[.+-]+$/g, '') || 'user';
  const suffix = sanitized === name ? '' : `-${createHash('sha256').update(user).digest('hex').slice(0, 8)}`;
  return `${sanitized}${suffix}@ticlo.app`;
}

async function identity(auth: UserAuth): Promise<UserIdentity> {
  const user = auth.getUserId() || 'anonymous';
  let name = user;
  let realEmail: string | undefined;
  try {
    name = (await auth.getUserName?.()) || user;
    realEmail = await auth.getUserEmail?.();
  } catch {
    // Identity lookup is optional; the authenticated ID still identifies the edit.
  }
  return {user, name, email: realEmail || virtualEmail(user, name), realEmail};
}

async function readGitlog(projectRoot: string): Promise<GitLogEntry[]> {
  try {
    const content = await fs.readFile(path.join(projectRoot, LOG_FILE), 'utf8');
    if (content.trimStart().startsWith('{')) {
      const entries = content
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const old = JSON.parse(line) as {
            time: string;
            user: string;
            name: string;
            email: string;
            action: string;
            path: string;
            destination?: string;
          };
          const realEmail = old.email && old.email !== virtualEmail(old.user, old.name) ? old.email : undefined;
          return {
            time: old.time,
            user: realEmail ? `${old.user} <${realEmail}>` : old.user,
            action: old.action,
            file: old.destination ? `${old.path} -> ${old.destination}` : old.path,
          };
        });
      await writeGitlog(projectRoot, entries);
      return entries;
    }
    const entries: GitLogEntry[] = [];
    let fields: string[] = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < content.length; index++) {
      const char = content[index];
      if (quoted) {
        if (char === '"' && content[index + 1] === '"') {
          field += '"';
          index++;
        } else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') {
        if (field) throw new StorageError('Invalid .gitlog CSV', 500);
        quoted = true;
      } else if (char === ',') {
        fields.push(field);
        field = '';
      } else if (char === '\r' && content[index + 1] === '\n') {
        continue;
      } else if (char === '\n') {
        fields.push(field);
        if (fields.length !== 1 || fields[0]) {
          if (fields.length !== 4) throw new StorageError('Invalid .gitlog CSV', 500);
          entries.push({time: fields[0], user: fields[1], action: fields[2], file: fields[3]});
        }
        fields = [];
        field = '';
      } else field += char;
    }
    if (quoted) throw new StorageError('Invalid .gitlog CSV', 500);
    if (fields.length || field) {
      fields.push(field);
      if (fields.length !== 4) throw new StorageError('Invalid .gitlog CSV', 500);
      entries.push({time: fields[0], user: fields[1], action: fields[2], file: fields[3]});
    }
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function formatGitlogEntry(entry: GitLogEntry): string {
  return [entry.time, entry.user, entry.action, entry.file].map(csvField).join(',');
}

async function writeGitlog(projectRoot: string, entries: GitLogEntry[]): Promise<void> {
  await fs.writeFile(
    path.join(projectRoot, LOG_FILE),
    entries.map(formatGitlogEntry).join('\n') + (entries.length ? '\n' : '')
  );
}

function logUser(user: string): string {
  return user.replace(/ <[^<>]+>$/, '');
}

function logAuthor(user: string): Pick<UserIdentity, 'name' | 'email'> {
  const match = /^(.*) <([^<>]+)>$/.exec(user);
  const name = match ? match[1] : user;
  return {name, email: match ? match[2] : virtualEmail(name, name)};
}

async function logChange(
  projectRoot: string,
  auth: UserAuth,
  action: string,
  relativePath: string,
  destination?: string
): Promise<void> {
  if (!(await hasGit(projectRoot))) return;
  const author = await identity(auth);
  const entry: GitLogEntry = {
    time: new Date().toISOString(),
    user: author.realEmail ? `${author.user} <${author.realEmail}>` : author.user,
    action,
    file: destination ? `${relativePath} -> ${destination}` : relativePath,
  };
  const entries = await readGitlog(projectRoot);
  if (action === 'edit') {
    const previous = entries.findLastIndex((item) => item.file === relativePath);
    if (
      previous >= 0 &&
      entries[previous].action === 'edit' &&
      logUser(entries[previous].user) === author.user &&
      Date.parse(entry.time) - Date.parse(entries[previous].time) < 60 * 60 * 1000
    ) {
      entries.splice(previous, 1);
    }
  }
  entries.push(entry);
  await writeGitlog(projectRoot, entries);
}

async function gitStatus(projectRoot: string): Promise<Map<string, GitStatus>> {
  const result = new Map<string, GitStatus>();
  if (!(await hasGit(projectRoot))) return result;
  const output = await git(projectRoot, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  const records = output.split('\0');
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record) continue;
    const code = record.slice(0, 2);
    const filename = record.slice(3);
    if (code.includes('R') || code.includes('C')) {
      result.set(filename, 'added');
      const source = records[++index];
      if (source) result.set(source, 'deleted');
    } else {
      result.set(filename, code.includes('D') ? 'deleted' : code.includes('A') || code === '??' ? 'added' : 'modified');
    }
  }
  return result;
}

function statusForPath(statuses: Map<string, GitStatus>, relativePath: string): GitStatus | undefined {
  const direct = statuses.get(relativePath);
  if (direct) return direct;
  const children = [...statuses]
    .filter(([path]) => !relativePath || path.startsWith(`${relativePath}/`))
    .map(([, status]) => status);
  if (!children.length) return undefined;
  return children.every((status) => status === 'deleted')
    ? 'deleted'
    : children.every((status) => status === 'added')
      ? 'added'
      : 'modified';
}

async function gitInfo(projectRoot: string): Promise<{initialized: boolean; branch?: string}> {
  if (!(await hasGit(projectRoot))) return {initialized: false};
  return {initialized: true, branch: (await git(projectRoot, 'branch', '--show-current')).trim()};
}

async function gitHistory(projectRoot: string): Promise<GitCommit[]> {
  await ensureGit(projectRoot);
  if (!(await hasCommit(projectRoot))) return [];
  const output = await git(projectRoot, 'log', '--format=%H%x00%an%x00%ae%x00%aI%x00%B%x00');
  return output
    .split('\0\n')
    .filter(Boolean)
    .map((record) => {
      const [hash, author, email, date, message] = record.split('\0');
      return {hash, author, email, date, message};
    });
}

async function commitGit(projectRoot: string, auth: UserAuth, message: string): Promise<GitCommit> {
  await ensureGit(projectRoot);
  await git(projectRoot, 'add', '-A');
  const staged = await git(projectRoot, 'diff', '--cached', '--name-only');
  const entries = await readGitlog(projectRoot);
  if (!staged && !entries.length) throw new StorageError('Nothing to commit', 409);
  const current = await identity(auth);
  const author =
    entries.length && entries.every((entry) => logUser(entry.user) === logUser(entries[0].user))
      ? logAuthor(entries.find((entry) => entry.user !== logUser(entry.user))?.user ?? entries[0].user)
      : current;
  const userMessage = message.trim() || 'Update project files';
  const commitMessage = entries.length
    ? `${userMessage}\n\n--- --- ---\n${entries.map(formatGitlogEntry).join('\n')}`
    : userMessage;
  try {
    await exec('git', ['commit', ...(staged ? [] : ['--allow-empty']), '-m', commitMessage], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        LC_ALL: 'C',
        GIT_TERMINAL_PROMPT: '0',
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: current.name,
        GIT_COMMITTER_EMAIL: current.email,
      },
    });
  } catch (error) {
    throw new StorageError((error as {stderr?: string}).stderr?.trim() || (error as Error).message, 500);
  }
  await fs.writeFile(path.join(projectRoot, LOG_FILE), '');
  return (await gitHistory(projectRoot))[0];
}

export {commitGit, ensureGit, forkGit, gitHistory, gitInfo, gitStatus, hasGit, initGit, logChange, statusForPath};
export type {GitCommit, GitLogEntry, GitStatus};

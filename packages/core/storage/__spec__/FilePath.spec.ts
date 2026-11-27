import {describe, expect, it} from 'vitest';
import {
  buildProjectFileUrl,
  classifyFilePath,
  isRelativeProjectFilePath,
  normalizeLibraryId,
  parseFilePath,
  resolveSubflowFilePath,
  tryParseFilePath,
} from '../FilePath.ts';

describe('FilePath helpers', () => {
  it('classifies url, external, project, and relative paths with // before /', () => {
    expect(classifyFilePath('')).toBeUndefined();
    expect(classifyFilePath('http://example.com/a.txt')).toBe('url');
    expect(classifyFilePath('https://example.com/a.txt')).toBe('url');
    expect(classifyFilePath('//cdn.example.com/a.txt')).toBe('url');

    expect(classifyFilePath('/assets/a.txt')).toBe('external');
    expect(classifyFilePath('./a.txt')).toBe('external');
    expect(classifyFilePath('../a.txt')).toBe('external');

    expect(classifyFilePath('++proj1/file1.txt')).toBe('frontend');
    expect(classifyFilePath('++#root/file1.txt')).toBe('frontend');

    expect(classifyFilePath('+proj1/file1.txt')).toBe('project');
    expect(classifyFilePath('+#root/file1.txt')).toBe('project');

    expect(classifyFilePath('+/file2.txt')).toBe('relative');
    expect(classifyFilePath('+/sub/file2.txt')).toBe('relative');

    expect(classifyFilePath('file2.txt')).toBeUndefined();
    expect(classifyFilePath('sub/file2.txt')).toBeUndefined();
    expect(classifyFilePath('.hidden')).toBeUndefined();
    expect(classifyFilePath('http-file.txt')).toBeUndefined();
  });

  it('matches isRelativeProjectFilePath identically to non-empty +/ relative paths', () => {
    const samples = [
      '',
      '+/',
      'http://example.com/a',
      'https://example.com/a',
      '//cdn.example.com/a',
      '/abs/a',
      './rel/a',
      '../rel/a',
      '+proj1/a',
      '+/a.txt',
      '+/sub/a.txt',
      'a.txt',
      'sub/a.txt',
      '.dotfile',
      'http-local.txt',
      'h',
    ];
    for (const sample of samples) {
      expect(isRelativeProjectFilePath(sample)).toBe(classifyFilePath(sample) === 'relative' && sample.length > 2);
    }
  });

  it('normalizes libraries and parses project paths with validation', () => {
    expect(normalizeLibraryId(undefined)).toBe('#root');
    expect(normalizeLibraryId('+#root')).toBe('#root');
    expect(normalizeLibraryId('+proj2')).toBe('proj2');
    expect(normalizeLibraryId('proj2')).toBe('proj2');

    expect(parseFilePath('+/file2.txt', '+proj2')).toEqual({
      kind: 'project',
      project: 'proj2',
      relativePath: 'file2.txt',
      storagePath: 'proj2/file2.txt',
    });
    expect(parseFilePath('+/file2.txt')).toEqual({
      kind: 'project',
      project: '#root',
      relativePath: 'file2.txt',
      storagePath: '#root/file2.txt',
    });
    expect(parseFilePath('+project1/dir/file1.txt', '+proj2')).toEqual({
      kind: 'project',
      project: 'project1',
      relativePath: 'dir/file1.txt',
      storagePath: 'project1/dir/file1.txt',
    });
    expect(parseFilePath('++project1/dir/file1.txt', '+proj2')).toEqual({
      kind: 'frontend',
      project: 'project1',
      relativePath: 'dir/file1.txt',
      storagePath: 'project1/dir/file1.txt',
    });

    expect(() => parseFilePath('')).toThrowError('Invalid file path');
    expect(() => parseFilePath('+/')).toThrowError('Invalid file path');
    expect(() => parseFilePath('++/file.txt')).toThrowError('Invalid file path');
    expect(() => parseFilePath('++proj1')).toThrowError('Invalid file path');
    expect(() => parseFilePath('++proj1/')).toThrowError('Invalid file path');
    expect(() => parseFilePath('file2.txt')).toThrowError('Invalid file path');
    expect(() => parseFilePath('+proj1')).toThrowError('Invalid file path');
    expect(() => parseFilePath('+proj1/')).toThrowError('Invalid file path');
    expect(() => parseFilePath('+proj1/../escape.txt')).toThrowError('Invalid file path');
    expect(() => parseFilePath('+/sub/../escape.txt', '+proj2')).toThrowError('Invalid file path');
    expect(tryParseFilePath('+proj1/../escape.txt')).toBeUndefined();
    expect(tryParseFilePath('file2.txt')).toBeUndefined();

    expect(parseFilePath('+/', '+proj2', {allowEmptyRelative: true})).toEqual({
      kind: 'project',
      project: 'proj2',
      relativePath: '',
      storagePath: 'proj2',
    });
    expect(parseFilePath('+proj1', '+proj2', {allowEmptyRelative: true})).toEqual({
      kind: 'project',
      project: 'proj1',
      relativePath: '',
      storagePath: 'proj1',
    });
    expect(parseFilePath('+proj1/', '+proj2', {allowEmptyRelative: true})).toEqual({
      kind: 'project',
      project: 'proj1',
      relativePath: '',
      storagePath: 'proj1',
    });
    expect(parseFilePath('++web', '+proj2', {allowEmptyRelative: true})).toEqual({
      kind: 'frontend',
      project: 'web',
      relativePath: '',
      storagePath: 'web',
    });
    expect(parseFilePath('++web/', '+proj2', {allowEmptyRelative: true})).toEqual({
      kind: 'frontend',
      project: 'web',
      relativePath: '',
      storagePath: 'web',
    });
    expect(() => parseFilePath('++/', '+proj2', {allowEmptyRelative: true})).toThrowError('Invalid file path');
    expect(() => parseFilePath('+', '+proj2', {allowEmptyRelative: true})).toThrowError('Invalid file path');
  });

  it('rewrites only non-empty +/ relative paths across different libraries', () => {
    expect(resolveSubflowFilePath('+/file.txt', '+proj1', '+proj2')).toBe('+proj1/file.txt');
    expect(resolveSubflowFilePath('+/file.txt', '+#root', '+proj2')).toBe('+#root/file.txt');
    expect(resolveSubflowFilePath('+/file.txt', '+proj1', '+proj1')).toBe('+/file.txt');
    expect(resolveSubflowFilePath('file.txt', '+proj1', '+proj2')).toBe('file.txt');
    expect(resolveSubflowFilePath('+/', '+proj1', '+proj2')).toBe('+/');
    expect(resolveSubflowFilePath('+proj3/file.txt', '+proj1', '+proj2')).toBe('+proj3/file.txt');
    expect(resolveSubflowFilePath('++proj3/file.txt', '+proj1', '+proj2')).toBe('++proj3/file.txt');
    expect(resolveSubflowFilePath('https://a.com/x', '+proj1', '+proj2')).toBe('https://a.com/x');
    expect(resolveSubflowFilePath('//a.com/x', '+proj1', '+proj2')).toBe('//a.com/x');
    expect(resolveSubflowFilePath('/abs/x', '+proj1', '+proj2')).toBe('/abs/x');
    expect(resolveSubflowFilePath('./rel/x', '+proj1', '+proj2')).toBe('./rel/x');
    expect(resolveSubflowFilePath('../rel/x', '+proj1', '+proj2')).toBe('../rel/x');
    expect(resolveSubflowFilePath('', '+proj1', '+proj2')).toBe('');
    expect(resolveSubflowFilePath(undefined, '+proj1', '+proj2')).toBeUndefined();
  });

  it('encodes #root and path segments when building project file URLs', () => {
    expect(buildProjectFileUrl('http://localhost:8010/file/', '#root/a b#1.txt')).toBe(
      'http://localhost:8010/file/proj/%23root/a%20b%231.txt'
    );
  });
});

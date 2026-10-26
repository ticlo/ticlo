import {describe, expect, it} from 'vitest';
import {parseIcon, pathBackground, svgBackground} from '../IconDefinition.ts';

describe('function icon definitions', () => {
  it('parses positioned text, explicit sizes and literal colons', () => {
    expect(parseIcon('tl13:a  b:two words  :http://example').texts).toEqual([
      {position: 'tl', fontSize: 13, text: 'a', shiftUp: false},
      {position: 'b', fontSize: 9, text: 'two words', shiftUp: false},
      {position: '', fontSize: 18, text: 'http://example', shiftUp: false},
    ]);
    expect(parseIcon('8:long text stays intact').texts).toEqual([
      {position: '', fontSize: 8, text: 'long text stays intact', shiftUp: false},
    ]);
  });

  it.each(['l', 't', 'r', 'b', 'tl', 'tr', 'bl', 'br'])('accepts position %s', (position) => {
    expect(parseIcon(`${position}:x`).texts).toEqual([{position, fontSize: 9, text: 'x', shiftUp: false}]);
  });

  it.each(['lt', 'rt', 'lb', 'rb'])('rejects reversed position %s', (position) => {
    expect(parseIcon(`${position}:x  ${position}13:y`).texts).toEqual([]);
  });

  it('parses the upward-shift marker independently for each text layer', () => {
    expect(parseIcon('17^:[ ]  ^:x^  br9.5^:b  :A').texts).toEqual([
      {position: '', fontSize: 17, text: '[ ]', shiftUp: true},
      {position: '', fontSize: 18, text: 'x^', shiftUp: true},
      {position: 'br', fontSize: 9.5, text: 'b', shiftUp: true},
      {position: '', fontSize: 18, text: 'A', shiftUp: false},
    ]);
    expect(parseIcon('^17:a  17^^:b  br^9:c  svg^:react').texts).toEqual([]);
  });

  it('uses the first background and keeps text before and after it', () => {
    expect(parseIcon('t:A  svg:react  path:M0 0L96 96Z  b:B')).toEqual({
      background: {type: 'svg', value: 'react'},
      texts: [
        {position: 't', fontSize: 9, text: 'A', shiftUp: false},
        {position: 'b', fontSize: 9, text: 'B', shiftUp: false},
      ],
    });
    expect(parseIcon('path:M0 0L96 96Z  svg:clock').background).toEqual({type: 'path', value: 'M0 0L96 96Z'});
  });

  it('ignores invalid expressions and unsafe asset names', () => {
    expect(parseIcon('svg:../clock  unknown:a  lr:b  tb:c  tt:d  0:e  :\t  :valid')).toEqual({
      background: undefined,
      texts: [{position: '', fontSize: 18, text: 'valid', shiftUp: false}],
    });
    expect(parseIcon(undefined)).toEqual({background: undefined, texts: []});
  });

  it('encodes SVG backgrounds and escapes path attributes in a 96-unit viewBox', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>';
    const decode = (background: string) => decodeURIComponent(background.slice('url("data:image/svg+xml,'.length, -2));
    expect(decode(svgBackground(svg))).toBe(svg);
    const path = decode(pathBackground('M0 0"/><script>&'));
    expect(path).toContain('viewBox="0 0 96 96"');
    expect(path).toContain('d="M0 0&quot;/>&lt;script>&amp;"');
    expect(path).not.toContain('<script>');
  });
});

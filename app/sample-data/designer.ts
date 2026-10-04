import type {DataMap} from '@ticlo/core';

export const designerData: DataMap = {
  '#is': '',
  '#main': {
    '#is': 'react:div',
    'style': {
      minHeight: '100%',
      boxSizing: 'border-box',
      padding: 48,
      background: '#f6f8fc',
      color: '#18243b',
      fontFamily: 'system-ui, sans-serif',
    },
    '#order': ['title', 'description', 'card'],
    'title': {
      '#is': 'react:p',
      'content': 'Welcome to your page',
      'style': {fontSize: 32, fontWeight: 600, margin: '0 0 16px'},
    },
    'description': {
      '#is': 'react:p',
      'content': 'A place for your next interface.',
      'style': {fontSize: 18, color: '#5c6b84', margin: '0 0 32px'},
    },
    'card': {
      '#is': 'react:div',
      'style': {padding: 24, maxWidth: 480, borderRadius: 12, background: '#fff'},
      '#order': ['title', 'description'],
      'title': {
        '#is': 'react:p',
        'content': 'Make it yours',
        'style': {fontSize: 20, fontWeight: 600, margin: '0 0 8px'},
      },
      'description': {
        '#is': 'react:p',
        'content': 'Bring your ideas, content, and components together.',
        'style': {color: '#5c6b84', margin: 0},
      },
    },
  },
};

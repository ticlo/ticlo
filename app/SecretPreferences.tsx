import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button, Input, Modal, Space, Tag, notification} from 'antd';
import {translateEditor} from '@ticlo/core/util/i18n.ts';
import {
  addSecretPassword,
  listSecretPasswords,
  missingPrimaryPassword,
  onBrowserSecretNotice,
  removeSecretPassword,
  setPrimarySecretPassword,
} from '@ticlo/remote-storage';

const unreadableSecrets = 'Some secrets could not be opened. Add their passwords, then unload and reload the flow.';
const noticeOptions = {placement: 'topRight', top: 16, getContainer: () => document.body} as const;

function label(key: string) {
  return translateEditor(key, {defaultValue: key}) ?? key;
}

export function mountSecretPreferences() {
  const host = document.createElement('div');
  document.body.append(host);
  createRoot(host).render(<SecretPreferences />);
}

export function SecretPreferences({open = false, onClose}: {open?: boolean; onClose?: () => void}) {
  const [notices, noticeHolder] = notification.useNotification(noticeOptions);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState({ids: [] as string[], primary: undefined as string | undefined});
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const visible = open || requested;

  useEffect(
    () =>
      onBrowserSecretNotice((notice) => {
        if (notice.type === 'primary') setRequested(true);
        else {
          const text = label(unreadableSecrets);
          const ids = notice.ids.filter(Boolean);
          notices.warning({
            title: label('Secret'),
            description: ids.length ? `${text} (${ids.join(', ')})` : text,
            duration: 10,
          });
        }
      }),
    [notices]
  );

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      try {
        setEntries(listSecretPasswords());
      } catch {
        setError('Could not read the browser passwords.');
      }
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [visible]);

  const update = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setEntries(listSecretPasswords());
    } catch {
      setError('Could not update the browser passwords.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {noticeHolder}
      <Modal
        title={label('Secret')}
        open={visible}
        footer={null}
        destroyOnHidden
        onCancel={() => {
          if (busy) return;
          setPassword('');
          setError('');
          setRequested(false);
          onClose?.();
        }}
      >
        {requested && !entries.primary && <p>{label(missingPrimaryPassword)}</p>}
        <Space orientation="vertical" style={{width: '100%'}}>
          {entries.ids.map((id) => (
            <Space key={id} wrap>
              <code>{id}</code>
              {entries.primary === id ? (
                <Tag>{label('Primary')}</Tag>
              ) : (
                <Button disabled={busy} onClick={() => void update(() => setPrimarySecretPassword(id))}>
                  {label('Set as Primary')}
                </Button>
              )}
              <Button disabled={busy} onClick={() => void update(() => removeSecretPassword(id))}>
                {label('Remove Password')}
              </Button>
            </Space>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              if (!password) return;
              const bytes = new TextEncoder().encode(password);
              setPassword('');
              void update(() => addSecretPassword(bytes));
            }}
          >
            <Space.Compact block>
              <Input.Password
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={label('New Password')}
                autoComplete="off"
                disabled={busy}
                required
              />
              <Button htmlType="submit" type="primary" loading={busy}>
                {label('Add Password')}
              </Button>
            </Space.Compact>
          </form>
          {error && <div>{label(error)}</div>}
        </Space>
      </Modal>
    </>
  );
}

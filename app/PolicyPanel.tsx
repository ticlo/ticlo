import React, {useState} from 'react';
import {Button, Checkbox, Input, Select, Space, Switch} from 'antd';
import type {EditPolicy} from '@ticlo/core';

const editCommands = [
  'set',
  'update',
  'restoreSaved',
  'bind',
  'addBlock',
  'addFlow',
  'addFlowFolder',
  'paste',
  'copy',
  'renameProp',
  'showProps',
  'hideProps',
  'moveShownProp',
  'setLen',
  'addCustomProp',
  'removeCustomProp',
  'moveCustomProp',
  'addOptionalProp',
  'removeOptionalProp',
  'moveOptionalProp',
  'insertGroupProp',
  'removeGroupProp',
  'moveGroupProp',
  'editWorker',
  'applyFlowChange',
  'deleteFunction',
  'callFunction',
  'executeCommand',
] as const;

const listFields = [
  ['allowPaths', 'Allowed paths', 'example.**'],
  ['denyPaths', 'Denied paths', 'example.locked.**'],
  ['allowProps', 'Allowed fields', 'value?, title'],
  ['denyProps', 'Denied fields', '#is, @b-*'],
  ['allowBinding', 'Allowed binding fields', 'value, input?'],
  ['allowBlockTypes', 'Allowed block types', 'add, subtract'],
  ['denyBlockTypes', 'Denied block types', 'script'],
] as const;

const blockFields = [
  ['allowCreateBlock', 'Create blocks'],
  ['allowDeleteBlock', 'Delete blocks'],
  ['allowChangeBlockType', 'Change block types'],
] as const;

/** Playground-only controls, deliberately separate from the reusable editor. */
export function PolicyPanel({onChange}: {onChange: (policy?: EditPolicy) => void}) {
  const [enabled, setEnabled] = useState(false);
  const [policy, setPolicy] = useState<EditPolicy>({});
  const [texts, setTexts] = useState<Record<string, string>>({});

  function update(next: EditPolicy, active = enabled) {
    setPolicy(next);
    onChange(active ? next : undefined);
  }

  function preset(next: EditPolicy) {
    setEnabled(true);
    setTexts(Object.fromEntries(listFields.map(([key]) => [key, next[key]?.join(', ') ?? ''])));
    update(next, true);
  }

  return (
    <div style={{padding: 12, height: '100%', overflow: 'auto', boxSizing: 'border-box'}}>
      <Space orientation="vertical" style={{width: '100%'}} size={12}>
        <Space>
          <Switch
            aria-label="Enable client policy"
            checked={enabled}
            onChange={(active) => {
              setEnabled(active);
              update(policy, active);
            }}
          />
          <span>Client policy</span>
        </Space>
        <div>Changes apply immediately to the stage and property editor.</div>
        <Space wrap size={4}>
          <Button size="small" onClick={() => preset({})}>
            Unrestricted
          </Button>
          <Button size="small" onClick={() => preset({allowCmds: []})}>
            Read only
          </Button>
          <Button size="small" onClick={() => preset({allowPaths: ['example.**']})}>
            Example flow
          </Button>
          <Button size="small" onClick={() => preset({allowProps: ['value*']})}>
            Value only
          </Button>
          <Button size="small" onClick={() => preset({allowCreateBlock: false})}>
            No new blocks
          </Button>
        </Space>
        <div style={{fontSize: 12}}>
          Enable a list to apply it. An empty allow list permits nothing. Separate entries with commas or newlines. *
          matches within one level; .** matches descendants, excluding the parent; ? matches one or more digits (0-9).
        </div>
        {listFields.map(([key, label, placeholder]) => (
          <div key={key}>
            <Checkbox
              checked={policy[key] !== undefined}
              disabled={!enabled}
              onChange={(event) => {
                update({
                  ...policy,
                  [key]: event.target.checked
                    ? (texts[key] ?? '')
                        .split(/[,\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : undefined,
                });
              }}
            >
              {label}
            </Checkbox>
            <Input.TextArea
              aria-label={label}
              autoSize={{minRows: 1, maxRows: 3}}
              disabled={!enabled || policy[key] === undefined}
              placeholder={placeholder}
              value={texts[key] ?? ''}
              onChange={(event) => {
                const text = event.target.value;
                setTexts({...texts, [key]: text});
                update({
                  ...policy,
                  [key]: text
                    .split(/[,\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
              }}
            />
          </div>
        ))}
        {(['allowCmds', 'denyCmds'] as const).map((key) => {
          const label = key === 'allowCmds' ? 'Allowed commands' : 'Denied commands';
          return (
            <div key={key}>
              <Checkbox
                checked={policy[key] !== undefined}
                disabled={!enabled}
                onChange={(event) => update({...policy, [key]: event.target.checked ? [] : undefined})}
              >
                {label}
              </Checkbox>
              <Select
                mode="multiple"
                aria-label={label}
                style={{width: '100%'}}
                size="small"
                disabled={!enabled || policy[key] === undefined}
                options={editCommands.map((value) => ({label: value, value}))}
                value={policy[key] ? [...policy[key]] : []}
                onChange={(value) => update({...policy, [key]: value})}
              />
            </div>
          );
        })}
        {blockFields.map(([key, label]) => (
          <Checkbox
            key={key}
            disabled={!enabled}
            checked={policy[key] !== false}
            onChange={(event) => update({...policy, [key]: event.target.checked ? undefined : false})}
          >
            {label}
          </Checkbox>
        ))}
      </Space>
    </div>
  );
}

import {describe, expect, it} from 'vitest';
import {checkEditPolicy, type EditPolicy, EditPolicyView, matchEditPath} from '../EditPolicy.ts';
import '../../functions/math/Arithmetic.ts';

describe('EditPolicy', () => {
  it('matches path segments, recursive wildcards and literal punctuation', () => {
    for (const path of ['Main.a', 'Main.a.value']) expect(matchEditPath('Main.**', path)).toBe(true);
    expect(matchEditPath('Main.**', 'Main')).toBe(false);
    expect(matchEditPath('Main.*', 'Main.a.value')).toBe(false);
    expect(matchEditPath('Main.*', 'Main.a')).toBe(true);
    expect(matchEditPath('Main.*.**', 'Main')).toBe(false);
    expect(matchEditPath('Main.*.**', 'Main.a')).toBe(false);
    expect(matchEditPath('Main.*.**', 'Main.a.value')).toBe(true);
    expect(matchEditPath('Main.**.value', 'Main.value')).toBe(true);
    expect(matchEditPath('Main.**.value', 'Main.a.b.value')).toBe(true);
    expect(matchEditPath('Main.sensor*.[]', 'Main.sensor1.[]')).toBe(true);
    expect(matchEditPath('Main.sensor*.[]', 'Main.sensor1.a')).toBe(false);
    expect(matchEditPath('Main.**', 'MainOther.value')).toBe(false);
  });

  it('matches one or more digits with ? without crossing path segments', () => {
    for (const name of ['value0', 'value12', 'value007']) expect(matchEditPath('value?', name)).toBe(true);
    for (const name of ['value', 'valueA', 'value1A', 'value-1', 'value1.2', 'value１', 'value?']) {
      expect(matchEditPath('value?', name)).toBe(false);
    }
    expect(matchEditPath('?', '123')).toBe(true);
    expect(matchEditPath('?', '')).toBe(false);
    expect(matchEditPath('Main.**.value?', 'Main.value0')).toBe(true);
    expect(matchEditPath('Main.**.value?', 'Main.a.value123')).toBe(true);
    expect(matchEditPath('Main.**.value?', 'Main.a.value')).toBe(false);
    expect(matchEditPath('Main.?.value', 'Main.12.value')).toBe(true);
    expect(matchEditPath('value?*', 'value12Text')).toBe(true);
    expect(matchEditPath('value?*', 'valueText')).toBe(false);
    expect(matchEditPath('value[?]', 'value[12]')).toBe(true);
    expect(matchEditPath('value[?]', 'value12')).toBe(false);
  });

  it('supports numeric patterns in paths, property limits and binding targets', () => {
    const view = new EditPolicyView({
      allowPaths: ['Main.block?.**'],
      denyPaths: ['Main.block0.**'],
      allowProps: ['value?'],
      denyProps: ['value0?'],
      allowBinding: ['value?'],
    });
    expect(view.canWriteField('Main.block12.value0')).toBe(true);
    expect(view.canWriteField('Main.block12.value123')).toBe(true);
    expect(view.canWriteField('Main.block12.value01')).toBe(false);
    expect(view.canWriteField('Main.block12.value')).toBe(false);
    expect(view.canWriteField('Main.blockText.value1')).toBe(false);
    expect(view.canWriteField('Main.block0.value1')).toBe(false);
    expect(view.canBindField('Main.block12.value01')).toBe(true);
    expect(view.canBindField('Main.block12.value')).toBe(false);
    expect(view.canBindField('Main.block12.valueText')).toBe(false);
    expect(view.canBindField('Main.block0.value1')).toBe(false);
  });

  it('protects denied numeric descendants during whole-block operations', () => {
    const view = new EditPolicyView({denyPaths: ['Main.block?.hidden']});
    expect(view.canDeleteBlock('Main.block12')).toBe(false);
    expect(view.canDeleteBlock('Main')).toBe(false);
    expect(view.canDeleteBlock('Main.other')).toBe(true);
    expect(new EditPolicyView({allowPaths: ['Main.block?.**']}).canDeleteBlock('Main.block12')).toBe(false);
    expect(new EditPolicyView({allowPaths: ['Main.**']}).canDeleteBlock('Main.block12')).toBe(true);
    expect(new EditPolicyView({denyPaths: ['Main.a']}).canDeleteBlock('Main.ab')).toBe(true);
  });

  it('applies all top-level limits while leaving reads and subscriptions available', () => {
    const policy = {allowPaths: ['Main.**'], denyPaths: ['Main.secret.**'], allowProps: ['value'], denyCmds: ['bind']};
    expect(checkEditPolicy(policy, {cmd: 'set', path: 'Main.a.value', value: 1})).toBeNull();
    expect(checkEditPolicy(policy, {cmd: 'set', path: 'Other.a.value'})).toBe('restricted path');
    expect(checkEditPolicy(policy, {cmd: 'set', path: 'Main.secret.value'})).toBe('restricted path');
    expect(checkEditPolicy(policy, {cmd: 'set', path: 'Main.a.other'})).toBe('restricted property');
    expect(checkEditPolicy(policy, {cmd: 'bind', path: 'Main.a.value'})).toBe('restricted command');
    for (const cmd of ['get', 'watch', 'subscribe', 'watchDesc', 'getSettings', 'copy', 'undo', 'redo']) {
      expect(checkEditPolicy({allowCmds: [], allowPaths: []}, {cmd, path: 'Other'})).toBeNull();
    }
    expect(checkEditPolicy({allowProps: []}, {cmd: 'set', path: 'Main.a'})).toBe('restricted property');
    expect(checkEditPolicy({allowCmds: []}, {cmd: 'set', path: 'Main.a'})).toBe('restricted command');
    const view = new EditPolicyView({allowPaths: ['Main.**'], allowProps: ['value']});
    expect(view.canWriteField('Main.a.value')).toBe(true);
    expect(view.canWriteField('Main.a.other')).toBe(false);
  });

  it('checks creation through set and nested paste, and separates creation from type changes', () => {
    const policy = {allowCreateBlock: false};
    expect(checkEditPolicy(policy, {cmd: 'set', path: 'Main.a', value: {'#is': 'add'}})).toBe(
      'restricted block creation'
    );
    expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main', data: {'#static': {a: {'#is': 'add'}}}})).toBe(
      'restricted block creation'
    );
    expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main', data: {'~value': {}}})).toBe(
      'restricted block creation'
    );
    expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main', data: {a: {'#is': 1}}})).toBe(
      'restricted block creation'
    );
    expect(
      checkEditPolicy(
        {allowBlockTypes: ['add']},
        {cmd: 'addBlock', path: 'Main.a', data: {'#is': 'add', 'nested': {'#is': 'subtract'}}}
      )
    ).toBe('restricted block type');
    expect(
      checkEditPolicy({allowChangeBlockType: false}, {cmd: 'addBlock', path: 'Main.a', data: {'#is': 'add'}})
    ).toBeNull();
    expect(checkEditPolicy({allowChangeBlockType: false}, {cmd: 'set', path: 'Main.a.#is', value: 'add'})).toBe(
      'restricted block type change'
    );
    expect(checkEditPolicy({allowBlockTypes: ['add']}, {cmd: 'paste', path: 'Main.a', data: {'~#is': 'add'}})).toBe(
      'restricted block type'
    );
    expect(
      checkEditPolicy({allowDeleteBlock: false}, {cmd: 'paste', path: 'Main.a', data: {'~value': {}}}, () => true)
    ).toBe('restricted block deletion');
    expect(new EditPolicyView({allowDeleteBlock: false}).canDeleteBlock('Main.a')).toBe(false);
    expect(new EditPolicyView({allowPaths: ['Main.**']}).canDeleteBlock('Main.a')).toBe(true);
  });

  it('requires the parent subtree for automatic names in clients, servers and previews', () => {
    const request = {cmd: 'addBlock', path: 'Main.add', data: {'#is': 'add'}, findName: true};
    for (const mode of ['client', 'server', 'preview'] as const) {
      expect(checkEditPolicy({allowPaths: ['Main.add', 'Main.add.**']}, request, undefined, mode)).toBe(
        'restricted path'
      );
      expect(checkEditPolicy({allowPaths: ['Main.**']}, request, undefined, mode)).toBeNull();
      expect(checkEditPolicy({allowPaths: [], readonlyPaths: ['Main', 'Main.**']}, request, undefined, mode)).toBe(
        'restricted path'
      );
      expect(checkEditPolicy({denyPaths: ['Main.other.**']}, request, undefined, mode)).toBe('restricted path');
      expect(checkEditPolicy({allowBlockTypes: ['subtract']}, request, undefined, mode)).toBe('restricted block type');
      expect(checkEditPolicy({allowCreateBlock: false}, request, undefined, mode)).toBe('restricted block creation');
    }
    const limited = new EditPolicyView({allowPaths: ['Main.add', 'Main.add.**']});
    expect(limited.can(request)).toBe(false);
    expect(limited.canCreateBlock('Main.add', 'add')).toBe(true);
  });

  it('requires all binding names when automatically naming a helper block', () => {
    const request = {cmd: 'addBlock', path: 'Main.~value1', data: {'#is': 'add'}, findName: true};
    expect(checkEditPolicy({allowBinding: ['value1']}, request)).toBe('restricted binding');
    expect(checkEditPolicy({denyProps: ['value']}, request)).toBe('restricted binding');
    expect(checkEditPolicy({allowBinding: ['*'], denyProps: ['value']}, request)).toBeNull();
    expect(checkEditPolicy({allowBinding: ['value1']}, {...request, findName: false})).toBeNull();
    expect(
      checkEditPolicy(
        {allowBinding: ['value1']},
        {cmd: 'addBlock', path: 'Main.add', data: {'#is': 'add', '~value1': {'#is': 'add'}}, findName: true}
      )
    ).toBeNull();
  });

  it('limits binding targets by property name without restricting value edits', () => {
    const view = new EditPolicyView({allowBinding: ['input*']});
    expect(view.canBindField('Main.block.input0')).toBe(true);
    expect(view.canBindField('Main.other.input1')).toBe(true);
    expect(view.canBindField('Main.block.value')).toBe(false);
    expect(view.canWriteField('Main.block.value')).toBe(true);
    expect(new EditPolicyView({allowBinding: []}).canBindField('Main.block.input0')).toBe(false);
    expect(new EditPolicyView().canBindField('Main.block.value')).toBe(true);
  });

  it('lets allowBinding override property limits while retaining path and command limits', () => {
    const fieldLimits: EditPolicy[] = [
      {allowProps: []},
      {denyProps: ['value']},
      {allowProps: ['other'], denyProps: ['value']},
    ];
    for (const limits of fieldLimits) {
      expect(new EditPolicyView(limits).canBindField('Main.value')).toBe(false);
      const policy = {...limits, allowBinding: ['value']};
      const view = new EditPolicyView(policy);
      expect(view.canBindField('Main.value')).toBe(true);
      expect(view.canWriteField('Main.value')).toBe(false);
      expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main', data: {'~value': 'source'}})).toBeNull();
      expect(new EditPolicyView({...policy, denyPaths: ['Main.**']}).canBindField('Main.value')).toBe(false);
      expect(new EditPolicyView({...policy, denyCmds: ['bind']}).canBindField('Main.value')).toBe(false);
    }
  });

  it('checks bindings in pasted data and helper blocks', () => {
    const policy = {allowBinding: ['value']};
    expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main.a', data: {'~value': 'source'}})).toBeNull();
    expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main.a', data: {'~other': 'source'}})).toBe(
      'restricted binding'
    );
    expect(checkEditPolicy(policy, {cmd: 'addBlock', path: 'Main.a', data: {'#is': 'add', '~other': 'source'}})).toBe(
      'restricted binding'
    );
    expect(checkEditPolicy(policy, {cmd: 'addBlock', path: 'Main.a.~other', data: {'#is': 'add'}})).toBe(
      'restricted binding'
    );
    expect(checkEditPolicy(policy, {cmd: 'paste', path: 'Main.a', data: {'~other': {'#is': 'add'}}})).toBe(
      'restricted binding'
    );
  });
});

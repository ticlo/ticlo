import {Functions, PropDesc} from '../../src/core';

export const htmlAttributes: {[key: string]: PropDesc} = {
  // React-specific Attributes
  defaultChecked: {name: 'defaultChecked', type: 'toggle'},
  defaultValue: {name: 'defaultValue', type: 'any'}, // string | number | string[];
  suppressContentEditableWarning: {name: 'suppressContentEditableWarning', type: 'toggle'},
  suppressHydrationWarning: {name: 'suppressHydrationWarning', type: 'toggle'},

  // Standard HTML Attributes
  accessKey: {name: 'accessKey', type: 'string'},
  contentEditable: {name: 'contentEditable', type: 'toggle'}, // | "inherit";
  contextMenu: {name: 'contextMenu', type: 'string'},
  dir: {name: 'dir', type: 'string'},
  draggable: {name: 'draggable', type: 'toggle'},
  hidden: {name: 'hidden', type: 'toggle'},
  id: {name: 'id', type: 'string'},
  lang: {name: 'lang', type: 'string'},
  placeholder: {name: 'placeholder', type: 'string'},
  slot: {name: 'slot', type: 'string'},
  spellCheck: {name: 'spellCheck', type: 'toggle'},
  tabIndex: {name: 'tabIndex', type: 'number'},
  title: {name: 'title', type: 'string'},
  translate: {name: 'translate', type: 'radio-button', options: ['no', 'yes']},

  // Unknown
  radioGroup: {name: 'radioGroup', type: 'string'}, // <command>, <menuitem>

  // WAI-ARIA
  role: {name: 'role', type: 'string'},

  // RDFa Attributes
  about: {name: 'about', type: 'string'},
  datatype: {name: 'datatype', type: 'string'},
  inlist: {name: 'inlist', type: 'any'},
  prefix: {name: 'prefix', type: 'string'},
  property: {name: 'property', type: 'string'},
  resource: {name: 'resource', type: 'string'},
  typeof: {name: 'typeof', type: 'string'},
  vocab: {name: 'vocab', type: 'string'},

  // Non-standard Attributes
  autoCapitalize: {name: 'autoCapitalize', type: 'string'},
  autoCorrect: {name: 'autoCorrect', type: 'string'},
  autoSave: {name: 'autoSave', type: 'string'},
  color: {name: 'color', type: 'string'},
  itemProp: {name: 'itemProp', type: 'string'},
  itemScope: {name: 'itemScope', type: 'toggle'},
  itemType: {name: 'itemType', type: 'string'},
  itemID: {name: 'itemID', type: 'string'},
  itemRef: {name: 'itemRef', type: 'string'},
  results: {name: 'results', type: 'number'},
  security: {name: 'security', type: 'string'},
  unselectable: {name: 'unselectable', type: 'radio-button', options: ['off', 'on']},

  // Living Standard
  /**
   * Hints at the type of data that might be entered by the user while editing the element or its contents
   * @see https://html.spec.whatwg.org/multipage/interaction.html#input-modalities:-the-inputmode-attribute
   */
  inputMode: {
    name: 'inputMode',
    type: 'select',
    options: ['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']
  },
  /**
   * Specify that a standard HTML element should behave like a defined custom built-in element
   * @see https://html.spec.whatwg.org/multipage/custom-elements.html#attr-is
   */
  is: {name: 'is', type: 'string'}
};
export const htmlEventHandlers: {[key: string]: PropDesc} = {
  // Clipboard Events
  onCopy: {name: 'onCopy', type: 'object', readonly: true}, // ClipboardEvent
  onCopyCapture: {name: 'onCopyCapture', type: 'object', readonly: true}, // ClipboardEvent
  onCut: {name: 'onCut', type: 'object', readonly: true}, // ClipboardEvent
  onCutCapture: {name: 'onCutCapture', type: 'object', readonly: true}, // ClipboardEvent
  onPaste: {name: 'onPaste', type: 'object', readonly: true}, // ClipboardEvent
  onPasteCapture: {name: 'onPasteCapture', type: 'object', readonly: true}, // ClipboardEvent

  // Composition Events
  onCompositionEnd: {name: 'onCompositionEnd', type: 'object', readonly: true}, // CompositionEvent
  onCompositionEndCapture: {name: 'onCompositionEndCapture', type: 'object', readonly: true}, // CompositionEvent
  onCompositionStart: {name: 'onCompositionStart', type: 'object', readonly: true}, // CompositionEvent
  onCompositionStartCapture: {name: 'onCompositionStartCapture', type: 'object', readonly: true}, // CompositionEvent
  onCompositionUpdate: {name: 'onCompositionUpdate', type: 'object', readonly: true}, // CompositionEvent
  onCompositionUpdateCapture: {name: 'onCompositionUpdateCapture', type: 'object', readonly: true}, // CompositionEvent

  // Focus Events
  onFocus: {name: 'onFocus', type: 'object', readonly: true}, // FocusEvent
  onFocusCapture: {name: 'onFocusCapture', type: 'object', readonly: true}, // FocusEvent
  onBlur: {name: 'onBlur', type: 'object', readonly: true}, // FocusEvent
  onBlurCapture: {name: 'onBlurCapture', type: 'object', readonly: true}, // FocusEvent

  // Form Events
  onChange: {name: 'onChange', type: 'object', readonly: true}, // FormEvent
  onChangeCapture: {name: 'onChangeCapture', type: 'object', readonly: true}, // FormEvent
  onBeforeInput: {name: 'onBeforeInput', type: 'object', readonly: true}, // FormEvent
  onBeforeInputCapture: {name: 'onBeforeInputCapture', type: 'object', readonly: true}, // FormEvent
  onInput: {name: 'onInput', type: 'object', readonly: true}, // FormEvent
  onInputCapture: {name: 'onInputCapture', type: 'object', readonly: true}, // FormEvent
  onReset: {name: 'onReset', type: 'object', readonly: true}, // FormEvent
  onResetCapture: {name: 'onResetCapture', type: 'object', readonly: true}, // FormEvent
  onSubmit: {name: 'onSubmit', type: 'object', readonly: true}, // FormEvent
  onSubmitCapture: {name: 'onSubmitCapture', type: 'object', readonly: true}, // FormEvent
  onInvalid: {name: 'onInvalid', type: 'object', readonly: true}, // FormEvent
  onInvalidCapture: {name: 'onInvalidCapture', type: 'object', readonly: true}, // FormEvent

  // Image Events
  onLoad: {name: 'onLoad', type: 'object', readonly: true}, // ReactEvent
  onLoadCapture: {name: 'onLoadCapture', type: 'object', readonly: true}, // ReactEvent
  onError: {name: 'onError', type: 'object', readonly: true}, // ReactEvent // also a Media Event
  onErrorCapture: {name: 'onErrorCapture', type: 'object', readonly: true}, // ReactEvent // also a Media Event

  // Keyboard Events
  onKeyDown: {name: 'onKeyDown', type: 'object', readonly: true}, // KeyboardEvent
  onKeyDownCapture: {name: 'onKeyDownCapture', type: 'object', readonly: true}, // KeyboardEvent
  onKeyPress: {name: 'onKeyPress', type: 'object', readonly: true}, // KeyboardEvent
  onKeyPressCapture: {name: 'onKeyPressCapture', type: 'object', readonly: true}, // KeyboardEvent
  onKeyUp: {name: 'onKeyUp', type: 'object', readonly: true}, // KeyboardEvent
  onKeyUpCapture: {name: 'onKeyUpCapture', type: 'object', readonly: true}, // KeyboardEvent

  // Media Events
  onAbort: {name: 'onAbort', type: 'object', readonly: true}, // ReactEvent
  onAbortCapture: {name: 'onAbortCapture', type: 'object', readonly: true}, // ReactEvent
  onCanPlay: {name: 'onCanPlay', type: 'object', readonly: true}, // ReactEvent
  onCanPlayCapture: {name: 'onCanPlayCapture', type: 'object', readonly: true}, // ReactEvent
  onCanPlayThrough: {name: 'onCanPlayThrough', type: 'object', readonly: true}, // ReactEvent
  onCanPlayThroughCapture: {name: 'onCanPlayThroughCapture', type: 'object', readonly: true}, // ReactEvent
  onDurationChange: {name: 'onDurationChange', type: 'object', readonly: true}, // ReactEvent
  onDurationChangeCapture: {name: 'onDurationChangeCapture', type: 'object', readonly: true}, // ReactEvent
  onEmptied: {name: 'onEmptied', type: 'object', readonly: true}, // ReactEvent
  onEmptiedCapture: {name: 'onEmptiedCapture', type: 'object', readonly: true}, // ReactEvent
  onEncrypted: {name: 'onEncrypted', type: 'object', readonly: true}, // ReactEvent
  onEncryptedCapture: {name: 'onEncryptedCapture', type: 'object', readonly: true}, // ReactEvent
  onEnded: {name: 'onEnded', type: 'object', readonly: true}, // ReactEvent
  onEndedCapture: {name: 'onEndedCapture', type: 'object', readonly: true}, // ReactEvent
  onLoadedData: {name: 'onLoadedData', type: 'object', readonly: true}, // ReactEvent
  onLoadedDataCapture: {name: 'onLoadedDataCapture', type: 'object', readonly: true}, // ReactEvent
  onLoadedMetadata: {name: 'onLoadedMetadata', type: 'object', readonly: true}, // ReactEvent
  onLoadedMetadataCapture: {name: 'onLoadedMetadataCapture', type: 'object', readonly: true}, // ReactEvent
  onLoadStart: {name: 'onLoadStart', type: 'object', readonly: true}, // ReactEvent
  onLoadStartCapture: {name: 'onLoadStartCapture', type: 'object', readonly: true}, // ReactEvent
  onPause: {name: 'onPause', type: 'object', readonly: true}, // ReactEvent
  onPauseCapture: {name: 'onPauseCapture', type: 'object', readonly: true}, // ReactEvent
  onPlay: {name: 'onPlay', type: 'object', readonly: true}, // ReactEvent
  onPlayCapture: {name: 'onPlayCapture', type: 'object', readonly: true}, // ReactEvent
  onPlaying: {name: 'onPlaying', type: 'object', readonly: true}, // ReactEvent
  onPlayingCapture: {name: 'onPlayingCapture', type: 'object', readonly: true}, // ReactEvent
  onProgress: {name: 'onProgress', type: 'object', readonly: true}, // ReactEvent
  onProgressCapture: {name: 'onProgressCapture', type: 'object', readonly: true}, // ReactEvent
  onRateChange: {name: 'onRateChange', type: 'object', readonly: true}, // ReactEvent
  onRateChangeCapture: {name: 'onRateChangeCapture', type: 'object', readonly: true}, // ReactEvent
  onSeeked: {name: 'onSeeked', type: 'object', readonly: true}, // ReactEvent
  onSeekedCapture: {name: 'onSeekedCapture', type: 'object', readonly: true}, // ReactEvent
  onSeeking: {name: 'onSeeking', type: 'object', readonly: true}, // ReactEvent
  onSeekingCapture: {name: 'onSeekingCapture', type: 'object', readonly: true}, // ReactEvent
  onStalled: {name: 'onStalled', type: 'object', readonly: true}, // ReactEvent
  onStalledCapture: {name: 'onStalledCapture', type: 'object', readonly: true}, // ReactEvent
  onSuspend: {name: 'onSuspend', type: 'object', readonly: true}, // ReactEvent
  onSuspendCapture: {name: 'onSuspendCapture', type: 'object', readonly: true}, // ReactEvent
  onTimeUpdate: {name: 'onTimeUpdate', type: 'object', readonly: true}, // ReactEvent
  onTimeUpdateCapture: {name: 'onTimeUpdateCapture', type: 'object', readonly: true}, // ReactEvent
  onVolumeChange: {name: 'onVolumeChange', type: 'object', readonly: true}, // ReactEvent
  onVolumeChangeCapture: {name: 'onVolumeChangeCapture', type: 'object', readonly: true}, // ReactEvent
  onWaiting: {name: 'onWaiting', type: 'object', readonly: true}, // ReactEvent
  onWaitingCapture: {name: 'onWaitingCapture', type: 'object', readonly: true}, // ReactEvent

  // MouseEvents
  onAuxClick: {name: 'onAuxClick', type: 'object', readonly: true}, // MouseEvent
  onAuxClickCapture: {name: 'onAuxClickCapture', type: 'object', readonly: true}, // MouseEvent
  onClick: {name: 'onClick', type: 'object', readonly: true}, // MouseEvent
  onClickCapture: {name: 'onClickCapture', type: 'object', readonly: true}, // MouseEvent
  onContextMenu: {name: 'onContextMenu', type: 'object', readonly: true}, // MouseEvent
  onContextMenuCapture: {name: 'onContextMenuCapture', type: 'object', readonly: true}, // MouseEvent
  onDoubleClick: {name: 'onDoubleClick', type: 'object', readonly: true}, // MouseEvent
  onDoubleClickCapture: {name: 'onDoubleClickCapture', type: 'object', readonly: true}, // MouseEvent
  onDrag: {name: 'onDrag', type: 'object', readonly: true}, // DragEvent
  onDragCapture: {name: 'onDragCapture', type: 'object', readonly: true}, // DragEvent
  onDragEnd: {name: 'onDragEnd', type: 'object', readonly: true}, // DragEvent
  onDragEndCapture: {name: 'onDragEndCapture', type: 'object', readonly: true}, // DragEvent
  onDragEnter: {name: 'onDragEnter', type: 'object', readonly: true}, // DragEvent
  onDragEnterCapture: {name: 'onDragEnterCapture', type: 'object', readonly: true}, // DragEvent
  onDragExit: {name: 'onDragExit', type: 'object', readonly: true}, // DragEvent
  onDragExitCapture: {name: 'onDragExitCapture', type: 'object', readonly: true}, // DragEvent
  onDragLeave: {name: 'onDragLeave', type: 'object', readonly: true}, // DragEvent
  onDragLeaveCapture: {name: 'onDragLeaveCapture', type: 'object', readonly: true}, // DragEvent
  onDragOver: {name: 'onDragOver', type: 'object', readonly: true}, // DragEvent
  onDragOverCapture: {name: 'onDragOverCapture', type: 'object', readonly: true}, // DragEvent
  onDragStart: {name: 'onDragStart', type: 'object', readonly: true}, // DragEvent
  onDragStartCapture: {name: 'onDragStartCapture', type: 'object', readonly: true}, // DragEvent
  onDrop: {name: 'onDrop', type: 'object', readonly: true}, // DragEvent
  onDropCapture: {name: 'onDropCapture', type: 'object', readonly: true}, // DragEvent
  onMouseDown: {name: 'onMouseDown', type: 'object', readonly: true}, // MouseEvent
  onMouseDownCapture: {name: 'onMouseDownCapture', type: 'object', readonly: true}, // MouseEvent
  onMouseEnter: {name: 'onMouseEnter', type: 'object', readonly: true}, // MouseEvent
  onMouseLeave: {name: 'onMouseLeave', type: 'object', readonly: true}, // MouseEvent
  onMouseMove: {name: 'onMouseMove', type: 'object', readonly: true}, // MouseEvent
  onMouseMoveCapture: {name: 'onMouseMoveCapture', type: 'object', readonly: true}, // MouseEvent
  onMouseOut: {name: 'onMouseOut', type: 'object', readonly: true}, // MouseEvent
  onMouseOutCapture: {name: 'onMouseOutCapture', type: 'object', readonly: true}, // MouseEvent
  onMouseOver: {name: 'onMouseOver', type: 'object', readonly: true}, // MouseEvent
  onMouseOverCapture: {name: 'onMouseOverCapture', type: 'object', readonly: true}, // MouseEvent
  onMouseUp: {name: 'onMouseUp', type: 'object', readonly: true}, // MouseEvent
  onMouseUpCapture: {name: 'onMouseUpCapture', type: 'object', readonly: true}, // MouseEvent

  // Selection Events
  onSelect: {name: 'onSelect', type: 'object', readonly: true}, // ReactEvent
  onSelectCapture: {name: 'onSelectCapture', type: 'object', readonly: true}, // ReactEvent

  // Touch Events
  onTouchCancel: {name: 'onTouchCancel', type: 'object', readonly: true}, // TouchEvent
  onTouchCancelCapture: {name: 'onTouchCancelCapture', type: 'object', readonly: true}, // TouchEvent
  onTouchEnd: {name: 'onTouchEnd', type: 'object', readonly: true}, // TouchEvent
  onTouchEndCapture: {name: 'onTouchEndCapture', type: 'object', readonly: true}, // TouchEvent
  onTouchMove: {name: 'onTouchMove', type: 'object', readonly: true}, // TouchEvent
  onTouchMoveCapture: {name: 'onTouchMoveCapture', type: 'object', readonly: true}, // TouchEvent
  onTouchStart: {name: 'onTouchStart', type: 'object', readonly: true}, // TouchEvent
  onTouchStartCapture: {name: 'onTouchStartCapture', type: 'object', readonly: true}, // TouchEvent

  // Pointer Events
  onPointerDown: {name: 'onPointerDown', type: 'object', readonly: true}, // PointerEvent
  onPointerDownCapture: {name: 'onPointerDownCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerMove: {name: 'onPointerMove', type: 'object', readonly: true}, // PointerEvent
  onPointerMoveCapture: {name: 'onPointerMoveCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerUp: {name: 'onPointerUp', type: 'object', readonly: true}, // PointerEvent
  onPointerUpCapture: {name: 'onPointerUpCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerCancel: {name: 'onPointerCancel', type: 'object', readonly: true}, // PointerEvent
  onPointerCancelCapture: {name: 'onPointerCancelCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerEnter: {name: 'onPointerEnter', type: 'object', readonly: true}, // PointerEvent
  onPointerEnterCapture: {name: 'onPointerEnterCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerLeave: {name: 'onPointerLeave', type: 'object', readonly: true}, // PointerEvent
  onPointerLeaveCapture: {name: 'onPointerLeaveCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerOver: {name: 'onPointerOver', type: 'object', readonly: true}, // PointerEvent
  onPointerOverCapture: {name: 'onPointerOverCapture', type: 'object', readonly: true}, // PointerEvent
  onPointerOut: {name: 'onPointerOut', type: 'object', readonly: true}, // PointerEvent
  onPointerOutCapture: {name: 'onPointerOutCapture', type: 'object', readonly: true}, // PointerEvent
  onGotPointerCapture: {name: 'onGotPointerCapture', type: 'object', readonly: true}, // PointerEvent
  onGotPointerCaptureCapture: {name: 'onGotPointerCaptureCapture', type: 'object', readonly: true}, // PointerEvent
  onLostPointerCapture: {name: 'onLostPointerCapture', type: 'object', readonly: true}, // PointerEvent
  onLostPointerCaptureCapture: {name: 'onLostPointerCaptureCapture', type: 'object', readonly: true}, // PointerEvent

  // UI Events
  onScroll: {name: 'onScroll', type: 'object', readonly: true}, // UIEvent
  onScrollCapture: {name: 'onScrollCapture', type: 'object', readonly: true}, // UIEvent

  // Wheel Events
  onWheel: {name: 'onWheel', type: 'object', readonly: true}, // WheelEvent
  onWheelCapture: {name: 'onWheelCapture', type: 'object', readonly: true}, // WheelEvent

  // Animation Events
  onAnimationStart: {name: 'onAnimationStart', type: 'object', readonly: true}, // AnimationEvent
  onAnimationStartCapture: {name: 'onAnimationStartCapture', type: 'object', readonly: true}, // AnimationEvent
  onAnimationEnd: {name: 'onAnimationEnd', type: 'object', readonly: true}, // AnimationEvent
  onAnimationEndCapture: {name: 'onAnimationEndCapture', type: 'object', readonly: true}, // AnimationEvent
  onAnimationIteration: {name: 'onAnimationIteration', type: 'object', readonly: true}, // AnimationEvent
  onAnimationIterationCapture: {name: 'onAnimationIterationCapture', type: 'object', readonly: true}, // AnimationEvent

  // Transition Events
  onTransitionEnd: {name: 'onTransitionEnd', type: 'object', readonly: true}, // TransitionEvent
  onTransitionEndCapture: {name: 'onTransitionEndCapture', type: 'object', readonly: true}, // TransitionEvent

  // ref callback has similar behavior as event handlers
  ref: {name: 'ref', type: 'object', readonly: true}
};

export const optionalHtmlProperties: {[key: string]: PropDesc} = {
  ...htmlAttributes,
  ...htmlEventHandlers
};
Functions.add(
  null,
  {
    name: 'element',
    src: 'base',
    properties: [],
    optional: optionalHtmlProperties
  },
  'react'
);

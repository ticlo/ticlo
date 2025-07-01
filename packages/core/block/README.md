### Block  

- Collection of key-value pairs (**Properties**) 
- An optional **Function** can be attached to Block, based on its #is value 
- Keeps track of bindings relative to this block 

### Property 

- Store current value and saved value (property._value and property._saved)
- value can be a child **Block**, thus create a tree structure of **Block**s
- Saved value will be saved in during save/load 
  - for manual value change: _saved === _value
  - for runtime change from Function: _saved === undefined, _value != _saved 
- Dispatch change event 

### Function

- a function attached to **Block**
- native functions are compiled in js code
- custom functions are defined in a **Flow**

### Flow (extends Block)
- **Flow** is the entry point of save load
  - it saves everything in the tree, but skips children **Flow**s
- **Flow** handles history, (undo / redo)

### Block Config (extends Property)
- **Config**'s name always starts with **#**
- **Config**s are used to keep general properties that are required by the **Block** no matter what the function is.
- **Config** can also be used as function parameter if the function supports dynamic parameters. so it defines properties as configs to avoid any potential conflict with the dynamic parameter names.
#### Examples:
  - **#is**: ID of the **Function**
  - **#output**: main output of the **Function**
  - **#priority**: used to override the default priority of the **Function**

### Block Attribute (extends Property)
- **Attribute**'s name always starts with **@**
- **Attribute**'s are only for editing purpose. At runtime, dataflow logic and UI component should still work the same way with or without **Attributes**.
#### Examples:
  - **@b-xyw**: x, y, width of a **Block**
  - **@b-p**: a list of properties to be displayed directly in block view on the stage
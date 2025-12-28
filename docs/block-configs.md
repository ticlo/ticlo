## Basic Configs

### #is

**type**: string | object
`#is` define the function that will be attached to the block.

- When value is string, it is the global function name.
- When value is object, it will be deserialized as a child block in the `#func` config

### #mode

**type**: 'auto' | 'onLoad' | 'onChange' | 'onCall' | 'disabled'

**Block Modes:**

|                       | onLoad | onChange | onCall | disabled |
| :-------------------: | :----: | :------: | :----: | :------: |
|  #call is triggered   |   ✔️   |    ✔️    |   ✔️   |    -     |
|   input is changed    |   ✔️   |    ✔️    |   -    |    -     |
| block is deserialized |   ✔️   |    -     |   -    |    -     |
| duplicated sync call  |   -    |    ✔️    |   ✔️   |    -     |

- By default, block mode is 'auto', which means using the default mode from the block function. you can override block mode by changing the `#mode` config value
- If `#call` is triggered when block `#sync`=**true**. The block will only run with there is no

### #sync

**type**: boolean

- When `#sync`=**true**, the block will be run as soon as `#call` is changed, before any other property change or block queue taking effect

### #call

**type**: trigger

Queue the block in the resolver to run it asynchronously, or run it instantly when `#sync`=**true**

- Changing `#call` to **null** or **undefined** will be ignored
- Event can directly `#call` a block when it just gets dispatched. But if it's stored in a property and being set to #call later, the block will ignore it.

### #custom

**type**: list of property descriptor

A list of additional property definition that will show in the property list

### #optional

**type** list of string

### #func

**type**: Block

A temporary block maintained by the block function, block will always destroy the #func block when function changed

### #wait

**type**: boolean
indicate when the worker's task is finished and the output data is ready

in MapObject and MapStream function, the #waiting config is used to determine if the current worker is ready and can be destroyed/reused

## Worker Configs

these configs are only used in worker related functions

### #input

**type**: any
the input data of the worker

### #output

**type**: any
the output data of the worker

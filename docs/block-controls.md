## #is
**type**: string | object
`#is` define the function that will be attached to the block.
* When value is string, it is the global function name.
* When value is object, it will be deserialized as a child block in the `#func` control

## #mode
**type**: 'always' | 'onChange' | 'onCall' | 'disabled' | null

### Block Mode

| | always | onChange | onCall | disabled |
| :---: | :---: | :---: | :---: | :---: |
|#call is triggered|✔️|✔️|✔️|-|
|input is changed|✔️|✔️|-|-|
|block is deserialized|✔️|-|-|-|

* By default, block mode is defined in the block function. you can override block mode by changing the `#mode` control value


## #sync
**type**: boolean

* When `#sync`=**true**, the block will be run as soon as `#call` is changed, before any other property change or block queue taking effect


## #call
**type**: any

Queue the block in the resolver to run it asynchronously, or run it instantly when `#sync`=**true**

* Changing `#call` to **null** or **undefined** will be ignored
* Event can directly `#call` a block when it just gets dispatched. But if it's stored in a property and being set to #call later, the block will ignore it.


## #func
**type**: Block

A temporary block maintained by the block function, block will always destroy the #func block when function changed
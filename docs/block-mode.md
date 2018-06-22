
## #mode

### Block Mode

|| always | onChange|onCall | disabled |
|:---:|:---:|:---:|:---:|:---:|:---:|
|#call is triggered|✔️|✔️|✔️|❌|
|input is changed|✔️|✔️|❌|❌|
|block is deserialized<br>or liveupdated|✔️|❌|❌|❌|

* by default, #mode is defined in the block function. you can override block mode by changing the `#mode` control value

## #sync

* when `#mode` is `sync`, the block will be run as soon as `#call` changed, before any other property change or block queue taking effect
  * `sync` mode must be explicitly defined in the block's `#mode` control value, it can not be defined inside function.
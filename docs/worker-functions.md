# Multi-worker

`multi-worker` maintains one live worker per input key. Replacing an object or
array reuses workers with matching keys, updates their inputs, and destroys
workers whose keys disappear. Changing `use` rebuilds the workers.

Arrays use their indices as keys by default. Set the optional `key` property to
an item property name, such as `id`, to reuse workers by that property's value.
The output remains an array in input order, including after reordering items.
Object and Block inputs continue to use their own property names as worker keys.

Item keys must be strings or numbers; numbers are converted to strings. Items
without a valid key are omitted from the output. Duplicate keys produce at most
one output item; which duplicate is selected is unspecified. Clearing `key`
restores index-based reuse.

Object and array changes require a new input reference. Block inputs also watch
child property changes.

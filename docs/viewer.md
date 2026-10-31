# Viewer page

`viewer.html` renders the `#main` React component of one flow without designer
controls. `designer.html` accepts the same `path` URL parameter:

```text
viewer.html#host=http://127.0.0.1:8010/file&path=main/entry
designer.html#host=http://127.0.0.1:8010/file&path=main/entry
```

`path` names the namespace and flow. Further `/` segments name nested flow
folders, for example `path=main/jobs/daily`. Use `#root` for the root namespace.
Omit `host` to use the bundled static storage. Startup selects only the named
ordinary flow; its namespace context, dependency contexts, and Service Libraries
also load according to the [runtime lifecycle](runtime-lifecycle.md). The root
global settings are read first.

In the viewer's JavaScript console, call `openFlowEditor()` to open the current
flow in a separate editor window.

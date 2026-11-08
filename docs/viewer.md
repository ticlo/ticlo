# Viewer page

`viewer.html` renders the `#main` React component of one flow without designer
controls. `designer.html` accepts the same `path` URL parameter:

```text
viewer.html?host=http://127.0.0.1:8010/file&path=main/entry
designer.html?host=http://127.0.0.1:8010/file&path=main/entry
```

`path` names the library and flow. Further `/` segments name nested flow
folders, for example `path=main/jobs/daily`. Use `%23root` for the root library
in a query URL.
Omit `host` to use the bundled static storage. Startup selects only the named
ordinary flow; its library context, dependency contexts, and auto-load modules
also load according to the [runtime lifecycle](runtime-lifecycle.md). The root
global settings are read first.

URL parameters are read at startup. The app updates them with
`history.replaceState`, without loading flows, reloading the page, or adding
browser history entries.

In the viewer's JavaScript console, call `openFlowEditor()` to open the current
flow in a separate editor window.

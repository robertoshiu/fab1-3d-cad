# FAB-1 interactive digital twin

[Open the 3D tour](https://robertoshiu.github.io/fab1-3d-cad/)

A six-stop guided tour and free exploration of a semiconductor facility, exported from the final Blender model. Includes B1, 1F, 2F and roof equipment, piping, searchable source IDs, floor separation and device-adaptive display quality.

## Development

```sh
cd web
npm ci
npm run dev
```

Node.js 22.12+ is required. `npm run build` produces `web/dist`.

Pushes to `main` build and deploy automatically using GitHub Actions and GitHub Pages.

See [the project documentation](web/README.md) for operation, data provenance and limitations. Third-party license notices are preserved under `web/public/licenses`.

This is a design visualization without live telemetry or verified as-built status.

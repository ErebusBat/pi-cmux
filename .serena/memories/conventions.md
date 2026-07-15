# Conventions

- TypeScript compile policy is strict and explicitly NodeNext-compatible; retain the package script’s module and module-resolution settings when adjusting compiler compatibility.
- Extension sources are typechecked as `extensions/*.ts` with `--noEmit` and `--skipLibCheck`.
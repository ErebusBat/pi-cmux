# Tech stack

- TypeScript 5.9.3; ESM package (`"type": "module"`).
- Pi coding-agent package is both peer dependency and pinned dev dependency (0.75.5).
- Typechecking is command-line `tsc`, configured in package scripts rather than a tsconfig: NodeNext module and resolution, strict mode, ES2024 target, no emit.
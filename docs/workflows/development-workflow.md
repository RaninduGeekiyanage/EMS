# End-to-End Development Workflow

1. Check `docs/tasks/MASTER_TASK_LIST.md` for active module and sprint.
2. Open active module `TASKS.md` and mark candidate task as `[/]`.
3. Consult `docs/rules/READ_ORDER.md` to identify prerequisite spec files.
4. Implement Migration -> Model -> Repository -> Service -> Controller -> Inertia View.
5. Write unit and feature tests under `tests/`.
6. Run `php artisan test` and ensure all suites pass.
7. Mark task as `[x]` and update `docs/tasks/MASTER_TASK_LIST.md`.

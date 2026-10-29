# CI on GitHub Actions (GitLab mirror)

GitLab (`git.fsoft-academy.edu.vn`) stays the main repository. A GitLab **push mirror** copies
every branch to a private GitHub repository, where [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs on GitHub's hosted runners, so no team machine has to stay on.

> Ask the mentor first whether the code may be copied to a private GitHub repository.

| Job | Runs on | What it does |
|-----|---------|--------------|
| `lint` | every push and pull request | `npm run lint` (ESLint) |
| `typecheck` | every push and pull request | `npm run typecheck` (`tsc -b`) |
| `build` | after both pass | `npm run build`; `dist/` kept as an artifact for 7 days |

There is no deploy job yet, as in the GitLab pipeline. `tests/parking` is not run: its two
tests need updating for the required lot model template first.

## One-time setup

The steps are the same as for the backend; the full guide is `docs/GITHUB-ACTIONS.md` in the
backend repository.

1. Create an **empty, private** GitHub repository, e.g. `pms-frontend`.
2. Use a fine-grained token with **Contents** and **Workflows: Read and write** on the mirror
   repositories (the backend's token can cover both).
3. GitLab project → **Settings → Repository → Mirroring repositories**: URL
   `https://github.com/<owner>/pms-frontend.git`, direction **Push**, Username and Password
   (GitHub user name + token), **Mirror only protected branches** unticked.
4. Optional: GitHub repo → Settings → Secrets and variables → Actions → Variables:
   `VITE_API_BASE_URL` = the deployed API (e.g. `https://<app>.azurewebsites.net/api`).
   Without it the build uses `https://localhost:44391/api`, like the GitLab pipeline.

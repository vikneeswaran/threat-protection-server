# Rollback Pack Template

Prepare one rollback pack for every QA and production release.

## 1) Release Metadata

- Release version:
- Release date/time (UTC):
- Commit SHA:
- Release owner:

## 2) Deployment Artifacts

- Current deployment URL:
- Previous stable deployment URL:
- Installer versions (Windows/macOS/Linux):

## 3) Config Snapshot

- Environment variable diff checked: Yes / No
- Feature flags changed:
- External integrations changed:

## 4) Database Change Set

- Migration files included:
- Roll-forward script included: Yes / No
- Rollback script included (if safe): Yes / No
- Data impact assessment completed: Yes / No

## 5) Validation Before Release

- [ ] Lint/type-check/tests passed
- [ ] Benchmark report attached
- [ ] QA sign-off attached

## 6) Rollback Procedure for This Release

1. Revert deployment to: _[previous stable build]_
2. Disable/roll back installer artifacts to: _[stable installer version]_
3. Apply DB forward-fix/restore plan: _[link]_ 
4. Run validation checklist and confirm stability.

## 7) Contacts

- Engineering on-call:
- QA on-call:
- Platform/DevOps:
- Product owner:

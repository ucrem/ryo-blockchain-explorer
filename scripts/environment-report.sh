#!/usr/bin/env bash
# Read-only diagnostics; missing optional tools do not abort the report.
set -u
for task_tool in uname lsb_release gcc clang cmake git node npm docker gh; do
    if command -v "$task_tool" >/dev/null 2>&1; then
        case "$task_tool" in
            uname) uname -a ;;
            lsb_release) lsb_release -a ;;
            *) "$task_tool" --version ;;
        esac
    else
        printf '%s: missing\n' "$task_tool"
    fi
done
printf '\nGit workspace\n'
pwd
if git rev-parse --git-dir >/dev/null 2>&1; then
    git status --short --branch
    git remote -v
    git log --oneline -10
    git rev-parse --is-shallow-repository
    git rev-list --count HEAD
else
    printf 'No Git repository in this directory.\n'
fi
if command -v gh >/dev/null 2>&1; then
    printf '\nGitHub authentication\n'
    gh api user --jq .login || printf 'GitHub CLI authentication unavailable.\n'
fi

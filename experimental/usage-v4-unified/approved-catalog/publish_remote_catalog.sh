#!/usr/bin/env bash
# Trusted private publisher. Builds a release proposal in a LOCAL QBank clone.
# It does not push or modify main; the workflow may open a PR after all gates pass.
set -euo pipefail
if [[ $# != 4 ]]; then echo 'usage: publish_remote_catalog.sh <qbank clone> <deployment manifest> <output directory> <base commit>' >&2; exit 2; fi
runtime="$(realpath "$1")"; manifest="$(realpath "$2")"; out="$(realpath -m "$3")"; base="$4"
here="$(cd "$(dirname "$0")" && pwd)"
[[ "$base" =~ ^[0-9a-f]{40}$ ]]
[[ "$(git -C "$runtime" rev-parse HEAD)" == "$base" ]]
[[ -z "$(git -C "$runtime" status --porcelain)" ]]
[[ ! -e "$out" ]]; mkdir -p "$out"
source="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1]));if(!/^[a-f0-9]{40}$/.test(j.sourceCommit)||j.schemaVersion!=="hoja-game-runtime-packages-v1")process.exit(1);console.log(j.sourceCommit)' "$runtime/game-runtime/approved-packages/v1/INDEX.json")"
git -C "$runtime" merge-base --is-ancestor "$source" "$base"
git -C "$runtime" diff --exit-code "$source" "$base" -- approved
# The manifest must explicitly bind to the exact approved source snapshot.
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));if(j.sourceCommit!==process.argv[2])throw Error("DEPLOYMENT_SOURCE_COMMIT_MISMATCH");if(!j.deploymentId.startsWith("HOJA15-")||/PENDING|DRAFT|SYNTHETIC|TEST_ONLY/i.test(j.deploymentId))throw Error("RELEASE_MANIFEST_REQUIRED")' "$manifest" "$source"
sourceDir="$out/source"; contentDir="$out/content"
contentCommit="$(git -C "$runtime" log -1 --format=%H "$base" -- game-runtime/approved-packages/v1)"
[[ "$contentCommit" =~ ^[0-9a-f]{40}$ ]]
git -C "$runtime" merge-base --is-ancestor "$source" "$contentCommit"
git -C "$runtime" diff --exit-code "$contentCommit" "$base" -- game-runtime/approved-packages/v1
trap 'git -C "$runtime" worktree remove --force "$sourceDir" >/dev/null 2>&1 || true; git -C "$runtime" worktree remove --force "$contentDir" >/dev/null 2>&1 || true' EXIT
git -C "$runtime" worktree add --detach "$sourceDir" "$source"
git -C "$runtime" worktree add --detach "$contentDir" "$contentCommit"
node "$here/build_approved_index.mjs" --qbank "$sourceDir"
node "$here/build_content_packages.mjs" --qbank "$sourceDir"
index="$here/generated/approved-source-index.json"; report="$here/generated/approved-content-report.json"
node "$here/build_remote_active_catalog.mjs" --index "$index" --deployment "$manifest" --report "$report" --runtime "$contentDir" --content-commit "$contentCommit" --out "$out/catalog.json"
dir=game-runtime/active/v1
mkdir -p "$runtime/$dir"
# Avoid generation bumps for a completely unchanged verified output. The current
# catalogCommit need not be the previous content commit; it is a separate pin.
if [[ -f "$runtime/$dir/current.json" ]]; then
  old="$(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1]));if(!/^[a-f0-9]{40}$/.test(p.catalogCommit)||!(/^[a-f0-9]{64}$/).test(p.catalogSha256))throw Error("PREVIOUS_POINTER_INVALID");console.log(p.catalogCommit)' "$runtime/$dir/current.json")"
  git -C "$runtime" show "$old:$dir/catalog.json" > "$out/previous.json"
  node -e 'const fs=require("fs"),crypto=require("crypto");const p=JSON.parse(fs.readFileSync(process.argv[1]));if(crypto.createHash("sha256").update(fs.readFileSync(process.argv[2])).digest("hex")!==p.catalogSha256)throw Error("PREVIOUS_POINTER_DIGEST")' "$runtime/$dir/current.json" "$out/previous.json"
  if cmp -s "$out/previous.json" "$out/catalog.json"; then echo NO_CHANGE; exit 0; fi
fi
cp "$out/catalog.json" "$runtime/$dir/catalog.json"
git -C "$runtime" add -- "$dir/catalog.json"
if ! git -C "$runtime" diff --cached --quiet -- "$dir/catalog.json"; then
  git -C "$runtime" commit -m "Prepare verified HOJA active catalog" -- "$dir/catalog.json"
fi
catalogCommit="$(git -C "$runtime" rev-parse HEAD)"
extra=(); if [[ ! -f "$runtime/$dir/current.json" ]]; then extra+=(--bootstrap); fi
node "$here/prepare_remote_pointer.mjs" --runtime "$runtime" --base-commit "$base" --content-commit "$contentCommit" --catalog-commit "$catalogCommit" --index "$index" --deployment "$manifest" --report "$report" --out "$out/current.json" "${extra[@]}"
cp "$out/current.json" "$runtime/$dir/current.json"
git -C "$runtime" add -- "$dir/current.json"
git -C "$runtime" commit -m "Propose verified HOJA catalog generation" -- "$dir/current.json"
# The intermediate pinned catalog commit MUST remain reachable (merge commit,
# no squash/rebase). Only the two metadata files may differ from the base.
[[ "$(git -C "$runtime" diff --name-only "$base" HEAD)" == "$dir/catalog.json"$'\n'"$dir/current.json" || "$(git -C "$runtime" diff --name-only "$base" HEAD)" == "$dir/current.json" ]]
git -C "$runtime" merge-base --is-ancestor "$catalogCommit" HEAD
echo "PREPARED_LOCAL_ONLY $(git -C "$runtime" rev-parse HEAD)"

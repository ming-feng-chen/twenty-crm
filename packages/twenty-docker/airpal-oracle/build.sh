#!/usr/bin/env bash
# Builds the CRM image on the VM from a source tarball made with `git archive`.
# Usage: build.sh <source.tar.gz> <app-version>
set -euo pipefail

source_archive=$1
app_version=$2
tag=$(basename "$source_archive" .tar.gz)

rm -rf /opt/airpal/src
mkdir -p /opt/airpal/src
tar -xzf "$source_archive" -C /opt/airpal/src

dockerfile=/opt/airpal/src/packages/twenty-docker/twenty/Dockerfile

# On 2 OCPUs the parallel server and front stages starve lingui's worker pool
# (init timeout), so build the heavy stages one at a time.
for stage in twenty-server-build twenty-front-build; do
  docker buildx build --target "$stage" -f "$dockerfile" /opt/airpal/src
done

docker buildx build \
  --load \
  --target twenty \
  --build-arg APP_VERSION="$app_version" \
  -f /opt/airpal/src/packages/twenty-docker/twenty/Dockerfile \
  -t "airpal-twenty:$tag" \
  -t airpal-twenty:current \
  /opt/airpal/src

echo "Built airpal-twenty:$tag"

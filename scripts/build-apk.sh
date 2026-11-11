#!/bin/sh
# Builds dist/luci-app-wanorder-<version>-r<release>.apk with Alpine's apk-tools 3 (Docker)
set -eu
cd "$(dirname "$0")/.."

P=luci-app-wanorder
VER=$(sed -n 's/^PKG_VERSION:=//p' "$P/Makefile")
REL=$(sed -n 's/^PKG_RELEASE:=//p' "$P/Makefile")
[ -n "$VER" ] && [ -n "$REL" ] || { echo "cannot read version from $P/Makefile"; exit 1; }
OUT="luci-app-wanorder-${VER}-r${REL}.apk"

rm -rf stage
mkdir -p stage/www dist
cp -r "$P/root/." stage/
cp -r "$P/htdocs/." stage/www/
chmod +x stage/usr/bin/wan-order stage/usr/bin/wan-watchdog stage/etc/init.d/wan-watchdog
chmod +x packaging/apk/post-install packaging/apk/pre-deinstall

docker run --rm \
	-e VER="$VER" -e REL="$REL" -e OUT="$OUT" \
	-e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
	-v "$PWD":/work -w /work alpine:edge sh -c '
	set -e
	apk add --no-cache apk-tools >/dev/null
	chown -R 0:0 /work/stage
	apk mkpkg \
		--info "name:luci-app-wanorder" \
		--info "version:${VER}-r${REL}" \
		--info "description:WAN Order: WAN priority manager with failover watchdog" \
		--info "arch:noarch" \
		--info "license:MIT" \
		--info "depends:luci-base jsonfilter" \
		--script "post-install:/work/packaging/apk/post-install" \
		--script "pre-deinstall:/work/packaging/apk/pre-deinstall" \
		--files /work/stage \
		--output "/work/dist/$OUT"
	apk adbdump "/work/dist/$OUT" | head -n 40 || true
	chown -R "$HOST_UID:$HOST_GID" /work/stage /work/dist
'

rm -rf stage
ls -l "dist/$OUT"
# END-OF-SCRIPT

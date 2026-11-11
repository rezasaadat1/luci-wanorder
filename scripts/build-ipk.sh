#!/bin/sh
# Builds dist/luci-app-wanorder_<version>-<release>_all.ipk for opkg-based OpenWrt
set -eu
cd "$(dirname "$0")/.."

P=luci-app-wanorder
VER=$(sed -n 's/^PKG_VERSION:=//p' "$P/Makefile")
REL=$(sed -n 's/^PKG_RELEASE:=//p' "$P/Makefile")
[ -n "$VER" ] && [ -n "$REL" ] || { echo "cannot read version from $P/Makefile"; exit 1; }
OUT="luci-app-wanorder_${VER}-${REL}_all.ipk"

W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/data/www" "$W/control" dist

cp -r "$P/root/." "$W/data/"
cp -r "$P/htdocs/." "$W/data/www/"
chmod +x "$W/data/usr/bin/wan-order" "$W/data/usr/bin/wan-watchdog" "$W/data/etc/init.d/wan-watchdog"

SIZE=$(du -sk "$W/data" | cut -f1)

cat > "$W/control/control" <<EOF_CTRL
Package: luci-app-wanorder
Version: ${VER}-${REL}
Depends: luci-base, jsonfilter
Source: https://github.com/${GITHUB_REPOSITORY:-local/luci-app-wanorder}
Section: luci
Architecture: all
Installed-Size: ${SIZE}
Description: WAN Order: WAN priority manager with failover watchdog
EOF_CTRL

echo "/etc/config/wanorder" > "$W/control/conffiles"

cat > "$W/control/postinst" <<'EOF_PI'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || /usr/bin/wan-order postinstall >/dev/null 2>&1
exit 0
EOF_PI

cat > "$W/control/prerm" <<'EOF_PR'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	/etc/init.d/wan-watchdog stop 2>/dev/null
	/etc/init.d/wan-watchdog disable 2>/dev/null
}
exit 0
EOF_PR
chmod +x "$W/control/postinst" "$W/control/prerm"

TAROPT="--owner=0 --group=0 --numeric-owner"
tar -C "$W/control" $TAROPT -czf "$W/control.tar.gz" .
tar -C "$W/data" $TAROPT -czf "$W/data.tar.gz" .
echo "2.0" > "$W/debian-binary"
tar -C "$W" $TAROPT -czf "dist/$OUT" ./debian-binary ./data.tar.gz ./control.tar.gz

ls -l "dist/$OUT"
# END-OF-SCRIPT

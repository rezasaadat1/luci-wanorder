# luci-app-wanorder

WAN priority manager for OpenWrt with a LuCI page (**Network → WAN Order**) and a
failover watchdog. Priority is set through interface metrics, so it needs no mwan3.

- Reorder, add, remove, enable and disable WAN interfaces from the page
- Optional timed revert to the default order
- Watchdog: promotes the next working WAN when the primary has no internet for a set time
  (enable/disable it from the page or with `wan-order watchdog enable|disable`)

## Install

Download the package from the latest Release, copy it to the router, then:

```sh
# OpenWrt 25.12+ (apk)
apk add --allow-untrusted /tmp/luci-app-wanorder-*.apk

# OpenWrt 24.10 and older (opkg)
opkg install /tmp/luci-app-wanorder_*_all.ipk
```

Log out of LuCI and back in. Settings live in `/etc/config/wanorder`.

## Build locally

Needs Docker (for the .apk) and GNU tar (for the .ipk):

```sh
sh scripts/build-apk.sh
sh scripts/build-ipk.sh
ls dist/
```

## Release

1. Bump `PKG_VERSION` (and reset `PKG_RELEASE` to 1) in `luci-app-wanorder/Makefile`.
2. Commit, then tag and push:
   ```sh
   git tag v1.2.0
   git push origin main --tags
   ```
3. GitHub Actions lints, builds both packages and publishes a Release.
   The tag must equal `v` + `PKG_VERSION`, or the build fails on purpose.

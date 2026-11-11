include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wanorder
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT

LUCI_TITLE:=WAN Order: WAN priority manager with failover watchdog
LUCI_DEPENDS:=+luci-base +jsonfilter
LUCI_PKGARCH:=all

define Package/luci-app-wanorder/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /usr/bin/wan-order postinstall >/dev/null 2>&1
exit 0
endef

define Package/luci-app-wanorder/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/wan-watchdog stop
	/etc/init.d/wan-watchdog disable
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

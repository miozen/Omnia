include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-omnia
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

LUCI_TITLE:=Omnia sing-box TUN control panel
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode +ucode +ucode-mod-fs +ucode-mod-ubus +ucode-mod-uclient +ucode-mod-uloop +jsonfilter +sing-box +ip-full +ca-bundle +wget-ssl +coreutils-timeout
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

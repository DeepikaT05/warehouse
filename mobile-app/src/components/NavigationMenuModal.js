import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';

export default function NavigationMenuModal({ visible, onClose, navigation, user }) {
  if (!visible) return null;

  const isAdmin = user?.role === 'admin';

  const allMenuItems = [
    { label: 'Dashboard Home', icon: '🏠', screen: 'Dashboard' },
    { label: 'Purchase Entry & Intake', icon: '📥', screen: 'Purchase' },
    { label: 'QR Label Print Studio', icon: '🖨️', screen: 'QRPrint' },
    { label: 'Stock Inventory Matrix', icon: '📦', screen: 'StockList' },
    { label: 'Assigned Bills & Picking', icon: '📋', screen: 'AssignedOrders' },
    { label: 'Dispatch Verification Guard', icon: '🟢', screen: 'ScanVerify' },
    { label: 'Delivery Statements', icon: '🚚', screen: 'DeliveryStatement' },
    { label: 'Dealer Approval & Bilty', icon: '📋', screen: 'DealerApprovalStatus' },
    { label: 'Dealer Directory', icon: '🏪', screen: 'DealerMaster' },
    { label: 'Product Lifecycle History', icon: '📜', screen: 'ProductHistory' }
  ];

  const workerMenuItems = [
    { label: 'Dashboard Home', icon: '🏠', screen: 'Dashboard' },
    { label: 'Assigned Bills & Picking', icon: '📋', screen: 'AssignedOrders' },
    { label: 'Dispatch Verification & QR Scan', icon: '📷', screen: 'ScanVerify' },
    { label: 'Delivery Statements', icon: '🚚', screen: 'DeliveryStatement' },
    { label: 'Dealer Approval & Bilty Status', icon: '✅', screen: 'DealerApprovalStatus' }
  ];

  const menuItems = isAdmin ? allMenuItems : workerMenuItems;

  const handleNavigate = (screenName) => {
    onClose();
    if (navigation) {
      navigation.navigate(screenName);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Dark Backdrop Overlay */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Side Drawer Container */}
        <SafeAreaView style={styles.sideDrawer}>
          {/* Header */}
          <View style={styles.menuHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>VANIKI CROP SCIENCE</Text>
              <Text style={styles.menuSubtitle}>Warehouse Worker Menu</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
            {menuItems.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.menuRow}
                onPress={() => handleNavigate(item.screen)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.arrowIcon}>➔</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Bottom Logout Action */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                onClose();
                if (navigation) navigation.navigate('Login');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>🚪 Logout Session</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  sideDrawer: { width: '82%', height: '100%', backgroundColor: '#FFFFFF', elevation: 10 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0F6E56', paddingHorizontal: 16, paddingVertical: 18 },
  brandTitle: { color: '#A7F3D0', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  menuSubtitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 2 },
  closeBtn: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  menuList: { padding: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: '#1E293B' },
  arrowIcon: { fontSize: 13, color: '#0F6E56', fontWeight: '900' },
  footerContainer: { padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF' },
  logoutBtn: { backgroundColor: '#EF4444', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#FFF', fontWeight: '900', fontSize: 13 }
});

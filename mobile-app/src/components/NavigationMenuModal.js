import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { COLORS } from '../theme';
import { useAuth } from '../context/AuthContext';

const ADMIN_MENU = [
  { label: 'Dashboard Home', screen: 'Dashboard' },
  { label: 'Purchase Entry & Intake', screen: 'Purchase' },
  { label: 'QR Label Printing', screen: 'QRPrint' },
  { label: 'Stock Inventory', screen: 'StockList' },
  { label: 'Assigned Bills & Picking', screen: 'AssignedOrders' },
  { label: 'Dispatch Scan Verify', screen: 'ScanVerify' },
  { label: 'Delivery Statements', screen: 'DeliveryStatement' },
  { label: 'Dealer Approval & Bilty', screen: 'DealerApprovalStatus' },
  { label: 'Dealer Directory', screen: 'DealerMaster' },
  { label: 'Product Lifecycle History', screen: 'ProductHistory' }
];

const WORKER_MENU = [
  { label: 'Dashboard Home', screen: 'Dashboard' },
  { label: 'Assigned Bills & Picking', screen: 'AssignedOrders' },
  { label: 'Dispatch Scan Verify', screen: 'ScanVerify' },
  { label: 'Delivery Statements', screen: 'DeliveryStatement' },
  { label: 'Dealer Approval & Bilty', screen: 'DealerApprovalStatus' }
];

export default function NavigationMenuModal({ visible, onClose, navigation }) {
  const { user, isAdmin, logout } = useAuth();
  const menuItems = isAdmin ? ADMIN_MENU : WORKER_MENU;

  const handleNavigate = (screenName) => {
    onClose();
    navigation?.navigate(screenName);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <SafeAreaView style={styles.sideDrawer}>
          <View style={styles.menuHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>VANIKI CROP SCIENCE</Text>
              <Text style={styles.menuSubtitle}>{user?.name || 'Warehouse Menu'}</Text>
              <Text style={styles.roleTag}>{isAdmin ? 'ADMIN' : 'WAREHOUSE WORKER'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={styles.menuRow}
                onPress={() => handleNavigate(item.screen)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.arrowIcon}>{'>'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => { onClose(); logout(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>Log Out</Text>
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
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 18 },
  brandTitle: { color: '#A7F3D0', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  menuSubtitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 2 },
  roleTag: { color: '#A7F3D0', fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  closeBtn: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  menuList: { padding: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  menuLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: '#1E293B' },
  arrowIcon: { fontSize: 15, color: COLORS.primary, fontWeight: '900' },
  footerContainer: { padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF' },
  logoutBtn: { backgroundColor: COLORS.danger, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#FFF', fontWeight: '900', fontSize: 13 }
});

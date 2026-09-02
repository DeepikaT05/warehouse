import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import NavigationMenuModal from '../components/NavigationMenuModal';

export default function DashboardScreen({ route, navigation }) {
  const user = route.params?.user || { name: 'Warehouse Operator', role: 'user', username: 'warehouse1' };
  const [metrics, setMetrics] = useState({
    totalStock: 0,
    todayDispatches: 0,
    availableStock: 0,
    pendingDispatches: 0
  });
  const [assignedBills, setAssignedBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await mobileApi.get('/stock/dashboard');
      if (res.data.success && res.data.metrics) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.log('Stock dashboard endpoint error, trying summary endpoint:', err.message);
      try {
        const res = await mobileApi.get('/user/dashboard-summary');
        if (res.data.success && res.data.metrics) {
          setMetrics({
            totalStock: res.data.metrics.totalStock || 0,
            todayDispatches: res.data.metrics.todayDispatches || 0,
            availableStock: res.data.metrics.availableStock || 0,
            pendingDispatches: res.data.metrics.pendingDispatches || 0
          });
        }
      } catch (e) {
        console.error('Fetch mobile summary error:', e.message);
      }
    }

    // Fetch assigned bills for worker picking
    try {
      setBillsLoading(true);
      const ordersRes = await mobileApi.get('/user/orders');
      if (ordersRes.data.success) {
        setAssignedBills(ordersRes.data.orders || []);
      }
    } catch (err) {
      console.error('Fetch assigned bills error:', err.message);
    } finally {
      setBillsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>VANIKI CROP SCIENCE WMS</Text>
            <Text style={styles.userName}>{user.name}</Text>
          </View>

          {/* 3-Line Hamburger Menu Bar Button */}
          <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setMenuVisible(true)}>
            <Text style={styles.hamburgerIcon}>☰</Text>
            <Text style={styles.hamburgerText}>MENU</Text>
          </TouchableOpacity>
        </View>

        {/* Warehouse Metrics Snapshot */}
        <Text style={styles.sectionTitle}>WAREHOUSE SNAPSHOT</Text>
        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Stock</Text>
            <Text style={styles.metricValue}>{metrics.totalStock}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Today's Dispatch</Text>
            <Text style={[styles.metricValue, { color: COLORS.success }]}>{metrics.todayDispatches}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Available Stock</Text>
            <Text style={styles.metricValue}>{metrics.availableStock}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pending Dispatch</Text>
            <Text style={[styles.metricValue, { color: COLORS.alert }]}>{metrics.pendingDispatches}</Text>
          </View>
        </View>

        {/* ASSIGNED BILLS FOR WORKER STOCK PICKING SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>⚡ ASSIGNED BILLS FOR STOCK PICKING</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AssignedOrders')}>
            <Text style={styles.viewAllText}>View All ({assignedBills.length})</Text>
          </TouchableOpacity>
        </View>

        {billsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0F6E56" />
            <Text style={styles.loadingSubtext}>Loading assigned bills...</Text>
          </View>
        ) : assignedBills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Assigned Bills Right Now</Text>
            <Text style={styles.emptyText}>
              Admin assigns sales bills from the Admin Panel. Assigned bills will automatically appear here for stock picking.
            </Text>
          </View>
        ) : (
          assignedBills.slice(0, 5).map((bill) => {
            const totalRequired = bill.items?.reduce((acc, i) => acc + (i.quantity || 0), 0) || 0;
            const totalPicked = bill.pickedItems?.length || 0;
            const isCompleted = totalPicked >= totalRequired && totalRequired > 0;

            return (
              <View key={bill._id} style={styles.billCard}>
                <View style={styles.billCardHeader}>
                  <View>
                    <Text style={styles.billNoText}>Bill #{bill.invoiceNo}</Text>
                    <Text style={styles.dealerText}>{bill.dealerName} ({bill.garageName || 'Main Store'})</Text>
                  </View>
                  <View style={[styles.statusBadge, isCompleted ? styles.badgeSuccess : styles.badgePending]}>
                    <Text style={[styles.statusBadgeText, isCompleted ? styles.badgeSuccessText : styles.badgePendingText]}>
                      {isCompleted ? 'PICKING COMPLETE' : bill.orderStatus?.toUpperCase() || 'NEW ASSIGNED'}
                    </Text>
                  </View>
                </View>

                {/* Product Items Summary */}
                <View style={styles.itemsSummaryBox}>
                  {bill.items?.map((p, idx) => (
                    <Text key={idx} style={styles.itemSummaryText}>
                      • {p.productName} ({p.batchNumber}) — <Text style={styles.qtyText}>{p.quantity} boxes</Text>
                    </Text>
                  ))}
                </View>

                {/* Progress & Pick Button */}
                <View style={styles.billCardFooter}>
                  <Text style={styles.progressLabel}>
                    Picked: {totalPicked}/{totalRequired} boxes
                  </Text>
                  <TouchableOpacity
                    style={[styles.pickBtn, isCompleted && styles.pickBtnDone]}
                    onPress={() => navigation.navigate('ScanVerify', { invoiceNo: bill.invoiceNo, orderId: bill._id })}
                  >
                    <Text style={styles.pickBtnText}>
                      {isCompleted ? '✓ Verified' : '▶ Start Picking & Scan QR'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 3-LINE NAVIGATION HAMBURGER MENU MODAL */}
      <NavigationMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
        user={user}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  welcome: { fontSize: 11, color: COLORS.primary, fontWeight: '800' },
  userName: { fontSize: 18, color: COLORS.slate900, fontWeight: '900' },
  hamburgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F6E56',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#0F6E56',
    shadowOpacity: 0.3,
    elevation: 3,
  },
  hamburgerIcon: { fontSize: 18, color: '#FFF', fontWeight: '900' },
  hamburgerText: { fontSize: 12, color: '#FFF', fontWeight: '900', letterSpacing: 0.5 },
  scanActionCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20
  },
  scanIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  scanDesc: { color: COLORS.bgLight, fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.slate500, marginBottom: 10, letterSpacing: 0.5 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  viewAllText: { fontSize: 11, fontWeight: '800', color: '#0F6E56' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metricCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  metricLabel: { fontSize: 10, color: COLORS.slate500, fontWeight: '700' },
  metricValue: { fontSize: 20, fontWeight: '900', color: COLORS.slate900, marginTop: 4 },
  loadingBox: { padding: 20, alignItems: 'center' },
  loadingSubtext: { fontSize: 11, color: '#64748B', marginTop: 6 },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: '800', color: COLORS.slate800, marginBottom: 4 },
  emptyText: { fontSize: 11, color: COLORS.slate500, textAlign: 'center', lineHeight: 16 },
  billCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
  billCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  billNoText: { fontSize: 15, fontWeight: '900', color: '#0F6E56', fontFamily: 'monospace' },
  dealerText: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgePendingText: { color: '#92400E', fontSize: 9, fontWeight: '900' },
  badgeSuccess: { backgroundColor: '#D1FAE5' },
  badgeSuccessText: { color: '#065F46', fontSize: 9, fontWeight: '900' },
  itemsSummaryBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginVertical: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  itemSummaryText: { fontSize: 11, color: '#334155', fontWeight: '600', marginVertical: 1 },
  qtyText: { fontWeight: '900', color: '#0F6E56' },
  billCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  progressLabel: { fontSize: 11, fontWeight: '800', color: '#475569' },
  pickBtn: { backgroundColor: '#0F6E56', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  pickBtnDone: { backgroundColor: '#10B981' },
  pickBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900' }
});



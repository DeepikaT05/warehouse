import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';
import NavigationMenuModal from '../components/NavigationMenuModal';

export default function DashboardScreen({ route, navigation }) {
  const user = route.params?.user || { name: 'Warehouse Operator', role: 'user' };
  const [metrics, setMetrics] = useState({
    totalStock: 0,
    todayDispatches: 0,
    availableStock: 0,
    pendingDispatches: 0
  });
  const [menuVisible, setMenuVisible] = useState(false);

  const fetchDashboardMetrics = async () => {
    try {
      const res = await mobileApi.get('/stock/dashboard');
      if (res.data.success && res.data.metrics) {
        setMetrics(res.data.metrics);
        return;
      }
    } catch (err) {
      console.log('Stock dashboard endpoint error, trying summary endpoint:', err.message);
    }

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
    } catch (err) {
      console.error('Fetch mobile summary error:', err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardMetrics();
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

        {/* Quick Dispatch Scanner Banner */}
        <TouchableOpacity
          style={styles.scanActionCard}
          onPress={() => navigation.navigate('ScanVerify')}
        >
          <View style={styles.scanIconBg}>
            <Text style={{ fontSize: 28 }}>📷</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>SCAN & VERIFY DISPATCH</Text>
            <Text style={styles.scanDesc}>Green Screen (Verified) / Red Screen (Mismatch)</Text>
          </View>
        </TouchableOpacity>

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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  metricLabel: { fontSize: 10, color: COLORS.slate500, fontWeight: '700' },
  metricValue: { fontSize: 20, fontWeight: '900', color: COLORS.slate900, marginTop: 4 },
  modulesGrid: { gap: 10 },
  moduleBtn: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border },
  moduleIcon: { fontSize: 20 },
  moduleLabel: { fontSize: 13, fontWeight: '800', color: COLORS.slate800 }
});


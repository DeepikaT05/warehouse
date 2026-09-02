import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView
} from 'react-native';
import mobileApi from '../services/api';

export default function AssignedOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const fetchOrders = async () => {
    try {
      const res = await mobileApi.get('/user/orders', {
        params: { status: selectedStatus }
      });
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Fetch assigned orders mobile error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return { label: 'NEW ASSIGNED BILL', bg: '#DBEAFE', color: '#1E40AF' };
      case 'picking_started':
        return { label: 'PICKING IN PROGRESS', bg: '#FEF3C7', color: '#92400E' };
      case 'picking_completed':
        return { label: 'PICKING COMPLETED', bg: '#F3E8FF', color: '#6B21A8' };
      case 'warehouse_verified':
        return { label: 'WAREHOUSE VERIFIED', bg: '#D1FAE5', color: '#065F46' };
      case 'completed':
        return { label: 'COMPLETED', bg: '#0F6E56', color: '#FFFFFF' };
      default:
        return { label: status?.toUpperCase() || 'ORDER', bg: '#E2E8F0', color: '#475569' };
    }
  };

  const filteredOrders = orders.filter(o =>
    !search ||
    o.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
    o.dealerName.toLowerCase().includes(search.toLowerCase()) ||
    (o.garageName && o.garageName.toLowerCase().includes(search.toLowerCase()))
  );

  const renderOrderItem = ({ item }) => {
    const totalItems = item.items?.reduce((acc, i) => acc + (i.quantity || i.requestedQuantity || 0), 0) || 0;
    const totalPicked = item.pickedItems?.length || 0;
    const badge = getStatusBadge(item.orderStatus);
    const percent = totalItems > 0 ? Math.min(100, Math.round((totalPicked / totalItems) * 100)) : 0;

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.billNo}>Bill #{item.invoiceNo}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Dealer Info */}
        <Text style={styles.dealerName}>Dealer: {item.dealerName}</Text>
        {item.garageName ? <Text style={styles.garageName}>Garage: {item.garageName}</Text> : null}

        {/* Product Items List */}
        <View style={styles.itemsBox}>
          <Text style={styles.itemsBoxTitle}>ASSIGNED PRODUCTS TO PICK:</Text>
          {item.items?.map((p, idx) => (
            <Text key={idx} style={styles.itemLine}>
              • {p.productName} (Batch: {p.batchNumber}) — <Text style={styles.itemQty}>{p.quantity} units</Text>
            </Text>
          ))}
        </View>

        {/* Stock Picking Progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Picking Progress:</Text>
            <Text style={styles.progressPercent}>{totalPicked} of {totalItems} units ({percent}%)</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>
        </View>

        {/* Action Button or Completed Badge */}
        {percent >= 100 || ['picking_completed', 'warehouse_verified', 'invoice_generated', 'completed'].includes(item.orderStatus) ? (
          <View style={[styles.actionBtn, { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }]}>
            <Text style={{ color: '#065F46', fontSize: 12, fontWeight: '900' }}>✓ Stock Picking Completed</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('ScanVerify', { invoiceNo: item.invoiceNo, orderId: item._id })}
          >
            <Text style={styles.actionBtnText}>
              {item.orderStatus === 'new' || item.orderStatus === 'viewed'
                ? '▶ Pick Order (Start Barcode Scanning)'
                : '▶ Continue Stock Picking'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.topHeader}>
        <Text style={styles.title}>Assigned Dealer Bills & Orders</Text>
        <Text style={styles.subtitle}>Warehouse Operator Stock Picking Panel</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search bill number, dealer, garage..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { label: 'All Bills', value: '' },
            { label: 'New', value: 'new' },
            { label: 'Picking', value: 'picking_started' },
            { label: 'Completed', value: 'completed' }
          ].map((pill) => (
            <TouchableOpacity
              key={pill.value}
              style={[styles.pill, selectedStatus === pill.value && styles.pillActive]}
              onPress={() => setSelectedStatus(pill.value)}
            >
              <Text style={[styles.pillText, selectedStatus === pill.value && styles.pillTextActive]}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F6E56" />
          <Text style={styles.loadingText}>Loading assigned dealer bills...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item._id}
          renderItem={renderOrderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F6E56']} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Assigned Bills Found</Text>
              <Text style={styles.emptyText}>
                No dealer bills match your search filter. Admin uploads sales bills from Admin Panel which appear here for stock picking.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 14 },
  topHeader: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  searchBox: { marginBottom: 10 },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A'
  },
  filterRow: { marginBottom: 12 },
  filterScroll: { flexDirection: 'row', gap: 6 },
  pill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  pillActive: { backgroundColor: '#0F6E56', borderColor: '#0F6E56' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748B' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  billNo: { fontSize: 16, fontWeight: '900', color: '#0F6E56', fontFamily: 'monospace' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: '900' },
  dealerName: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  garageName: { fontSize: 11, color: '#64748B', marginTop: 1 },
  itemsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  itemsBoxTitle: { fontSize: 9, fontWeight: '900', color: '#94A3B8', marginBottom: 4 },
  itemLine: { fontSize: 11, color: '#334155', marginVertical: 1, fontWeight: '600' },
  itemQty: { fontWeight: '900', color: '#0F6E56' },
  progressRow: { marginTop: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  progressPercent: { fontSize: 11, fontWeight: '900', color: '#0F6E56' },
  progressBarBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0F6E56', borderRadius: 4 },
  actionBtn: { backgroundColor: '#0F6E56', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  actionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 4 },
  emptyText: { fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16 }
});

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
  ScrollView,
  Linking,
  Alert
} from 'react-native';
import mobileApi from '../services/api';

export default function AssignedOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Also trigger B2B sync
      await mobileApi.post('/user/orders/sync-b2b');
    } catch (e) {}
    fetchOrders();
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await mobileApi.post('/user/orders/sync-b2b');
      Alert.alert('B2B Sync Complete', `Synced central bills. Created: ${res.data?.stats?.created || 0}, Rejected: ${res.data?.stats?.rejectedSynced || 0}`);
      await fetchOrders();
    } catch (e) {
      Alert.alert('Sync Error', e.response?.data?.message || e.message);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (order) => {
    if (order.orderStatus === 'cancelled' || order.isCancelled) {
      return { label: 'ORDER CANCELLED', bg: '#FFE4E6', color: '#BE123C' };
    }
    if (order.orderStatus === 'rejected' || order.isRejected) {
      return { label: 'REJECTED IN B2B', bg: '#FEE2E2', color: '#991B1B' };
    }

    switch (order.orderStatus) {
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
        return { label: order.orderStatus?.toUpperCase() || 'ORDER', bg: '#E2E8F0', color: '#475569' };
    }
  };

  const filteredOrders = orders.filter(o => {
    if (selectedStatus === 'rejected_or_cancelled') {
      if (!(o.orderStatus === 'rejected' || o.orderStatus === 'cancelled' || o.isRejected || o.isCancelled)) return false;
    }
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      o.invoiceNo?.toLowerCase().includes(query) ||
      o.dealerName?.toLowerCase().includes(query) ||
      o.garageName?.toLowerCase().includes(query) ||
      o.buyerOrderNo?.toLowerCase().includes(query)
    );
  });

  const renderOrderItem = ({ item }) => {
    const totalBoxes = item.totalBoxes || item.items?.reduce((acc, i) => acc + (i.totalBoxes || 1), 0) || 0;
    const totalPieces = item.totalPieces || item.items?.reduce((acc, i) => acc + (i.quantity || i.requestedQuantity || 0), 0) || 0;
    const totalPicked = item.pickedItems?.length || 0;
    const badge = getStatusBadge(item);
    const percent = totalBoxes > 0 ? Math.min(100, Math.round((totalPicked / totalBoxes) * 100)) : 0;
    const isRejectedOrCancelled = item.orderStatus === 'rejected' || item.orderStatus === 'cancelled' || item.isRejected || item.isCancelled;

    return (
      <View style={[styles.card, isRejectedOrCancelled && styles.cardCancelled]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.billNo}>Bill #{item.invoiceNo}</Text>
            {item.isB2BOrder && (
              <View style={styles.b2bTag}>
                <Text style={styles.b2bTagText}>B2B</Text>
              </View>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Dealer Info */}
        <Text style={styles.dealerName}>{item.dealerName}</Text>
        {item.garageName && item.garageName !== item.dealerName ? (
          <Text style={styles.garageName}>{item.garageName}</Text>
        ) : null}

        {/* Phone & Destination */}
        <View style={styles.dealerMetaRow}>
          {item.dealerPhone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.dealerPhone}`)}>
              <Text style={styles.phoneLink}>📞 {item.dealerPhone}</Text>
            </TouchableOpacity>
          ) : null}
          {item.destination ? (
            <Text style={styles.destText}>📍 {item.destination}</Text>
          ) : null}
        </View>

        {/* PROMINENT REJECTION / CANCELLATION BANNER */}
        {isRejectedOrCancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledTitle}>
              ⚠️ ORDER {item.orderStatus === 'cancelled' ? 'CANCELLED' : 'REJECTED IN B2B PORTAL'}
            </Text>
            <Text style={styles.cancelledReason}>
              Reason: "{item.cancellationReason || item.rejectionReason || 'Order rejected by Superadmin or Dealer. Do not dispatch.'}"
            </Text>
            <Text style={styles.cancelledMeta}>
              DO NOT PICK OR DISPATCH THIS STOCK
            </Text>
          </View>
        )}

        {/* Product Items List */}
        <View style={styles.itemsBox}>
          <View style={styles.itemsBoxHeader}>
            <Text style={styles.itemsBoxTitle}>BOXES (PETI) TO PICK ({item.items?.length || 0}):</Text>
            <Text style={styles.totalUnitsText}>{totalBoxes} Boxes ({totalPieces} Pcs)</Text>
          </View>
          {item.items?.map((p, idx) => {
            const lineBoxes = p.totalBoxes || 1;
            const dispName = p.displayProductName || (
              p.weight && !p.productName?.toUpperCase().includes(p.weight.toUpperCase())
                ? `${p.productName} (${p.weight})`
                : p.productName
            );
            return (
              <Text key={idx} style={styles.itemLine}>
                • {dispName} ({p.batchNumber}) — <Text style={styles.itemQty}>{lineBoxes} Boxes / Peti ({p.quantity} Pcs)</Text>
              </Text>
            );
          })}
        </View>

        {/* Stock Picking Progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Picking Progress:</Text>
            <Text style={[styles.progressPercent, isRejectedOrCancelled && { color: '#E11D48' }]}>
              {totalPicked} of {totalBoxes} Boxes ({percent}%)
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${percent}%` },
                isRejectedOrCancelled && { backgroundColor: '#E11D48' }
              ]}
            />
          </View>
        </View>

        {/* Action Button or Completed / Blocked Badge */}
        {isRejectedOrCancelled ? (
          <View style={[styles.actionBtn, styles.actionBtnBlocked]}>
            <Text style={styles.actionBtnBlockedText}>🚫 Picking Blocked (Order Cancelled)</Text>
          </View>
        ) : percent >= 100 || ['picking_completed', 'warehouse_verified', 'invoice_generated', 'completed'].includes(item.orderStatus) ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={[styles.actionBtn, { flex: 1, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', marginVertical: 0 }]}>
              <Text style={{ color: '#065F46', fontSize: 11, fontWeight: '900', textAlign: 'center' }}>✓ Picking Done</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1.2, backgroundColor: '#0F6E56', marginVertical: 0 }]}
              onPress={() => navigation.navigate('ScanVerify', { invoiceNo: item.invoiceNo, orderId: item._id })}
            >
              <Text style={styles.actionBtnText}>Dispatch Guard →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, marginVertical: 0 }]}
              onPress={() => navigation.navigate('StockPicking', { orderId: item._id, invoiceNo: item.invoiceNo })}
            >
              <Text style={styles.actionBtnText}>
                {item.orderStatus === 'new' || item.orderStatus === 'viewed'
                  ? 'Start Picking'
                  : 'Continue Picking'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { flex: 1, backgroundColor: '#1E293B', marginVertical: 0 }]}
              onPress={() => navigation.navigate('ScanVerify', { invoiceNo: item.invoiceNo, orderId: item._id })}
            >
              <Text style={styles.actionBtnText}>Dispatch Guard</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Assigned Dealer Bills</Text>
          <Text style={styles.subtitle}>Vaniki B2B Orders & Live Stock Picking</Text>
        </View>
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleManualSync}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>{syncing ? '...' : '🔄 Sync B2B'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search bill number, dealer, destination..."
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
            { label: 'In Picking', value: 'picking_started' },
            { label: 'Completed', value: 'completed' },
            { label: 'Cancelled / Rejected', value: 'rejected_or_cancelled', isRed: true }
          ].map((pill) => {
            const active = selectedStatus === pill.value;
            return (
              <TouchableOpacity
                key={pill.value}
                style={[
                  styles.pill,
                  active && (pill.isRed ? styles.pillActiveRed : styles.pillActive)
                ]}
                onPress={() => setSelectedStatus(pill.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    active && styles.pillTextActive,
                    pill.isRed && !active && { color: '#BE123C' }
                  ]}
                >
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
              <Text style={styles.emptyTitle}>No Dealer Bills Found</Text>
              <Text style={styles.emptyText}>
                No orders match your search or filter. Pull down to refresh or tap "Sync B2B" above.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 14 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  syncBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10
  },
  syncBtnText: { fontSize: 11, fontWeight: '800', color: '#0F6E56' },
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
  pillActiveRed: { backgroundColor: '#BE123C', borderColor: '#BE123C' },
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
  cardCancelled: {
    borderColor: '#FDA4AF',
    backgroundColor: '#FFF1F2'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  billNo: { fontSize: 15, fontWeight: '900', color: '#0F6E56', fontFamily: 'monospace' },
  b2bTag: { backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE' },
  b2bTagText: { fontSize: 9, fontWeight: '900', color: '#4338CA' },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: '900' },
  dealerName: { fontSize: 14, fontWeight: '900', color: '#1E293B', marginTop: 2 },
  garageName: { fontSize: 11, color: '#64748B', marginTop: 1 },
  dealerMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center' },
  phoneLink: { fontSize: 11, color: '#0F6E56', fontWeight: '700' },
  destText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  cancelledBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10
  },
  cancelledTitle: { fontSize: 11, fontWeight: '900', color: '#991B1B' },
  cancelledReason: { fontSize: 11, color: '#7F1D1D', fontWeight: '700', marginTop: 2 },
  cancelledMeta: { fontSize: 9, color: '#B91C1C', fontWeight: '900', marginTop: 4, letterSpacing: 0.5 },

  itemsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  itemsBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemsBoxTitle: { fontSize: 9, fontWeight: '900', color: '#94A3B8' },
  totalUnitsText: { fontSize: 9, fontWeight: '900', color: '#0F6E56' },
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
  actionBtnBlocked: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
  actionBtnBlockedText: { color: '#991B1B', fontSize: 11, fontWeight: '900' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 4 },
  emptyText: { fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16 }
});

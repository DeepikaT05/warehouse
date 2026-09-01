import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import mobileApi from '../services/api';

export default function DealerApprovalStatusScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await mobileApi.get('/user/orders');
      if (res.data.success) {
        const tracked = res.data.orders.filter(o =>
          ['sent_to_dealer', 'dealer_approved', 'completed'].includes(o.orderStatus)
        );
        setOrders(tracked);
      }
    } catch (err) {
      console.error('Fetch dealer status error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.billNo}>Bill #{item.invoiceNo}</Text>
        <View style={[styles.badge, item.dealerApproved ? styles.badgeApproved : styles.badgePending]}>
          <Text style={styles.badgeText}>{item.dealerApproved ? 'DEALER APPROVED' : 'RECEIVING PENDING'}</Text>
        </View>
      </View>

      <Text style={styles.dealerName}>Dealer: {item.dealerName}</Text>
      <Text style={styles.dispatchedAt}>
        Dispatched: {item.dispatchedAt ? new Date(item.dispatchedAt).toLocaleDateString() : 'N/A'}
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Bilty / Proof Document:</Text>
        <Text style={styles.infoVal}>{item.biltyUploaded ? '✓ Bilty Uploaded by Dealer App' : '⏳ Pending Bilty upload from Dealer App'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F6E56" />
        <Text style={styles.loadingText}>Loading dealer status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} colors={['#0F6E56']} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No orders currently pending dealer receiving.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontSize: 13, marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  billNo: { fontSize: 16, fontWeight: '900', color: '#0F6E56' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeApproved: { backgroundColor: '#059669' },
  badgePending: { backgroundColor: '#D97706' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  dealerName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  dispatchedAt: { fontSize: 11, color: '#64748B', marginTop: 2 },
  infoBox: { marginTop: 10, backgroundColor: '#F1F5F9', padding: 10, borderRadius: 10 },
  infoTitle: { fontSize: 11, fontWeight: '800', color: '#475569' },
  infoVal: { fontSize: 11, fontWeight: '700', color: '#0F6E56', marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94A3B8', fontSize: 14 }
});

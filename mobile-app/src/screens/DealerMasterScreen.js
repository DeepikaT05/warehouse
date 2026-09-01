import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';

export default function DealerMasterScreen() {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDealers();
  }, []);

  const fetchDealers = async () => {
    try {
      const res = await mobileApi.get('/dealers');
      if (res.data.success) {
        setDealers(res.data.dealers);
      }
    } catch (err) {
      console.error('Fetch dealers error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Dealer & Garage Master Directory ({dealers.length})</Text>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={dealers}
          keyExtractor={item => item._id || item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.dealerName}>{item.dealerName || item.name}</Text>
              <Text style={styles.garageName}>Garage: {item.garageName || item.garage || 'N/A'}</Text>
              <Text style={styles.meta}>Phone: {item.phone || 'N/A'} | City: {item.city || 'N/A'}</Text>
              <Text style={styles.gst}>GST: {item.gstNumber || item.gst || 'N/A'}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 30, color: COLORS.slate500, fontSize: 13 }}>
              No dealers found in directory.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  title: { fontSize: 16, fontWeight: '900', color: COLORS.slate900, marginBottom: 12 },
  card: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  dealerName: { fontSize: 14, fontWeight: '900', color: COLORS.slate900 },
  garageName: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  meta: { fontSize: 11, color: COLORS.slate500, marginTop: 2 },
  gst: { fontSize: 10, fontWeight: '800', fontFamily: 'monospace', color: COLORS.slate700, marginTop: 4 }
});

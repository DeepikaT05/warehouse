import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';

export default function StockListScreen() {
  const [boxes, setBoxes] = useState([]);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      const res = await mobileApi.get('/stock');
      if (res.data.success) {
        setBoxes(res.data.boxes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Warehouse Inventory Boxes ({boxes.length})</Text>
      <FlatList
        data={boxes}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.qrId}>{item.qrId}</Text>
              <Text style={styles.status}>{item.status?.toUpperCase()}</Text>
            </View>
            <Text style={styles.prodName}>{item.productName}</Text>
            <Text style={styles.meta}>Batch: {item.batchNumber} | Location: {item.warehouseLocation}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.slate900, marginBottom: 12 },
  card: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  qrId: { fontSize: 13, fontWeight: '900', color: COLORS.primary, fontFamily: 'monospace' },
  status: { fontSize: 10, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.bgLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  prodName: { fontSize: 13, fontWeight: '700', color: COLORS.slate900 },
  meta: { fontSize: 11, color: COLORS.slate500, marginTop: 2 }
});

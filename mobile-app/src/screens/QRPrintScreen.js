import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme';
import mobileApi from '../services/api';

export default function QRPrintScreen({ route }) {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockBoxes();
  }, []);

  const fetchStockBoxes = async () => {
    try {
      const res = await mobileApi.get('/stock');
      if (res.data.success) {
        setBoxes(res.data.boxes);
      }
    } catch (err) {
      console.error('Fetch mobile stock boxes error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>QR & Barcode Sticker Printing Studio ({boxes.length})</Text>
        <Text style={styles.subtitle}>Format: VANIKI CROP SCIENCE Official 2" x 1" Label Grid</Text>

        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={() => Alert.alert('Print Ready', `Selected ${Math.min(50, boxes.length)} Stickers`)}>
            <Text style={styles.presetText}>50 Stickers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => Alert.alert('Print Ready', `Selected ${Math.min(100, boxes.length)} Stickers`)}>
            <Text style={styles.presetText}>100 Stickers</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : boxes.length === 0 ? (
          <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ textAlign: 'center', color: COLORS.slate500, fontSize: 13 }}>
              No QR stickers generated in system yet.
            </Text>
          </View>
        ) : (
          boxes.map((b, idx) => (
            <View key={b._id || idx} style={styles.stickerCard}>
              <Text style={styles.companyHeader}>VANIKI CROP SCIENCE</Text>
              <View style={styles.stickerBody}>
                <View style={styles.qrPlaceholder}>
                  <Text style={{ fontSize: 24 }}>⬛</Text>
                  <Text style={styles.qrLabel}>[ QR CODE ]</Text>
                </View>
                <View style={styles.details}>
                  <Text style={styles.detailText}><Text style={{ fontWeight: '800' }}>Product:</Text> {b.productName}</Text>
                  <Text style={styles.detailText}><Text style={{ fontWeight: '800' }}>Batch:</Text> {b.batchNumber}</Text>
                  <Text style={styles.detailText}><Text style={{ fontWeight: '800' }}>Weight:</Text> {b.weight || '1 kg'}</Text>
                  <Text style={styles.qrId}>{b.qrId}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity 
          style={[styles.printBtn, { opacity: boxes.length === 0 ? 0.5 : 1 }]} 
          disabled={boxes.length === 0}
          onPress={() => Alert.alert('Printer Command', `Sending ${boxes.length} sticker print job to Thermal Printer!`)}
        >
          <Text style={styles.printBtnText}>🖨️ Send to Mobile Thermal Printer</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate900 },
  subtitle: { fontSize: 12, color: COLORS.slate500, fontWeight: '600', marginBottom: 16 },
  presetRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  presetBtn: { flex: 1, backgroundColor: COLORS.bgLight, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  presetText: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
  stickerCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: COLORS.slate900, marginBottom: 12 },
  companyHeader: { fontSize: 12, fontWeight: '900', color: COLORS.primary, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 4, marginBottom: 8 },
  stickerBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrPlaceholder: { width: 60, height: 60, borderWidth: 1, borderColor: '#CCC', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qrLabel: { fontSize: 8, fontWeight: '800', color: COLORS.slate500 },
  details: { flex: 1 },
  detailText: { fontSize: 11, color: COLORS.slate700 },
  qrId: { fontSize: 13, fontWeight: '900', color: COLORS.primary, fontFamily: 'monospace', marginTop: 4 },
  printBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  printBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 }
});
